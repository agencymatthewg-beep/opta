//! WGSL shader preprocessor with include support.
//!
//! Supports:
//! - `#include "filename.wgsl"` - include another shader file
//! - `#define NAME VALUE` - simple text replacement
//!
//! # Example
//!
//! ```ignore
//! use opta_render::shader::ShaderPreprocessor;
//!
//! let mut preprocessor = ShaderPreprocessor::new();
//! preprocessor.register_include("math.wgsl", "const PI: f32 = 3.14159;");
//!
//! let source = r#"
//! #include "math.wgsl"
//!
//! fn my_func() -> f32 {
//!     return PI * 2.0;
//! }
//! "#;
//!
//! let processed = preprocessor.process(source)?;
//! assert!(processed.contains("const PI"));
//! ```

use std::collections::{HashMap, HashSet};
use std::fmt::Write;

use super::error::PreprocessError;

/// Maximum depth for nested includes.
const MAX_INCLUDE_DEPTH: usize = 16;

/// Preprocessor for WGSL shaders.
///
/// Supports:
/// - `#include "filename.wgsl"` - include another shader file
/// - `#define NAME VALUE` - simple text replacement
#[derive(Debug, Clone, Default)]
pub struct ShaderPreprocessor {
    /// Registered include files (name -> source).
    includes: HashMap<String, String>,
    /// Define macros (name -> value).
    defines: HashMap<String, String>,
}

impl ShaderPreprocessor {
    /// Create a new shader preprocessor.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Register an include file.
    ///
    /// The include name should match what appears in `#include "name"` directives.
    pub fn register_include(&mut self, name: impl Into<String>, source: impl Into<String>) {
        self.includes.insert(name.into(), source.into());
    }

    /// Remove a registered include.
    pub fn unregister_include(&mut self, name: &str) -> Option<String> {
        self.includes.remove(name)
    }

    /// Check if an include is registered.
    #[must_use]
    pub fn has_include(&self, name: &str) -> bool {
        self.includes.contains_key(name)
    }

    /// Get a registered include source.
    #[must_use]
    pub fn get_include(&self, name: &str) -> Option<&str> {
        self.includes.get(name).map(String::as_str)
    }

    /// Add a define macro for text replacement.
    pub fn define(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.defines.insert(name.into(), value.into());
    }

    /// Remove a define macro.
    pub fn undefine(&mut self, name: &str) -> Option<String> {
        self.defines.remove(name)
    }

    /// Process WGSL source, resolving includes and defines.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - An include file is not registered
    /// - A circular include is detected
    /// - Maximum include depth is exceeded
    pub fn process(&self, source: &str) -> Result<String, PreprocessError> {
        let mut visited = HashSet::new();
        self.process_recursive(source, 0, &mut visited)
    }

    /// Process source recursively, tracking visited includes.
    fn process_recursive(
        &self,
        source: &str,
        depth: usize,
        visited: &mut HashSet<String>,
    ) -> Result<String, PreprocessError> {
        if depth > MAX_INCLUDE_DEPTH {
            return Err(PreprocessError::MaxDepthExceeded(MAX_INCLUDE_DEPTH));
        }

        let mut result = String::with_capacity(source.len());

        for line in source.lines() {
            let trimmed = line.trim();

            if let Some(include_name) = Self::parse_include_directive(trimmed) {
                // Check for circular include
                if visited.contains(&include_name) {
                    return Err(PreprocessError::CircularInclude(include_name));
                }

                // Get include source
                let include_source = self
                    .includes
                    .get(&include_name)
                    .ok_or_else(|| PreprocessError::IncludeNotFound(include_name.clone()))?;

                // Mark as visited
                visited.insert(include_name.clone());

                // Process the include recursively
                let processed = self.process_recursive(include_source, depth + 1, visited)?;

                // Add a comment showing where the include came from
                let _ = writeln!(result, "// BEGIN include \"{include_name}\"");
                result.push_str(&processed);
                if !processed.ends_with('\n') {
                    result.push('\n');
                }
                let _ = writeln!(result, "// END include \"{include_name}\"");

                // Remove from visited so it can be included elsewhere in the tree
                visited.remove(&include_name);
            } else if trimmed.starts_with("#define ") {
                // Skip #define lines - they're processed separately in apply_defines
            } else {
                result.push_str(line);
                result.push('\n');
            }
        }

        // Apply defines to the result
        Ok(self.apply_defines(&result))
    }

    /// Parse an include directive and return the filename.
    ///
    /// Returns `Some(filename)` if the line is a valid include directive.
    fn parse_include_directive(line: &str) -> Option<String> {
        if !line.starts_with("#include") {
            return None;
        }

        let rest = line.strip_prefix("#include")?.trim();

        // Handle both "filename" and <filename> syntax
        // Check for matching delimiters and extract filename
        let is_quote_delimited = rest.starts_with('"') && rest.ends_with('"');
        let is_angle_delimited = rest.starts_with('<') && rest.ends_with('>');

        if (!is_quote_delimited && !is_angle_delimited) || rest.len() <= 2 {
            return None;
        }

        let filename = &rest[1..rest.len() - 1];

        if filename.is_empty() {
            return None;
        }

        Some(filename.to_string())
    }

    /// Apply define macros to source text.
    fn apply_defines(&self, source: &str) -> String {
        if self.defines.is_empty() {
            return source.to_string();
        }

        let mut result = source.to_string();
        for (name, value) in &self.defines {
            result = result.replace(name, value);
        }
        result
    }

    /// Get the number of registered includes.
    #[must_use]
    pub fn include_count(&self) -> usize {
        self.includes.len()
    }

    /// Get the number of registered defines.
    #[must_use]
    pub fn define_count(&self) -> usize {
        self.defines.len()
    }

    /// Clear all registered includes.
    pub fn clear_includes(&mut self) {
        self.includes.clear();
    }

    /// Clear all defines.
    pub fn clear_defines(&mut self) {
        self.defines.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_include() {
        let mut pp = ShaderPreprocessor::new();
        pp.register_include("math.wgsl", "const PI: f32 = 3.14159;");

        let source = r#"#include "math.wgsl"

fn area(r: f32) -> f32 {
    return PI * r * r;
}"#;

        let result = pp.process(source).unwrap();
        assert!(result.contains("const PI: f32 = 3.14159"));
        assert!(result.contains("fn area"));
    }

    #[test]
    fn test_nested_includes() {
        let mut pp = ShaderPreprocessor::new();
        pp.register_include("constants.wgsl", "const PI: f32 = 3.14159;");
        pp.register_include(
            "math.wgsl",
            r#"#include "constants.wgsl"
fn square(x: f32) -> f32 { return x * x; }"#,
        );

        let source = r#"#include "math.wgsl"

fn main() {}"#;

        let result = pp.process(source).unwrap();
        assert!(result.contains("const PI"));
        assert!(result.contains("fn square"));
    }

    #[test]
    fn test_circular_include_detection() {
        let mut pp = ShaderPreprocessor::new();
        pp.register_include("a.wgsl", r#"#include "b.wgsl""#);
        pp.register_include("b.wgsl", r#"#include "a.wgsl""#);

        let source = r#"#include "a.wgsl""#;

        let result = pp.process(source);
        assert!(matches!(result, Err(PreprocessError::CircularInclude(_))));
    }

    #[test]
    fn test_include_not_found() {
        let pp = ShaderPreprocessor::new();
        let source = r#"#include "nonexistent.wgsl""#;

        let result = pp.process(source);
        assert!(matches!(result, Err(PreprocessError::IncludeNotFound(_))));
    }

    #[test]
    fn test_define_replacement() {
        let mut pp = ShaderPreprocessor::new();
        pp.define("MAX_LIGHTS", "8");
        pp.define("ENABLE_SHADOWS", "true");

        let source = "const max_lights: u32 = MAX_LIGHTS;\nconst shadows: bool = ENABLE_SHADOWS;";

        let result = pp.process(source).unwrap();
        assert!(result.contains("const max_lights: u32 = 8"));
        assert!(result.contains("const shadows: bool = true"));
    }

    #[test]
    fn test_angle_bracket_include() {
        let mut pp = ShaderPreprocessor::new();
        pp.register_include("stdlib.wgsl", "// Standard library");

        let source = r#"#include <stdlib.wgsl>"#;
        let result = pp.process(source).unwrap();
        assert!(result.contains("Standard library"));
    }

    #[test]
    fn test_parse_include_directive() {
        assert_eq!(
            ShaderPreprocessor::parse_include_directive(r#"#include "math.wgsl""#),
            Some("math.wgsl".to_string())
        );
        assert_eq!(
            ShaderPreprocessor::parse_include_directive(r#"#include <stdlib.wgsl>"#),
            Some("stdlib.wgsl".to_string())
        );
        assert_eq!(
            ShaderPreprocessor::parse_include_directive("fn main() {}"),
            None
        );
        assert_eq!(
            ShaderPreprocessor::parse_include_directive(r#"#include """#),
            None
        );
    }

    #[test]
    fn test_empty_source() {
        let pp = ShaderPreprocessor::new();
        let result = pp.process("").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_no_directives() {
        let pp = ShaderPreprocessor::new();
        let source = "fn main() -> f32 { return 1.0; }";
        let result = pp.process(source).unwrap();
        assert!(result.contains("fn main()"));
    }
}
