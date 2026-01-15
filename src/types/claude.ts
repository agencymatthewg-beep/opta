/**
 * TypeScript types for Claude API integration.
 *
 * These types mirror the Rust structs in src-tauri/src/claude.rs and are used
 * by the useClaude hook to interact with the Tauri backend.
 */

/**
 * Claude API status response.
 */
export interface ClaudeStatus {
  /** Whether Claude API is configured and available */
  available: boolean;
  /** The Claude model being used (e.g., "claude-sonnet-4-20250514") */
  model?: string;
  /** Error message if API is not available */
  error?: string;
}

/**
 * Token usage from Claude API response.
 */
export interface ClaudeUsage {
  /** Number of input tokens in the request */
  input_tokens: number;
  /** Number of output tokens in the response */
  output_tokens: number;
}

/**
 * Response from Claude chat completion.
 */
export interface ClaudeResponse {
  /** Generated response content (null if error) */
  content: string | null;
  /** Model that generated the response */
  model: string | null;
  /** Token usage statistics */
  usage: ClaudeUsage | null;
  /** Error message if request failed */
  error?: string;
}

/**
 * A chat message for Claude conversations.
 */
export interface ClaudeChatMessage {
  /** Message role - "user" or "assistant" */
  role: "user" | "assistant";
  /** The message content */
  content: string;
}
