/**
 * React hook for hybrid LLM integration (Ollama + Claude).
 *
 * Provides access to LLM capabilities via Tauri commands with intelligent
 * routing between local Ollama and cloud Claude based on query complexity.
 *
 * Features:
 * - Auto routing: Uses query classifier to choose backend
 * - Local only: Always use Ollama (free, private)
 * - Cloud only: Always use Claude (better reasoning)
 * - Backend indicator: Know which AI answered
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  LlmStatus,
  ChatMessage,
  SmartChatResponse,
  RoutingPreference,
  ChatResult,
} from '../types/llm';

/**
 * Options for useLlm hook.
 */
export interface UseLlmOptions {
  /** Initial routing preference (default: "auto") */
  routingPreference?: RoutingPreference;
}

/**
 * Return type for useLlm hook.
 */
export interface UseLlmResult {
  /** Current Ollama status, null if not yet checked */
  status: LlmStatus | null;
  /** Whether initial status check is in progress */
  loading: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Send a message and get a response with backend info */
  sendMessage: (message: string, systemPrompt?: string) => Promise<ChatResult>;
  /** Manually check Ollama status */
  checkStatus: () => Promise<void>;
  /** Current conversation history */
  conversationHistory: ChatMessage[];
  /** Clear conversation history */
  clearConversation: () => void;
  /** Whether a chat request is in progress */
  chatLoading: boolean;
  /** Current routing preference */
  routingPreference: RoutingPreference;
  /** Update routing preference */
  setRoutingPreference: (preference: RoutingPreference) => void;
  /** Last response backend ("local" or "cloud") */
  lastBackend: "local" | "cloud" | null;
}

/**
 * Default system prompt for Opta's optimization assistant.
 * Note: This is used by the Python backend, kept here for reference.
 */
const _DEFAULT_SYSTEM_PROMPT = `You are Opta, a helpful PC optimization assistant. You provide clear, actionable advice for improving system performance, managing resources, and optimizing settings for gaming and productivity.

Guidelines:
- Be concise and practical
- Explain the "why" behind recommendations
- Warn about potential risks when relevant
- Focus on Windows/macOS optimizations`;

// Prevent unused variable warning - prompt is managed by Python backend
void _DEFAULT_SYSTEM_PROMPT;

/**
 * Hook to interact with LLM via smart routing.
 *
 * @param options - Optional configuration for the hook
 * @returns LLM status, loading state, error, and interaction functions
 *
 * @example
 * ```tsx
 * const { status, loading, error, sendMessage, chatLoading, routingPreference, setRoutingPreference } = useLlm();
 *
 * if (loading) return <Spinner />;
 * if (!status?.running) return <div>Ollama not running</div>;
 *
 * const handleSubmit = async (question: string) => {
 *   const result = await sendMessage(question);
 *   console.log('AI Response:', result.content);
 *   console.log('Backend used:', result.backend);
 * };
 * ```
 */
export function useLlm(options: UseLlmOptions = {}): UseLlmResult {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [routingPreference, setRoutingPreference] = useState<RoutingPreference>(
    options.routingPreference ?? "auto"
  );
  const [lastBackend, setLastBackend] = useState<"local" | "cloud" | null>(null);

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  /**
   * Check Ollama service status.
   * Called on mount and available for manual refresh.
   */
  const checkStatus = useCallback(async () => {
    try {
      const data = await invoke<LlmStatus>('llm_status');

      if (mountedRef.current) {
        setStatus(data);
        // Clear error if status check succeeded (even if Ollama isn't running)
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        setStatus({
          running: false,
          models: [],
          error: errorMessage,
        });
        console.error('LLM status check error:', errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Send a message using smart routing.
   *
   * @param message - The user's message
   * @param systemPrompt - Optional custom system prompt (uses default if not provided)
   * @returns ChatResult with content, backend, and model info
   * @throws Error if the request fails
   */
  const sendMessage = useCallback(async (
    message: string,
    _systemPrompt?: string
  ): Promise<ChatResult> => {
    setChatLoading(true);
    setError(null);

    try {
      // Use smart_chat MCP tool which handles routing
      const response = await invoke<SmartChatResponse>('smart_chat', {
        message,
        prefer: routingPreference,
        model: null, // Use default model
      });

      if (!response.done || response.error) {
        const errorMsg = response.error || 'Failed to generate response';
        throw new Error(errorMsg);
      }

      const assistantMessage = response.content || '';
      const backend = response.backend || 'local';
      const model = response.model || 'unknown';

      // Update last backend
      if (mountedRef.current) {
        setLastBackend(backend);
      }

      // Update conversation history if mounted
      if (mountedRef.current) {
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage },
        ]);
      }

      return {
        content: assistantMessage,
        backend,
        model,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (mountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (mountedRef.current) {
        setChatLoading(false);
      }
    }
  }, [routingPreference]);

  /**
   * Clear conversation history for a fresh start.
   */
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setLastBackend(null);
  }, []);

  // Check status on mount (but don't poll continuously - it's expensive)
  useEffect(() => {
    mountedRef.current = true;

    // Initial status check
    checkStatus();

    return () => {
      mountedRef.current = false;
    };
  }, [checkStatus]);

  return {
    status,
    loading,
    error,
    sendMessage,
    checkStatus,
    conversationHistory,
    clearConversation,
    chatLoading,
    routingPreference,
    setRoutingPreference,
    lastBackend,
  };
}

export default useLlm;
