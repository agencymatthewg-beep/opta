/**
 * React hook for Claude API (cloud AI) integration.
 *
 * Provides access to Claude API capabilities via Tauri commands.
 * Handles missing API key gracefully with clear error messages.
 *
 * Note: API key is managed via environment variable (ANTHROPIC_API_KEY),
 * not through the UI for security reasons.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ClaudeStatus } from '../types/claude';

/**
 * Session usage tracking for Claude API.
 */
export interface SessionUsage {
  /** Total input tokens used this session */
  totalInputTokens: number;
  /** Total output tokens used this session */
  totalOutputTokens: number;
  /** Number of requests made this session */
  requestCount: number;
}

/**
 * Return type for useClaude hook.
 */
export interface UseClaudeResult {
  /** Current Claude API status, null if not yet checked */
  status: ClaudeStatus | null;
  /** Whether initial status check is in progress */
  loading: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Manually check Claude API status */
  checkStatus: () => Promise<void>;
  /** Session usage statistics */
  sessionUsage: SessionUsage;
}

/**
 * Hook to check Claude API status and track session usage.
 *
 * This hook is primarily for status checking and usage display.
 * For chat functionality, see useLlm which provides the full chat interface.
 *
 * @returns Claude status, loading state, error, and session usage
 *
 * @example
 * ```tsx
 * const { status, loading, error, sessionUsage } = useClaude();
 *
 * if (loading) return <Spinner />;
 * if (!status?.available) return <div>Claude API not configured</div>;
 *
 * // Display status and usage in Settings
 * ```
 */
export function useClaude(): UseClaudeResult {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Session usage tracking - setter available for future chat integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sessionUsage, _setSessionUsage] = useState<SessionUsage>({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    requestCount: 0,
  });

  // Track if component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  /**
   * Check Claude API status.
   * Called on mount and available for manual refresh.
   */
  const checkStatus = useCallback(async () => {
    try {
      const data = await invoke<ClaudeStatus>('claude_status');

      if (mountedRef.current) {
        setStatus(data);
        // Clear error if status check succeeded
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        setStatus({
          available: false,
          error: errorMessage,
        });
        console.error('Claude status check error:', errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
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
    checkStatus,
    sessionUsage,
  };
}

export default useClaude;
