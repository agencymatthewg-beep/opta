import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActionEvent, ActionEventKind, ActionEventStatus } from '../activity.js';
import { MAX_ACTION_HISTORY } from '../activity.js';
import { appendActionHistory, loadActionHistory } from '../actionHistoryStore.js';
import type { InsightEntry } from '../InsightBlock.js';
import type { TurnActivityItem } from '../App.js';

/** Adaptive token flush windows for smoother high-FPS rendering. */
const MIN_TOKEN_FLUSH_MS = 8;
const MID_TOKEN_FLUSH_MS = 20;
const MAX_TOKEN_FLUSH_MS = 48;
const LOW_RATE_TOKENS_PER_SEC = 40;
const HIGH_RATE_TOKENS_PER_SEC = 180;
const CHARS_PER_TOKEN = 4;

/** Max insights kept to prevent unbounded growth. */
const MAX_INSIGHTS = 20;

export interface UseAppActionsOptions {
  sessionId: string;
  persistenceEnabled: boolean;
  isLoading: boolean;
  setLiveStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setTurnElapsed: (v: number) => void;
}

export interface UseAppActionsReturn {
  /** Append a new action event to history, update status bar, persist if enabled. */
  appendAction: (event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => void;

  /** Summarize tool arguments into a compact display string. */
  summarizeToolArgs: (args?: Record<string, unknown>) => string | undefined;

  /** Force-flush the accumulated token text into React state immediately. */
  flushStreamingTextNow: () => void;

  /** Schedule a debounced token flush based on current generation speed. */
  scheduleTokenFlush: () => void;

  /** Current insight entries. */
  insights: InsightEntry[];
  setInsights: React.Dispatch<React.SetStateAction<InsightEntry[]>>;

  /** Max insights constant exposed for consumers. */
  maxInsights: number;

  /** Elapsed time for the current turn (seconds). */
  turnElapsed: number;

  /** Full action event history (most-recent first). */
  actionHistory: ActionEvent[];
  setActionHistory: React.Dispatch<React.SetStateAction<ActionEvent[]>>;

  /** True once persisted action history has been loaded. */
  historyHydrated: boolean;

  /** Status bar action state. */
  statusActionLabel: string;
  statusActionIcon: string;
  statusActionStatus: ActionEventStatus;
  setStatusActionLabel: (v: string) => void;
  setStatusActionIcon: (v: string) => void;
  setStatusActionStatus: (v: ActionEventStatus) => void;

  // Refs exposed so streaming events hook can accumulate data without re-renders
  currentStreamingTextRef: React.MutableRefObject<string>;
  liveActivityRef: React.MutableRefObject<TurnActivityItem[]>;
  thinkingTextRef: React.MutableRefObject<string>;
  currentTurnPromptRef: React.MutableRefObject<string>;
  tokenFlushTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  tokenRateWindowRef: React.MutableRefObject<{ startedAt: number; chars: number }>;
  actionCounterRef: React.MutableRefObject<number>;
  historyPersistQueueRef: React.MutableRefObject<Promise<void>>;
}

export function useAppActions(options: UseAppActionsOptions): UseAppActionsReturn {
  const {
    sessionId,
    persistenceEnabled,
    isLoading,
    setLiveStreamingText,
    setTurnElapsed,
  } = options;

  // --- State ---
  const [actionHistory, setActionHistory] = useState<ActionEvent[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [statusActionLabel, setStatusActionLabel] = useState('Idle');
  const [statusActionIcon, setStatusActionIcon] = useState('🟣');
  const [statusActionStatus, setStatusActionStatus] = useState<ActionEventStatus>('info');
  const [insights, setInsights] = useState<InsightEntry[]>([]);

  // --- Refs ---
  const currentStreamingTextRef = useRef('');
  const liveActivityRef = useRef<TurnActivityItem[]>([]);
  const thinkingTextRef = useRef('');
  const currentTurnPromptRef = useRef('');
  const tokenFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRateWindowRef = useRef<{ startedAt: number; chars: number }>({
    startedAt: Date.now(),
    chars: 0,
  });
  const actionCounterRef = useRef(0);
  const historyPersistQueueRef = useRef<Promise<void>>(Promise.resolve());

  // --- Token flushing ---
  const flushStreamingTextNow = useCallback(() => {
    if (tokenFlushTimerRef.current) {
      clearTimeout(tokenFlushTimerRef.current);
      tokenFlushTimerRef.current = null;
    }
    const next = currentStreamingTextRef.current;
    setLiveStreamingText((prev) => (prev === next ? prev : next));
  }, [setLiveStreamingText]);

  const scheduleTokenFlush = useCallback(() => {
    if (tokenFlushTimerRef.current) return;
    const now = Date.now();
    const elapsedSec = Math.max((now - tokenRateWindowRef.current.startedAt) / 1000, 0.001);
    const tokensPerSec = (tokenRateWindowRef.current.chars / CHARS_PER_TOKEN) / elapsedSec;
    const delay = tokensPerSec < LOW_RATE_TOKENS_PER_SEC
      ? MIN_TOKEN_FLUSH_MS
      : tokensPerSec < HIGH_RATE_TOKENS_PER_SEC
        ? MID_TOKEN_FLUSH_MS
        : MAX_TOKEN_FLUSH_MS;
    tokenFlushTimerRef.current = setTimeout(() => {
      tokenFlushTimerRef.current = null;
      const next = currentStreamingTextRef.current;
      setLiveStreamingText((prev) => (prev === next ? prev : next));
    }, delay);
  }, [setLiveStreamingText]);

  // --- Action append ---
  const appendAction = useCallback((event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => {
    const status = event.status ?? 'info';
    const fallbackIcon: Record<ActionEventKind, string> = {
      turn: '🧠',
      tool: '🛠️',
      thinking: '💭',
      slash: '🧩',
      model: '🧬',
      permission: '🔐',
      error: '⛔',
      info: 'ℹ️',
    };
    const entry: ActionEvent = {
      id: `${Date.now()}-${++actionCounterRef.current}`,
      at: Date.now(),
      sessionId,
      kind: event.kind,
      status,
      icon: event.icon ?? fallbackIcon[event.kind],
      label: event.label,
      detail: event.detail,
    };
    setActionHistory((prev) => [entry, ...prev].slice(0, MAX_ACTION_HISTORY));
    setStatusActionLabel(event.detail ? `${event.label} · ${event.detail}` : event.label);
    setStatusActionIcon(entry.icon);
    setStatusActionStatus(status);
    if (persistenceEnabled) {
      historyPersistQueueRef.current = historyPersistQueueRef.current
        .then(() => appendActionHistory(entry, { maxEntries: MAX_ACTION_HISTORY }))
        .catch(() => {});
    }
  }, [persistenceEnabled, sessionId]);

  // --- Summarize tool args ---
  const summarizeToolArgs = useCallback((args?: Record<string, unknown>): string | undefined => {
    if (!args) return undefined;
    const keys = Object.keys(args);
    if (keys.length === 0) return undefined;
    const preview = keys.slice(0, 2).join(', ');
    return keys.length > 2 ? `${preview} +${keys.length - 2} more` : preview;
  }, []);

  // --- Load persisted action history on mount ---
  useEffect(() => {
    let cancelled = false;
    if (!persistenceEnabled) {
      setHistoryHydrated(true);
      return;
    }

    loadActionHistory({ maxEntries: MAX_ACTION_HISTORY })
      .then((entries) => {
        if (cancelled) return;
        setActionHistory((prev) => {
          if (prev.length === 0) return entries;
          const known = new Set(prev.map((entry) => entry.id));
          const merged = [...prev, ...entries.filter((entry) => !known.has(entry.id))];
          merged.sort((a, b) => b.at - a.at);
          return merged.slice(0, MAX_ACTION_HISTORY);
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [persistenceEnabled]);

  // --- Session ready indicator (once history is hydrated) ---
  useEffect(() => {
    if (!historyHydrated) return;
    appendAction({
      kind: 'info',
      status: 'info',
      icon: '🟣',
      label: 'Session ready',
      detail: `session ${sessionId.slice(0, 8)}`,
    });
    // Append once per session ID.
  }, [appendAction, historyHydrated, sessionId]);

  // --- Elapsed timer: ticks every 500ms while loading ---
  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setTurnElapsed((Date.now() - start) / 1000);
    }, 500);
    return () => clearInterval(timer);
  }, [isLoading, setTurnElapsed]);

  return {
    appendAction,
    summarizeToolArgs,
    flushStreamingTextNow,
    scheduleTokenFlush,
    insights,
    setInsights,
    maxInsights: MAX_INSIGHTS,
    turnElapsed: 0, // The actual turnElapsed state is in useSessionState; this hook drives the timer
    actionHistory,
    setActionHistory,
    historyHydrated,
    statusActionLabel,
    statusActionIcon,
    statusActionStatus,
    setStatusActionLabel,
    setStatusActionIcon,
    setStatusActionStatus,
    currentStreamingTextRef,
    liveActivityRef,
    thinkingTextRef,
    currentTurnPromptRef,
    tokenFlushTimerRef,
    tokenRateWindowRef,
    actionCounterRef,
    historyPersistQueueRef,
  };
}
