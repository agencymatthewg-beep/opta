/**
 * React hook for game session management.
 *
 * Handles session lifecycle, process polling, telemetry tracking,
 * and session summary generation with real metrics.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  GameSession,
  SessionTelemetry,
  SessionSummary,
  GameRunningStatus,
  LaunchConfig,
} from '../types/launcher';
import type { DetectedGame } from '../types/games';
import type { StealthModeResult } from '../types/processes';

/** Polling interval when app is focused (ms) */
const POLL_INTERVAL_FOCUSED = 2000;

/** Polling interval when app is in background (ms) */
const POLL_INTERVAL_BACKGROUND = 5000;

/** Timeout for game startup detection (ms) */
const STARTUP_TIMEOUT = 30000;

/** Storage key for session history persistence */
const SESSION_HISTORY_KEY = 'opta-session-history';

/** Maximum number of sessions to keep in history */
const MAX_SESSION_HISTORY = 50;

/**
 * Metrics tracked during an active session.
 */
interface SessionMetrics {
  /** Memory freed by Stealth Mode in MB */
  memoryFreedMb: number;
  /** Number of optimizations applied */
  optimizationsApplied: number;
}

/**
 * Return type for useGameSession hook.
 */
export interface UseGameSessionResult {
  /** Current active session (if any) */
  session: GameSession | null;
  /** Start a new game session */
  startSession: (game: DetectedGame, config?: LaunchConfig) => void;
  /** End the current session */
  endSession: () => void;
  /** Whether a session is currently active */
  isActive: boolean;
  /** Current telemetry data */
  telemetry: SessionTelemetry | null;
  /** Session summary (after session ends) */
  summary: SessionSummary | null;
  /** Clear the summary to dismiss the modal */
  clearSummary: () => void;
  /** Error message if something failed */
  error: string | null;
  /** Update session with stealth mode result */
  handleStealthModeResult: (result: StealthModeResult) => void;
  /** Update session with optimization count */
  setOptimizationsApplied: (count: number) => void;
  /** Session history (persisted across restarts) */
  sessionHistory: SessionSummary[];
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook to manage game sessions with process polling.
 *
 * @example
 * ```tsx
 * const { session, startSession, endSession, telemetry, summary } = useGameSession();
 *
 * // Start session after launching game
 * startSession(game);
 *
 * // Session will automatically detect when game exits
 * // and generate a summary
 * ```
 */
export function useGameSession(): UseGameSessionResult {
  const [session, setSession] = useState<GameSession | null>(null);
  const [telemetry, setTelemetry] = useState<SessionTelemetry | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Session metrics from pre-launch actions (stealth mode, optimizations)
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
    memoryFreedMb: 0,
    optimizationsApplied: 0,
  });

  // Session history persisted to localStorage
  const [sessionHistory, setSessionHistory] = useState<SessionSummary[]>(() => {
    try {
      const saved = localStorage.getItem(SESSION_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Refs for polling
  const pollIntervalRef = useRef<number | null>(null);
  const startupTimeoutRef = useRef<number | null>(null);
  const telemetryHistoryRef = useRef<SessionTelemetry[]>([]);
  const sessionMetricsRef = useRef<SessionMetrics>(sessionMetrics);

  // Track if game has been detected as running at least once
  const gameDetectedRef = useRef(false);

  // Keep ref in sync with state
  sessionMetricsRef.current = sessionMetrics;

  /**
   * Check if the game process is running.
   */
  const checkGameRunning = useCallback(async (gameId: string): Promise<GameRunningStatus> => {
    try {
      const processNames = await invoke<string[]>('get_game_process_names', { gameId });
      if (processNames.length === 0) {
        return { running: false, pid: null, processName: null, cpuPercent: null, memoryMb: null };
      }

      const status = await invoke<GameRunningStatus>('check_game_running', { processNames });
      return status;
    } catch (e) {
      console.error('Failed to check game running:', e);
      return { running: false, pid: null, processName: null, cpuPercent: null, memoryMb: null };
    }
  }, []);

  /**
   * Generate session summary from telemetry history using real metrics.
   */
  const generateSummary = useCallback((sess: GameSession): SessionSummary => {
    const history = telemetryHistoryRef.current;
    const metrics = sessionMetricsRef.current;
    const endTime = Date.now();
    const durationMs = endTime - sess.startedAt;

    // Calculate averages and peaks from history
    let avgCpu = 0;
    let avgGpu = 0;
    let avgRam = 0;
    let peakCpu = 0;
    let peakGpu = 0;
    let peakRam = 0;

    if (history.length > 0) {
      const cpuValues = history.map((t) => t.cpuPercent).filter((v): v is number => v !== null);
      const gpuValues = history.map((t) => t.gpuPercent).filter((v): v is number => v !== null);
      const ramValues = history.map((t) => t.memoryMb).filter((v): v is number => v !== null);

      if (cpuValues.length > 0) {
        avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
        peakCpu = Math.max(...cpuValues);
      }
      if (gpuValues.length > 0) {
        avgGpu = gpuValues.reduce((a, b) => a + b, 0) / gpuValues.length;
        peakGpu = Math.max(...gpuValues);
      }
      if (ramValues.length > 0) {
        avgRam = ramValues.reduce((a, b) => a + b, 0) / ramValues.length;
        peakRam = Math.max(...ramValues);
      }
    }

    return {
      sessionId: sess.id,
      gameId: sess.gameId,
      gameName: sess.gameName,
      durationMs,
      startedAt: sess.startedAt,
      endedAt: endTime,
      averageCpuPercent: Math.round(avgCpu * 10) / 10,
      averageGpuPercent: Math.round(avgGpu * 10) / 10,
      averageMemoryMb: Math.round(avgRam),
      peakCpuPercent: Math.round(peakCpu * 10) / 10,
      peakGpuPercent: Math.round(peakGpu * 10) / 10,
      peakMemoryMb: Math.round(peakRam),
      // Use real metrics from stealth mode result
      stealthModeSavingsMb: Math.round(metrics.memoryFreedMb),
      // Use real optimization count
      optimizationsApplied: metrics.optimizationsApplied,
    };
  }, []);

  /**
   * Poll for game process status.
   */
  const pollGameStatus = useCallback(async () => {
    if (!session) return;

    const status = await checkGameRunning(session.gameId);

    if (status.running) {
      // Game is running
      gameDetectedRef.current = true;

      // Clear startup timeout if set
      if (startupTimeoutRef.current) {
        window.clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
      }

      // Update session status if needed
      if (session.status !== 'running') {
        setSession((prev) => prev ? { ...prev, status: 'running' } : null);
      }

      // Update telemetry
      const newTelemetry: SessionTelemetry = {
        timestamp: Date.now(),
        cpuPercent: status.cpuPercent,
        gpuPercent: null, // TODO: Get from system telemetry
        memoryMb: status.memoryMb,
        fps: null, // TODO: Implement FPS tracking
      };

      setTelemetry(newTelemetry);
      telemetryHistoryRef.current.push(newTelemetry);
    } else if (gameDetectedRef.current) {
      // Game was running but is now stopped - session ended
      const finalSession = { ...session, status: 'ended' as const };
      setSession(finalSession);

      // Generate summary
      const sessionSummary = generateSummary(finalSession);
      setSummary(sessionSummary);

      // Persist to session history
      setSessionHistory((prev) => {
        const updated = [...prev, sessionSummary].slice(-MAX_SESSION_HISTORY);
        try {
          localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to persist session history:', e);
        }
        return updated;
      });

      // Stop polling
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [session, checkGameRunning, generateSummary]);

  /**
   * Start a new game session with optional launch config.
   */
  const startSession = useCallback((game: DetectedGame, config?: LaunchConfig) => {
    // Clean up any existing session
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
    }
    if (startupTimeoutRef.current) {
      window.clearTimeout(startupTimeoutRef.current);
    }

    // Reset state
    gameDetectedRef.current = false;
    telemetryHistoryRef.current = [];
    setTelemetry(null);
    setSummary(null);
    setError(null);
    // Reset session metrics for new session
    setSessionMetrics({ memoryFreedMb: 0, optimizationsApplied: 0 });

    // Create new session with provided config or defaults
    const newSession: GameSession = {
      id: generateSessionId(),
      gameId: game.id,
      gameName: game.name,
      launcher: game.launcher,
      startedAt: Date.now(),
      config: config ?? {
        applyOptimizations: false,
        runStealthMode: false,
        trackSession: true,
      },
      status: 'launching',
      telemetry: null,
      summary: null,
      error: null,
    };

    setSession(newSession);

    // Set startup timeout
    startupTimeoutRef.current = window.setTimeout(() => {
      if (!gameDetectedRef.current) {
        setError("Game didn't start. Try launching from the launcher directly.");
        setSession((prev) => prev ? { ...prev, status: 'error', error: 'Startup timeout' } : null);
      }
    }, STARTUP_TIMEOUT);

    // Start polling
    const pollInterval = document.hasFocus() ? POLL_INTERVAL_FOCUSED : POLL_INTERVAL_BACKGROUND;
    pollIntervalRef.current = window.setInterval(pollGameStatus, pollInterval);

    // Poll immediately
    pollGameStatus();
  }, [pollGameStatus]);

  /**
   * End the current session manually.
   */
  const endSession = useCallback(() => {
    if (!session) return;

    // Stop polling
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (startupTimeoutRef.current) {
      window.clearTimeout(startupTimeoutRef.current);
      startupTimeoutRef.current = null;
    }

    // Generate summary if game was detected
    if (gameDetectedRef.current) {
      const finalSession = { ...session, status: 'ended' as const };
      const sessionSummary = generateSummary(finalSession);
      setSummary(sessionSummary);

      // Persist to session history
      setSessionHistory((prev) => {
        const updated = [...prev, sessionSummary].slice(-MAX_SESSION_HISTORY);
        try {
          localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to persist session history:', e);
        }
        return updated;
      });
    }

    setSession(null);
    setTelemetry(null);
  }, [session, generateSummary]);

  /**
   * Clear the summary (dismiss modal).
   */
  const clearSummary = useCallback(() => {
    setSummary(null);
    setSession(null);
  }, []);

  /**
   * Handle stealth mode result to update session metrics.
   * Called from launch flow after stealth mode completes.
   */
  const handleStealthModeResult = useCallback((result: StealthModeResult) => {
    setSessionMetrics((prev) => ({
      ...prev,
      memoryFreedMb: result.freed_memory_mb,
    }));
  }, []);

  /**
   * Set the number of optimizations applied.
   * Called from launch flow after optimizations complete.
   */
  const setOptimizationsApplied = useCallback((count: number) => {
    setSessionMetrics((prev) => ({
      ...prev,
      optimizationsApplied: count,
    }));
  }, []);

  // Adjust polling interval based on focus
  useEffect(() => {
    const handleFocus = () => {
      if (pollIntervalRef.current && session?.status === 'running') {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = window.setInterval(pollGameStatus, POLL_INTERVAL_FOCUSED);
      }
    };

    const handleBlur = () => {
      if (pollIntervalRef.current && session?.status === 'running') {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = window.setInterval(pollGameStatus, POLL_INTERVAL_BACKGROUND);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [session?.status, pollGameStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
      if (startupTimeoutRef.current) {
        window.clearTimeout(startupTimeoutRef.current);
      }
    };
  }, []);

  return {
    session,
    startSession,
    endSession,
    isActive: session !== null && session.status !== 'ended' && session.status !== 'error',
    telemetry,
    summary,
    clearSummary,
    error,
    handleStealthModeResult,
    setOptimizationsApplied,
    sessionHistory,
  };
}

export default useGameSession;
