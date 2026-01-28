//! Local LLM integration module for Opta.
//!
//! This module provides Tauri commands to interact with Ollama for local LLM
//! inference. Enables zero-cost AI queries for routine optimization questions
//! using locally-running Llama 3.
//!
//! Follows the same subprocess pattern as other modules - invokes Python
//! functions from the opta_mcp package.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::command;
use tokio::process::Command;
use tokio::time::timeout;

/// Default timeout for Python subprocess calls (30 seconds).
const SUBPROCESS_TIMEOUT: Duration = Duration::from_secs(30);

/// Run a Python command with timeout protection.
async fn run_python_with_timeout(script: &str) -> Result<String, String> {
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let mut cmd = Command::new(python_cmd);
    cmd.arg("-c").arg(script);

    let output_future = cmd.output();

    match timeout(SUBPROCESS_TIMEOUT, output_future).await {
        Ok(Ok(output)) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Python error: {}", stderr));
            }
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        Ok(Err(e)) => Err(format!("Failed to spawn Python: {}", e)),
        Err(_) => Err(format!(
            "Python subprocess timed out after {} seconds",
            SUBPROCESS_TIMEOUT.as_secs()
        )),
    }
}

/// Ollama service status response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmStatus {
    /// Whether Ollama service is running
    pub running: bool,
    /// List of installed model names
    pub models: Vec<String>,
    /// Error message if Ollama not running
    pub error: Option<String>,
}

/// A chat message for LLM conversations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Message role: "system", "user", or "assistant"
    pub role: String,
    /// Message content
    pub content: String,
}

/// Response from LLM chat completion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Generated response content (None if error)
    pub content: Option<String>,
    /// Model that generated the response
    pub model: String,
    /// Whether generation completed successfully
    pub done: bool,
    /// Error message if generation failed
    pub error: Option<String>,
}

/// Response from smart chat with routing info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartChatResponse {
    /// Generated response content (None if error)
    pub content: Option<String>,
    /// Which backend generated the response ("local" or "cloud")
    pub backend: String,
    /// Model that generated the response
    pub model: String,
    /// Whether generation completed successfully
    pub done: bool,
    /// Error message if generation failed
    pub error: Option<String>,
    /// Token usage (only for cloud responses)
    pub usage: Option<TokenUsage>,
}

/// Token usage info for cloud responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// Python script to check Ollama status.
const LLM_STATUS_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.llm import check_ollama_status
    result = check_ollama_status()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "running": False,
        "models": [],
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Python script template for smart chat with routing.
/// Uses %MESSAGE%, %PREFER%, and %MODEL% as placeholders.
const SMART_CHAT_SCRIPT_TEMPLATE: &str = r#"
import json
import sys

try:
    from opta_mcp.router import smart_chat
    message = %MESSAGE%
    prefer = "%PREFER%"
    model = %MODEL%
    result = smart_chat(message, prefer, model)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "content": None,
        "backend": "local",
        "model": "unknown",
        "done": False,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Python script template for chat completion.
/// Uses %MESSAGES% and %MODEL% as placeholders.
const LLM_CHAT_SCRIPT_TEMPLATE: &str = r#"
import json
import sys

try:
    from opta_mcp.llm import chat_completion
    messages = %MESSAGES%
    model = "%MODEL%"
    result = chat_completion(messages, model)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "content": None,
        "model": "%MODEL%",
        "done": False,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Check Ollama LLM service status.
///
/// Returns whether Ollama is running and lists available models.
/// Handles Ollama not running gracefully with clear error messages.
///
/// # Returns
///
/// An `LlmStatus` with running state, available models, and any error.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn llm_status() -> Result<LlmStatus, String> {
    let stdout = run_python_with_timeout(LLM_STATUS_SCRIPT).await?;

    let result: LlmStatus = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Send a chat message to the local LLM.
///
/// Sends messages to Ollama for chat completion. Uses Llama 3 8B by default.
/// Handles Ollama not running and model not found gracefully.
///
/// # Arguments
///
/// * `messages` - List of chat messages with role and content
/// * `model` - Optional model name (default: "llama3:8b")
///
/// # Returns
///
/// A `ChatResponse` with the generated content and completion status.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn llm_chat(
    messages: Vec<ChatMessage>,
    model: Option<String>,
) -> Result<ChatResponse, String> {
    let model_name = model.unwrap_or_else(|| "llama3:8b".to_string());

    // Serialize messages to JSON for Python
    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    // Build the script with messages and model
    let script = LLM_CHAT_SCRIPT_TEMPLATE
        .replace("%MESSAGES%", &messages_json)
        .replace("%MODEL%", &model_name);

    let stdout = run_python_with_timeout(&script).await?;

    let result: ChatResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Smart chat with automatic routing between local and cloud backends.
///
/// Routes queries to the most appropriate backend based on complexity:
/// - Simple queries go to local Ollama (free, private)
/// - Complex queries go to Claude (better reasoning)
/// - User can override with `prefer` parameter
///
/// # Arguments
///
/// * `message` - The user's message
/// * `prefer` - Routing preference: "auto", "local", or "cloud"
/// * `model` - Optional model override for local backend
///
/// # Returns
///
/// A `SmartChatResponse` with content, backend used, and model info.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn smart_chat(
    message: String,
    prefer: Option<String>,
    model: Option<String>,
) -> Result<SmartChatResponse, String> {
    let prefer_value = prefer.unwrap_or_else(|| "auto".to_string());

    // Serialize message to JSON for Python
    let message_json = serde_json::to_string(&message)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;

    // Handle model as None or the actual value for Python
    let model_str = match &model {
        Some(m) => format!("\"{}\"", m),
        None => "None".to_string(),
    };

    // Build the script with message, prefer, and model
    let script = SMART_CHAT_SCRIPT_TEMPLATE
        .replace("%MESSAGE%", &message_json)
        .replace("%PREFER%", &prefer_value)
        .replace("%MODEL%", &model_str);

    let stdout = run_python_with_timeout(&script).await?;

    let result: SmartChatResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_status_serialize() {
        let status = LlmStatus {
            running: true,
            models: vec!["llama3:8b".to_string(), "mistral:7b".to_string()],
            error: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"running\":true"));
        assert!(json.contains("llama3:8b"));
        assert!(json.contains("mistral:7b"));
    }

    #[test]
    fn test_llm_status_deserialize_running() {
        let json = r#"{
            "running": true,
            "models": ["llama3:8b", "codellama:7b"],
            "error": null
        }"#;

        let status: LlmStatus = serde_json::from_str(json).unwrap();
        assert!(status.running);
        assert_eq!(status.models.len(), 2);
        assert!(status.error.is_none());
    }

    #[test]
    fn test_llm_status_deserialize_not_running() {
        let json = r#"{
            "running": false,
            "models": [],
            "error": "Ollama is not running"
        }"#;

        let status: LlmStatus = serde_json::from_str(json).unwrap();
        assert!(!status.running);
        assert!(status.models.is_empty());
        assert_eq!(status.error, Some("Ollama is not running".to_string()));
    }

    #[test]
    fn test_chat_message_serialize() {
        let message = ChatMessage {
            role: "user".to_string(),
            content: "How can I optimize my RAM?".to_string(),
        };

        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("optimize my RAM"));
    }

    #[test]
    fn test_chat_response_deserialize_success() {
        let json = r#"{
            "content": "Here are some ways to optimize your RAM...",
            "model": "llama3:8b",
            "done": true,
            "error": null
        }"#;

        let response: ChatResponse = serde_json::from_str(json).unwrap();
        assert!(response.content.is_some());
        assert!(response.done);
        assert!(response.error.is_none());
        assert_eq!(response.model, "llama3:8b");
    }

    #[test]
    fn test_chat_response_deserialize_error() {
        let json = r#"{
            "content": null,
            "model": "llama3:8b",
            "done": false,
            "error": "Ollama is not running. Start it with: ollama serve"
        }"#;

        let response: ChatResponse = serde_json::from_str(json).unwrap();
        assert!(response.content.is_none());
        assert!(!response.done);
        assert!(response.error.is_some());
    }

    #[test]
    fn test_messages_to_json() {
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are a PC optimization assistant.".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: "How can I free up RAM?".to_string(),
            },
        ];

        let json = serde_json::to_string(&messages).unwrap();
        assert!(json.contains("system"));
        assert!(json.contains("user"));
        assert!(json.contains("PC optimization"));
        assert!(json.contains("free up RAM"));
    }
}
