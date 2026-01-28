//! Shader loading and caching.
//!
//! Provides functionality to load WGSL shaders from various sources:
//! - Embedded static strings
//! - Files on disk
//! - Pre-processed source strings

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use wgpu::{Device, ShaderModule, ShaderModuleDescriptor, ShaderSource as WgpuSource};

use super::error::{ShaderError, ShaderResult};
use super::preprocessor::ShaderPreprocessor;

/// Source for a shader module.
#[derive(Debug, Clone)]
pub enum ShaderSource {
    /// Embedded WGSL source code (compile-time constant).
    Embedded(&'static str),
    /// File path to load WGSL from.
    File(PathBuf),
    /// Pre-processed WGSL string.
    Processed(String),
}

impl ShaderSource {
    /// Create a shader source from an embedded string.
    #[must_use]
    pub const fn embedded(source: &'static str) -> Self {
        Self::Embedded(source)
    }

    /// Create a shader source from a file path.
    pub fn file(path: impl Into<PathBuf>) -> Self {
        Self::File(path.into())
    }

    /// Create a shader source from a processed string.
    pub fn processed(source: impl Into<String>) -> Self {
        Self::Processed(source.into())
    }
}

/// Metadata about a loaded shader.
#[derive(Debug, Clone)]
pub struct ShaderMeta {
    /// The source used to load this shader.
    pub source: ShaderSource,
    /// Whether this shader has been preprocessed.
    pub preprocessed: bool,
}

/// Loads and compiles WGSL shaders with caching.
#[derive(Debug)]
pub struct ShaderLoader {
    /// Optional directory for loading shader files.
    shader_dir: Option<PathBuf>,
    /// Cache of compiled shader modules.
    cache: HashMap<String, ShaderModule>,
    /// Metadata for cached shaders.
    meta: HashMap<String, ShaderMeta>,
    /// Source strings for file-loaded shaders (for reload).
    sources: HashMap<String, String>,
}

impl Default for ShaderLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl ShaderLoader {
    /// Create a new shader loader without a shader directory.
    #[must_use]
    pub fn new() -> Self {
        Self {
            shader_dir: None,
            cache: HashMap::new(),
            meta: HashMap::new(),
            sources: HashMap::new(),
        }
    }

    /// Create a shader loader with a shader directory for file loading.
    pub fn with_shader_dir(dir: impl AsRef<Path>) -> Self {
        Self {
            shader_dir: Some(dir.as_ref().to_path_buf()),
            cache: HashMap::new(),
            meta: HashMap::new(),
            sources: HashMap::new(),
        }
    }

    /// Set the shader directory.
    pub fn set_shader_dir(&mut self, dir: impl AsRef<Path>) {
        self.shader_dir = Some(dir.as_ref().to_path_buf());
    }

    /// Get the shader directory.
    #[must_use]
    pub fn shader_dir(&self) -> Option<&Path> {
        self.shader_dir.as_deref()
    }

    /// Load shader from source without preprocessing.
    ///
    /// The shader is compiled and cached under the given name.
    /// Returns a reference to the cached shader module.
    #[allow(clippy::missing_panics_doc)] // Panics are unreachable - key existence verified before access
    pub fn load(
        &mut self,
        device: &Device,
        name: &str,
        source: ShaderSource,
    ) -> ShaderResult<&ShaderModule> {
        // Check if already cached - safe to unwrap since we just checked contains_key
        if self.cache.contains_key(name) {
            // SAFETY: We just verified the key exists
            return Ok(self.cache.get(name).expect("key verified to exist"));
        }

        let wgsl_source = match &source {
            ShaderSource::Embedded(src) => (*src).to_string(),
            ShaderSource::File(path) => Self::read_shader_file(path)?,
            ShaderSource::Processed(src) => src.clone(),
        };

        if wgsl_source.trim().is_empty() {
            return Err(ShaderError::EmptySource(name.to_string()));
        }

        let module = Self::compile_shader(device, name, &wgsl_source);

        // Store source for potential reload
        self.sources.insert(name.to_string(), wgsl_source);

        // Store metadata
        self.meta.insert(
            name.to_string(),
            ShaderMeta {
                source,
                preprocessed: false,
            },
        );

        // Cache the module
        self.cache.insert(name.to_string(), module);
        // SAFETY: We just inserted the key
        Ok(self.cache.get(name).expect("key just inserted"))
    }

    /// Load shader from embedded source.
    ///
    /// Convenience method for loading embedded shaders.
    pub fn load_embedded(
        &mut self,
        device: &Device,
        name: &str,
        wgsl: &'static str,
    ) -> ShaderResult<&ShaderModule> {
        self.load(device, name, ShaderSource::Embedded(wgsl))
    }

    /// Load shader from file.
    ///
    /// If a shader directory is set, the path is relative to it.
    /// Otherwise, the path is used directly.
    pub fn load_file(
        &mut self,
        device: &Device,
        name: &str,
        path: &Path,
    ) -> ShaderResult<&ShaderModule> {
        let full_path = if let Some(dir) = &self.shader_dir {
            dir.join(path)
        } else {
            path.to_path_buf()
        };

        self.load(device, name, ShaderSource::File(full_path))
    }

    /// Load shader with preprocessing.
    ///
    /// Runs the source through the preprocessor before compilation.
    /// Returns a reference to the cached shader module.
    #[allow(clippy::missing_panics_doc)] // Panics are unreachable - key existence verified before access
    pub fn load_with_preprocessing(
        &mut self,
        device: &Device,
        name: &str,
        source: &str,
        preprocessor: &ShaderPreprocessor,
    ) -> ShaderResult<&ShaderModule> {
        // Check if already cached - safe to unwrap since we just checked contains_key
        if self.cache.contains_key(name) {
            // SAFETY: We just verified the key exists
            return Ok(self.cache.get(name).expect("key verified to exist"));
        }

        let processed = preprocessor.process(source)?;

        if processed.trim().is_empty() {
            return Err(ShaderError::EmptySource(name.to_string()));
        }

        let module = Self::compile_shader(device, name, &processed);

        // Store processed source
        self.sources.insert(name.to_string(), processed);

        // Store metadata
        self.meta.insert(
            name.to_string(),
            ShaderMeta {
                source: ShaderSource::Processed(source.to_string()),
                preprocessed: true,
            },
        );

        self.cache.insert(name.to_string(), module);
        // SAFETY: We just inserted the key
        Ok(self.cache.get(name).expect("key just inserted"))
    }

    /// Reload a shader from its original source.
    ///
    /// Useful for hot-reload during development.
    pub fn reload(&mut self, device: &Device, name: &str) -> ShaderResult<()> {
        let meta = self
            .meta
            .get(name)
            .ok_or_else(|| ShaderError::NotFound(name.to_string()))?
            .clone();

        // Remove from cache to force reload
        self.cache.remove(name);
        self.sources.remove(name);

        // Reload based on original source type
        match &meta.source {
            ShaderSource::File(path) => {
                let source = Self::read_shader_file(path)?;
                let module = Self::compile_shader(device, name, &source);
                self.sources.insert(name.to_string(), source);
                self.cache.insert(name.to_string(), module);
            }
            ShaderSource::Embedded(src) => {
                let module = Self::compile_shader(device, name, src);
                self.sources.insert(name.to_string(), (*src).to_string());
                self.cache.insert(name.to_string(), module);
            }
            ShaderSource::Processed(src) => {
                let module = Self::compile_shader(device, name, src);
                self.sources.insert(name.to_string(), src.clone());
                self.cache.insert(name.to_string(), module);
            }
        }

        Ok(())
    }

    /// Get a cached shader module.
    #[must_use]
    pub fn get(&self, name: &str) -> Option<&ShaderModule> {
        self.cache.get(name)
    }

    /// Check if a shader is cached.
    #[must_use]
    pub fn is_cached(&self, name: &str) -> bool {
        self.cache.contains_key(name)
    }

    /// Get metadata for a cached shader.
    #[must_use]
    pub fn get_meta(&self, name: &str) -> Option<&ShaderMeta> {
        self.meta.get(name)
    }

    /// Get the processed source for a shader.
    #[must_use]
    pub fn get_source(&self, name: &str) -> Option<&str> {
        self.sources.get(name).map(String::as_str)
    }

    /// Remove a shader from the cache.
    pub fn remove(&mut self, name: &str) -> Option<ShaderModule> {
        self.meta.remove(name);
        self.sources.remove(name);
        self.cache.remove(name)
    }

    /// Clear all cached shaders.
    pub fn clear(&mut self) {
        self.cache.clear();
        self.meta.clear();
        self.sources.clear();
    }

    /// Get the number of cached shaders.
    #[must_use]
    pub fn len(&self) -> usize {
        self.cache.len()
    }

    /// Check if the cache is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.cache.is_empty()
    }

    /// List all cached shader names.
    pub fn names(&self) -> impl Iterator<Item = &str> {
        self.cache.keys().map(String::as_str)
    }

    /// Read shader source from a file.
    fn read_shader_file(path: &Path) -> ShaderResult<String> {
        std::fs::read_to_string(path)
            .map_err(|e| ShaderError::FileReadError(format!("{}: {}", path.display(), e)))
    }

    /// Compile WGSL source into a shader module.
    fn compile_shader(device: &Device, name: &str, source: &str) -> ShaderModule {
        // wgpu's shader compilation is validation-only on creation
        // Actual compilation happens on first use in a pipeline
        // Errors will be reported by wgpu's error handling system
        device.create_shader_module(ShaderModuleDescriptor {
            label: Some(name),
            source: WgpuSource::Wgsl(source.into()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shader_source_constructors() {
        let embedded = ShaderSource::embedded("fn main() {}");
        assert!(matches!(embedded, ShaderSource::Embedded(_)));

        let file = ShaderSource::file("test.wgsl");
        assert!(matches!(file, ShaderSource::File(_)));

        let processed = ShaderSource::processed("processed source");
        assert!(matches!(processed, ShaderSource::Processed(_)));
    }

    #[test]
    fn test_loader_new() {
        let loader = ShaderLoader::new();
        assert!(loader.shader_dir().is_none());
        assert!(loader.is_empty());
    }

    #[test]
    fn test_loader_with_shader_dir() {
        let loader = ShaderLoader::with_shader_dir("/path/to/shaders");
        assert_eq!(
            loader.shader_dir(),
            Some(Path::new("/path/to/shaders"))
        );
    }

    #[test]
    fn test_set_shader_dir() {
        let mut loader = ShaderLoader::new();
        assert!(loader.shader_dir().is_none());

        loader.set_shader_dir("/new/path");
        assert_eq!(loader.shader_dir(), Some(Path::new("/new/path")));
    }
}
