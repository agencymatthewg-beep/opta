//! Error types for shader operations.

use thiserror::Error;

/// Errors that can occur during shader preprocessing.
#[derive(Debug, Clone, Error)]
pub enum PreprocessError {
    /// Include file not found in registered includes.
    #[error("Include not found: {0}")]
    IncludeNotFound(String),

    /// Circular include detected.
    #[error("Circular include detected: {0}")]
    CircularInclude(String),

    /// Maximum include depth exceeded.
    #[error("Max include depth exceeded (max: {0})")]
    MaxDepthExceeded(usize),

    /// Invalid include directive syntax.
    #[error("Invalid include directive: {0}")]
    InvalidIncludeDirective(String),
}

/// Errors that can occur during shader loading and compilation.
#[derive(Debug, Clone, Error)]
pub enum ShaderError {
    /// Shader not found in cache.
    #[error("Shader not found: {0}")]
    NotFound(String),

    /// Shader compilation failed.
    #[error("Shader compilation failed: {0}")]
    CompilationFailed(String),

    /// File read error.
    #[error("File read error: {0}")]
    FileReadError(String),

    /// Preprocessing error.
    #[error("Preprocessor error: {0}")]
    PreprocessError(#[from] PreprocessError),

    /// Shader source is empty.
    #[error("Shader source is empty: {0}")]
    EmptySource(String),
}

/// Result type for shader operations.
pub type ShaderResult<T> = Result<T, ShaderError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preprocess_error_display() {
        let err = PreprocessError::IncludeNotFound("math.wgsl".to_string());
        assert_eq!(err.to_string(), "Include not found: math.wgsl");

        let err = PreprocessError::CircularInclude("a.wgsl -> b.wgsl -> a.wgsl".to_string());
        assert!(err.to_string().contains("Circular include"));

        let err = PreprocessError::MaxDepthExceeded(10);
        assert!(err.to_string().contains("10"));
    }

    #[test]
    fn test_shader_error_from_preprocess() {
        let preprocess_err = PreprocessError::IncludeNotFound("test.wgsl".to_string());
        let shader_err: ShaderError = preprocess_err.into();
        assert!(matches!(shader_err, ShaderError::PreprocessError(_)));
    }
}
