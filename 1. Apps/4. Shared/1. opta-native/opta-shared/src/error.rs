//! Error types for Opta
//!
//! Unified error handling across all Opta crates.

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Main error type for Opta operations
#[derive(Error, Debug, Clone, Serialize, Deserialize)]
pub enum OptaError {
    /// Platform-specific operation failed
    #[error("Platform error: {message}")]
    Platform {
        message: String,
        code: Option<i32>,
    },

    /// Telemetry collection failed
    #[error("Telemetry error: {message}")]
    Telemetry { message: String },

    /// Process operation failed
    #[error("Process error: {message}")]
    Process {
        message: String,
        pid: Option<u32>,
    },

    /// Game detection failed
    #[error("Game detection error: {message}")]
    GameDetection { message: String },

    /// Optimization operation failed
    #[error("Optimization error: {message}")]
    Optimization { message: String },

    /// Storage/persistence error
    #[error("Storage error: {message}")]
    Storage { message: String },

    /// Network operation failed
    #[error("Network error: {message}")]
    Network { message: String },

    /// Permission denied
    #[error("Permission denied: {message}")]
    Permission { message: String },

    /// Resource not found
    #[error("Not found: {resource}")]
    NotFound { resource: String },

    /// Invalid input or configuration
    #[error("Invalid input: {message}")]
    InvalidInput { message: String },

    /// Operation timed out
    #[error("Operation timed out after {timeout_ms}ms: {operation}")]
    Timeout { operation: String, timeout_ms: u64 },

    /// Internal error (bug)
    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl OptaError {
    /// Create a platform error
    pub fn platform(message: impl Into<String>) -> Self {
        Self::Platform {
            message: message.into(),
            code: None,
        }
    }

    /// Create a platform error with code
    pub fn platform_with_code(message: impl Into<String>, code: i32) -> Self {
        Self::Platform {
            message: message.into(),
            code: Some(code),
        }
    }

    /// Create a telemetry error
    pub fn telemetry(message: impl Into<String>) -> Self {
        Self::Telemetry {
            message: message.into(),
        }
    }

    /// Create a process error
    pub fn process(message: impl Into<String>) -> Self {
        Self::Process {
            message: message.into(),
            pid: None,
        }
    }

    /// Create a process error with PID
    pub fn process_with_pid(message: impl Into<String>, pid: u32) -> Self {
        Self::Process {
            message: message.into(),
            pid: Some(pid),
        }
    }

    /// Create a game detection error
    pub fn game_detection(message: impl Into<String>) -> Self {
        Self::GameDetection {
            message: message.into(),
        }
    }

    /// Create an optimization error
    pub fn optimization(message: impl Into<String>) -> Self {
        Self::Optimization {
            message: message.into(),
        }
    }

    /// Create a storage error
    pub fn storage(message: impl Into<String>) -> Self {
        Self::Storage {
            message: message.into(),
        }
    }

    /// Create a network error
    pub fn network(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    /// Create a permission error
    pub fn permission(message: impl Into<String>) -> Self {
        Self::Permission {
            message: message.into(),
        }
    }

    /// Create a not found error
    pub fn not_found(resource: impl Into<String>) -> Self {
        Self::NotFound {
            resource: resource.into(),
        }
    }

    /// Create an invalid input error
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::InvalidInput {
            message: message.into(),
        }
    }

    /// Create a timeout error
    pub fn timeout(operation: impl Into<String>, timeout_ms: u64) -> Self {
        Self::Timeout {
            operation: operation.into(),
            timeout_ms,
        }
    }

    /// Create an internal error
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            Self::Timeout { .. } | Self::Network { .. } | Self::Process { .. }
        )
    }

    /// Get error code if available
    pub fn code(&self) -> Option<i32> {
        match self {
            Self::Platform { code, .. } => *code,
            _ => None,
        }
    }
}

/// Result type alias for Opta operations
pub type OptaResult<T> = Result<T, OptaError>;

/// Error context for logging and debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorContext {
    /// The error that occurred
    pub error: OptaError,
    /// When the error occurred (Unix epoch ms)
    pub timestamp: u64,
    /// Operation that was being performed
    pub operation: String,
    /// Additional context data
    pub context: std::collections::HashMap<String, String>,
}

impl ErrorContext {
    /// Create a new error context
    pub fn new(error: OptaError, operation: impl Into<String>) -> Self {
        Self {
            error,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            operation: operation.into(),
            context: std::collections::HashMap::new(),
        }
    }

    /// Add context data
    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }
}
