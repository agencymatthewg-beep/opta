/**
 * React hook for local LLM (Ollama) integration.
 *
 * Provides access to local LLM capabilities via Tauri commands.
 * Handles Ollama not running gracefully with clear error messages.
 *
 * Note: This is a non-streaming implementation. Streaming will be added in Plan 05-02.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { LlmStatus, ChatMessage, ChatResponse } from '../types/llm';

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
  /** Send a message to the LLM and get a response */
  sendMessage: (message: string, systemPrompt?: string) => Promise<string>;
  /** Manually check Ollama status */
  checkStatus: () => Promise<void>;
  /** Current conversation history */
  conversationHistory: ChatMessage[];
  /** Clear conversation history */
  clearConversation: () => void;
  /** Whether a chat request is in progress */
  chatLoading: boolean;
}

/**
 * Default system prompt for Opta's optimization assistant.
 */
const DEFAULT_SYSTEM_PROMPT = `You are Opta, a helpful PC optimization assistant. You provide clear, actionable advice for improving system performance, managing resources, and optimizing settings for gaming and productivity.

Guidelines:
- Be concise and practical
- Explain the "why" behind recommendations
- Warn about potential risks when relevant
- Focus on Windows/macOS optimizations`;

/**
 * Hook to interact with local LLM via Ollama.
 *
 * @returns LLM status, loading state, error, and interaction functions
 *
 * @example
 * ```tsx
 * const { status, loading, error, sendMessage, chatLoading } = useLlm();
 *
 * if (loading) return <Spinner />;
 * if (!status?.running) return <div>Ollama not running</div>;
 *
 * const handleSubmit = async (question: string) => {
 *   const response = await sendMessage(question);
 *   console.log('AI Response:', response);
 * };
 * ```
 */
export function useLlm(): UseLlmResult {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);

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
   * Send a message to the LLM and get a response.
   *
   * @param message - The user's message
   * @param systemPrompt - Optional custom system prompt (uses default if not provided)
   * @returns The LLM's response text
   * @throws Error if the request fails
   */
  const sendMessage = useCallback(async (
    message: string,
    systemPrompt?: string
  ): Promise<string> => {
    setChatLoading(true);
    setError(null);

    try {
      // Build messages array with system prompt and history
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        },
        ...conversationHistory,
        {
          role: 'user',
          content: message,
        },
      ];

      const response = await invoke<ChatResponse>('llm_chat', {
        messages,
        model: null, // Use default model (llama3:8b)
      });

      if (!response.done || response.error) {
        const errorMsg = response.error || 'Failed to generate response';
        throw new Error(errorMsg);
      }

      const assistantMessage = response.content || '';

      // Update conversation history if mounted
      if (mountedRef.current) {
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage },
        ]);
      }

      return assistantMessage;
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
  }, [conversationHistory]);

  /**
   * Clear conversation history for a fresh start.
   */
  const clearConversation = useCallback(() => {
    setConversationHistory([]);
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
  };
}

export default useLlm;
