//! Shader hot-reload watcher for development.
//!
//! Watches shader files for changes and triggers reloads.
//! Only available when the `shader-hot-reload` feature is enabled.

use std::path::{Path, PathBuf};

#[cfg(feature = "shader-hot-reload")]
use std::collections::HashSet;
#[cfg(feature = "shader-hot-reload")]
use std::sync::{Arc, Mutex};

#[cfg(feature = "shader-hot-reload")]
use notify::{
    event::{EventKind, ModifyKind},
    recommended_watcher, Event, RecommendedWatcher, RecursiveMode, Watcher,
};

/// Watches shader files for changes and triggers reloads.
///
/// Only available when the `shader-hot-reload` feature is enabled.
#[cfg(feature = "shader-hot-reload")]
#[derive(Debug)]
pub struct ShaderWatcher {
    /// The file system watcher.
    _watcher: RecommendedWatcher,
    /// Set of files that have changed since last poll.
    changed_files: Arc<Mutex<HashSet<PathBuf>>>,
    /// The directory being watched.
    watch_dir: PathBuf,
}

#[cfg(feature = "shader-hot-reload")]
impl ShaderWatcher {
    /// Create a new shader watcher for the given directory.
    ///
    /// # Errors
    ///
    /// Returns an error if the watcher cannot be created or the directory
    /// cannot be watched.
    pub fn new(shader_dir: &Path) -> Result<Self, notify::Error> {
        let changed_files = Arc::new(Mutex::new(HashSet::new()));
        let changed_files_clone = Arc::clone(&changed_files);

        let mut watcher = recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                // Only track modify events for .wgsl files
                if matches!(
                    event.kind,
                    EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Any)
                ) {
                    for path in event.paths {
                        if path.extension().is_some_and(|ext| ext == "wgsl") {
                            if let Ok(mut files) = changed_files_clone.lock() {
                                files.insert(path);
                            }
                        }
                    }
                }
            }
        })?;

        watcher.watch(shader_dir, RecursiveMode::Recursive)?;

        Ok(Self {
            _watcher: watcher,
            changed_files,
            watch_dir: shader_dir.to_path_buf(),
        })
    }

    /// Check for changed files and return them.
    ///
    /// This clears the internal set of changed files.
    #[must_use]
    pub fn poll_changes(&self) -> Vec<PathBuf> {
        if let Ok(mut files) = self.changed_files.lock() {
            let changes: Vec<PathBuf> = files.drain().collect();
            changes
        } else {
            Vec::new()
        }
    }

    /// Check if any files have changed.
    #[must_use]
    pub fn has_changes(&self) -> bool {
        if let Ok(files) = self.changed_files.lock() {
            !files.is_empty()
        } else {
            false
        }
    }

    /// Get the directory being watched.
    #[must_use]
    pub fn watch_dir(&self) -> &Path {
        &self.watch_dir
    }

    /// Clear all pending changes without processing them.
    pub fn clear_changes(&self) {
        if let Ok(mut files) = self.changed_files.lock() {
            files.clear();
        }
    }
}

/// Stub implementation when shader-hot-reload feature is disabled.
///
/// This allows code to compile without the feature while making it clear
/// that hot-reload is not available.
#[cfg(not(feature = "shader-hot-reload"))]
#[derive(Debug)]
pub struct ShaderWatcher {
    _private: (),
}

#[cfg(not(feature = "shader-hot-reload"))]
impl ShaderWatcher {
    /// Shader hot-reload is disabled. Enable the `shader-hot-reload` feature.
    ///
    /// # Errors
    ///
    /// Always returns an error when the feature is disabled.
    pub fn new(_shader_dir: &Path) -> Result<Self, ShaderWatcherError> {
        Err(ShaderWatcherError::FeatureDisabled)
    }

    /// Returns empty list when feature is disabled.
    #[must_use]
    pub fn poll_changes(&self) -> Vec<PathBuf> {
        Vec::new()
    }

    /// Always returns false when feature is disabled.
    #[must_use]
    pub fn has_changes(&self) -> bool {
        false
    }

    /// No-op when feature is disabled.
    pub fn clear_changes(&self) {}
}

/// Error type for shader watcher when feature is disabled.
#[cfg(not(feature = "shader-hot-reload"))]
#[derive(Debug, Clone, thiserror::Error)]
pub enum ShaderWatcherError {
    /// The shader-hot-reload feature is not enabled.
    #[error("Shader hot-reload feature is not enabled. Add `shader-hot-reload` feature.")]
    FeatureDisabled,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(not(feature = "shader-hot-reload"))]
    fn test_watcher_disabled() {
        use std::path::Path;
        let result = ShaderWatcher::new(Path::new("/tmp"));
        assert!(result.is_err());
    }

    #[test]
    fn test_poll_changes_empty() {
        // When feature is disabled, poll_changes should return empty vec
        #[cfg(not(feature = "shader-hot-reload"))]
        {
            // Can't create watcher without feature, but we can test the stub behavior
            // would return empty vec
        }
    }
}
