//! Claude API integration module for Opta.
//!
//! This module provides Tauri commands to interact with Anthropic's Claude API
//! for complex reasoning queries. Enables high-quality AI responses for
//! optimization questions that benefit from Claude's capabilities.
//!
//! Follows the same subprocess pattern as other modules - invokes Python
//! functions from the opta_mcp package.

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Claude API status response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeStatus {
    /// Whether Claude API is configured and available
    pub available: bool,
    /// The Claude model being used (e.g., "claude-sonnet-4-20250514")
    pub model: Option<String>,
    /// Error message if API is not available
    pub error: Option<String>,
}

/// Token usage from Claude API response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeUsage {
    /// Number of input tokens in the request
    pub input_tokens: u32,
    /// Number of output tokens in the response
    pub output_tokens: u32,
}

/// Response from Claude chat completion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResponse {
    /// Generated response content (None if error)
    pub content: Option<String>,
    /// Model that generated the response
    pub model: Option<String>,
    /// Token usage statistics
    pub usage: Option<ClaudeUsage>,
    /// Error message if request failed
    pub error: Option<String>,
}

/// A chat message for Claude conversations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeChatMessage {
    /// Message role: "user" or "assistant"
    pub role: String,
    /// Message content
    pub content: String,
}

/// Python script to check Claude API status.
const CLAUDE_STATUS_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.claude import check_claude_status
    result = check_claude_status()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "available": False,
        "model": None,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Python script template for Claude chat completion.
/// Uses %MESSAGES% and %SYSTEM_PROMPT% as placeholders.
const CLAUDE_CHAT_SCRIPT_TEMPLATE: &str = r#"
import json
import sys

try:
    from opta_mcp.claude import chat_completion
    messages = %MESSAGES%
    system_prompt = %SYSTEM_PROMPT%
    result = chat_completion(messages, system_prompt)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "content": None,
        "model": None,
        "usage": None,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Get Python command for the current platform.
fn python_cmd() -> &'static str {
    if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    }
}

/// Check Claude API status.
///
/// Returns whether the Claude API is configured and available.
/// Does not make an actual API call to avoid costs.
///
/// # Returns
///
/// A `ClaudeStatus` with availability state and any error message.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn claude_status() -> Result<ClaudeStatus, String> {
    let output = Command::new(python_cmd())
        .arg("-c")
        .arg(CLAUDE_STATUS_SCRIPT)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: ClaudeStatus = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Send a chat message to Claude API.
///
/// Sends messages to Claude for chat completion. Uses Claude Sonnet.
/// Handles missing API key and other errors gracefully.
///
/// # Arguments
///
/// * `messages` - List of chat messages with role and content
/// * `system_prompt` - Optional system prompt to guide Claude's behavior
///
/// # Returns
///
/// A `ClaudeResponse` with the generated content and usage statistics.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn claude_chat(
    messages: Vec<ClaudeChatMessage>,
    system_prompt: Option<String>,
) -> Result<ClaudeResponse, String> {
    // Serialize messages to JSON for Python
    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    // Format system prompt for Python (None becomes Python None)
    let system_prompt_str = match system_prompt {
        Some(ref prompt) => format!("\"{}\"", prompt.replace('\"', "\\\"")),
        None => "None".to_string(),
    };

    // Build the script with messages and system prompt
    let script = CLAUDE_CHAT_SCRIPT_TEMPLATE
        .replace("%MESSAGES%", &messages_json)
        .replace("%SYSTEM_PROMPT%", &system_prompt_str);

    let output = Command::new(python_cmd())
        .arg("-c")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: ClaudeResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_status_serialize() {
        let status = ClaudeStatus {
            available: true,
            model: Some("claude-sonnet-4-20250514".to_string()),
            error: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"available\":true"));
        assert!(json.contains("claude-sonnet-4-20250514"));
    }

    #[test]
    fn test_claude_status_deserialize_available() {
        let json = r#"{
            "available": true,
            "model": "claude-sonnet-4-20250514",
            "error": null
        }"#;

        let status: ClaudeStatus = serde_json::from_str(json).unwrap();
        assert!(status.available);
        assert_eq!(status.model, Some("claude-sonnet-4-20250514".to_string()));
        assert!(status.error.is_none());
    }

    #[test]
    fn test_claude_status_deserialize_not_available() {
        let json = r#"{
            "available": false,
            "model": null,
            "error": "API key not configured"
        }"#;

        let status: ClaudeStatus = serde_json::from_str(json).unwrap();
        assert!(!status.available);
        assert!(status.model.is_none());
        assert_eq!(status.error, Some("API key not configured".to_string()));
    }

    #[test]
    fn test_claude_usage_deserialize() {
        let json = r#"{
            "input_tokens": 150,
            "output_tokens": 250
        }"#;

        let usage: ClaudeUsage = serde_json::from_str(json).unwrap();
        assert_eq!(usage.input_tokens, 150);
        assert_eq!(usage.output_tokens, 250);
    }

    #[test]
    fn test_claude_response_deserialize_success() {
        let json = r#"{
            "content": "Here's how to optimize your system...",
            "model": "claude-sonnet-4-20250514",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 200
            },
            "error": null
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert!(response.content.is_some());
        assert!(response.model.is_some());
        assert!(response.usage.is_some());
        assert!(response.error.is_none());
    }

    #[test]
    fn test_claude_response_deserialize_error() {
        let json = r#"{
            "content": null,
            "model": null,
            "usage": null,
            "error": "API key not configured"
        }"#;

        let response: ClaudeResponse = serde_json::from_str(json).unwrap();
        assert!(response.content.is_none());
        assert!(response.error.is_some());
    }

    #[test]
    fn test_claude_chat_message_serialize() {
        let message = ClaudeChatMessage {
            role: "user".to_string(),
            content: "How can I optimize my system?".to_string(),
        };

        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("optimize my system"));
    }
}
