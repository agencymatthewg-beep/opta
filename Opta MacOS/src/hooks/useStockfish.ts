/**
 * React hook for Stockfish AI opponent via Web Worker.
 *
 * CRITICAL: Always runs Stockfish in a Web Worker to avoid blocking the main thread.
 * WASM execution is computationally intensive and MUST be off the UI thread.
 *
 * Uses UCI (Universal Chess Interface) protocol for communication:
 * - 'uci' command to initialize
 * - 'setoption name Skill Level value X' to set difficulty (0-20)
 * - 'position fen X' to set board position
 * - 'go movetime X' to request best move with time limit
 * - 'bestmove e2e4' response format
 *
 * Memory leak prevention: Worker is terminated on unmount or via destroy().
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Options for useStockfish hook.
 */
export interface UseStockfishOptions {
  /** Stockfish Skill Level 0-20 (default: 10) */
  skillLevel?: number;
  /** AI thinking time in milliseconds (default: 1000) */
  thinkTimeMs?: number;
}

/**
 * Return type for useStockfish hook.
 */
export interface UseStockfishReturn {
  // State
  /** Whether Stockfish has initialized (received 'uciok') */
  isReady: boolean;
  /** Whether Stockfish is currently calculating a move */
  isThinking: boolean;

  // Actions
  /** Get the best move for a given position (FEN) */
  getBestMove: (fen: string) => Promise<string | null>;
  /** Update the skill level (0-20) */
  setSkillLevel: (level: number) => void;
  /** Update the think time in milliseconds */
  setThinkTime: (ms: number) => void;

  // Cleanup
  /** Manually destroy the worker (also called on unmount) */
  destroy: () => void;
}

/**
 * Hook for Stockfish AI opponent communication via Web Worker.
 *
 * @param options - Configuration options
 * @returns Stockfish state and control functions
 *
 * @example
 * ```tsx
 * const { isReady, isThinking, getBestMove, setSkillLevel } = useStockfish({
 *   skillLevel: 10,
 *   thinkTimeMs: 1000,
 * });
 *
 * // Wait for Stockfish to be ready
 * if (!isReady) return <div>Loading AI...</div>;
 *
 * // Get AI move
 * const handleAITurn = async (fen: string) => {
 *   const move = await getBestMove(fen);
 *   if (move) {
 *     // move is in format 'e2e4' or 'e7e8q' (with promotion)
 *     console.log('AI plays:', move);
 *   }
 * };
 * ```
 */
export function useStockfish(options: UseStockfishOptions = {}): UseStockfishReturn {
  const { skillLevel: initialSkillLevel = 10, thinkTimeMs: initialThinkTime = 1000 } = options;

  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Refs for mutable values that shouldn't trigger re-renders
  const workerRef = useRef<Worker | null>(null);
  const skillLevelRef = useRef(initialSkillLevel);
  const thinkTimeMsRef = useRef(initialThinkTime);

  // Promise resolver for current move request
  const moveResolverRef = useRef<((move: string | null) => void) | null>(null);

  // Track if component is mounted
  const mountedRef = useRef(true);

  /**
   * Send a UCI command to Stockfish.
   */
  const sendCommand = useCallback((cmd: string) => {
    if (workerRef.current) {
      workerRef.current.postMessage(cmd);
    }
  }, []);

  /**
   * Handle messages from Stockfish worker.
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    const line = String(event.data);

    // Stockfish is ready after receiving 'uciok'
    if (line === 'uciok') {
      if (mountedRef.current) {
        setIsReady(true);
      }
      // Set initial skill level after UCI init
      sendCommand(`setoption name Skill Level value ${skillLevelRef.current}`);
      return;
    }

    // Parse best move response
    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const move = parts[1]; // e.g., 'e2e4' or 'e7e8q'

      if (mountedRef.current) {
        setIsThinking(false);
      }

      if (moveResolverRef.current) {
        // Handle '(none)' which Stockfish returns when there are no legal moves
        moveResolverRef.current(move === '(none)' ? null : move);
        moveResolverRef.current = null;
      }
    }
  }, [sendCommand]);

  /**
   * Initialize Stockfish Web Worker on mount.
   */
  useEffect(() => {
    mountedRef.current = true;

    try {
      // Create Web Worker from stockfish.js
      // Note: In Vite, we use the ?worker or import.meta.url pattern
      // For stockfish npm package, we need to create the worker properly
      const workerUrl = new URL(
        'stockfish/src/stockfish-17.1-lite-single-03e3232.js',
        import.meta.url
      );
      const worker = new Worker(workerUrl, { type: 'module' });

      worker.onmessage = handleMessage;
      worker.onerror = (error) => {
        console.error('Stockfish worker error:', error);
        if (mountedRef.current) {
          setIsReady(false);
        }
      };

      workerRef.current = worker;

      // Initialize UCI protocol
      worker.postMessage('uci');
    } catch (error) {
      console.error('Failed to initialize Stockfish worker:', error);
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [handleMessage]);

  /**
   * Get the best move for a given position.
   * Returns null if invalid FEN or worker terminated.
   */
  const getBestMove = useCallback(async (fen: string): Promise<string | null> => {
    if (!workerRef.current || !isReady) {
      return null;
    }

    return new Promise((resolve) => {
      // Cancel any pending request
      if (moveResolverRef.current) {
        moveResolverRef.current(null);
      }

      moveResolverRef.current = resolve;

      if (mountedRef.current) {
        setIsThinking(true);
      }

      // Send position and request move
      sendCommand(`position fen ${fen}`);
      sendCommand(`go movetime ${thinkTimeMsRef.current}`);
    });
  }, [isReady, sendCommand]);

  /**
   * Update skill level (0-20).
   */
  const setSkillLevel = useCallback((level: number) => {
    const clampedLevel = Math.max(0, Math.min(20, level));
    skillLevelRef.current = clampedLevel;
    if (workerRef.current && isReady) {
      sendCommand(`setoption name Skill Level value ${clampedLevel}`);
    }
  }, [isReady, sendCommand]);

  /**
   * Update think time in milliseconds.
   */
  const setThinkTime = useCallback((ms: number) => {
    thinkTimeMsRef.current = Math.max(100, ms); // Minimum 100ms
  }, []);

  /**
   * Manually destroy the worker.
   */
  const destroy = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (mountedRef.current) {
      setIsReady(false);
      setIsThinking(false);
    }
    // Resolve any pending request
    if (moveResolverRef.current) {
      moveResolverRef.current(null);
      moveResolverRef.current = null;
    }
  }, []);

  return {
    // State
    isReady,
    isThinking,

    // Actions
    getBestMove,
    setSkillLevel,
    setThinkTime,

    // Cleanup
    destroy,
  };
}

export default useStockfish;
