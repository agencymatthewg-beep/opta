/**
 * TypeScript types for local LLM (Ollama) integration.
 *
 * These types mirror the Rust structs in src-tauri/src/llm.rs and are used
 * by the useLlm hook to interact with the Tauri backend.
 */

/**
 * Ollama service status response.
 */
export interface LlmStatus {
  /** Whether Ollama service is running and accessible */
  running: boolean;
  /** List of installed model names (e.g., ["llama3:8b", "mistral:7b"]) */
  models: string[];
  /** Error message if Ollama is not running or inaccessible */
  error?: string;
}

/**
 * A chat message for LLM conversations.
 */
export interface ChatMessage {
  /** Message role - determines how the model interprets the message */
  role: "user" | "assistant" | "system";
  /** The message content */
  content: string;
}

/**
 * Response from LLM chat completion.
 */
export interface ChatResponse {
  /** Generated response content (null if error occurred) */
  content: string | null;
  /** Model that generated the response */
  model: string;
  /** Whether generation completed successfully */
  done: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Routing preference for hybrid LLM routing.
 */
export type RoutingPreference = "auto" | "local" | "cloud";

/**
 * Response from smart chat with routing info.
 */
export interface SmartChatResponse {
  /** Generated response content (null if error occurred) */
  content: string | null;
  /** Which backend generated the response */
  backend: "local" | "cloud";
  /** Model that generated the response */
  model: string;
  /** Whether generation completed successfully */
  done: boolean;
  /** Error message if generation failed */
  error?: string;
  /** Token usage (only for cloud responses) */
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Result returned from sendMessage with backend info.
 */
export interface ChatResult {
  /** The response content */
  content: string;
  /** Which backend generated the response */
  backend: "local" | "cloud";
  /** Model that generated the response */
  model: string;
}
