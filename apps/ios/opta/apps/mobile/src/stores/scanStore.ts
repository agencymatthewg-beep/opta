import { create } from 'zustand';
import type { ScanResponse, PriorityWeights } from '@opta/shared';

/** Maximum number of scans to retain in history */
const MAX_HISTORY_LENGTH = 50;

/**
 * Default priority weights for optimization scoring.
 * Values sum to 1.0 for normalized weighting.
 */
const DEFAULT_PRIORITIES: Readonly<PriorityWeights> = {
  budget: 0.3,
  health: 0.2,
  quality: 0.3,
  time: 0.1,
  sustainability: 0.1,
} as const;

/**
 * Store state shape for scan-related data
 */
interface ScanState {
  /** Currently displayed scan result */
  readonly currentScan: ScanResponse | null;
  /** Whether a scan API request is in progress */
  readonly isLoading: boolean;
  /** Error message from failed scan, if any */
  readonly error: string | null;
  /** User's optimization priority weights */
  readonly priorities: PriorityWeights;
  /** History of past scan results */
  readonly scanHistory: ReadonlyArray<ScanResponse>;
}

/**
 * Store actions for modifying scan state
 */
interface ScanActions {
  /** Set the current scan result and add to history */
  setCurrentScan: (scan: ScanResponse) => void;
  /** Update loading state */
  setLoading: (loading: boolean) => void;
  /** Set or clear error message */
  setError: (error: string | null) => void;
  /** Update one or more priority weights */
  setPriorities: (priorities: Partial<PriorityWeights>) => void;
  /** Add a scan to history (internal use) */
  addToHistory: (scan: ScanResponse) => void;
  /** Clear all scan history */
  clearHistory: () => void;
  /** Reset current scan state (loading, error, current) */
  reset: () => void;
}

/** Combined store interface */
type ScanStore = ScanState & ScanActions;

/**
 * Zustand store for scan-related state management.
 * Handles current scan, loading states, user priorities, and history.
 */
export const useScanStore = create<ScanStore>((set, get) => ({
  // Initial state values
  currentScan: null,
  isLoading: false,
  error: null,
  priorities: { ...DEFAULT_PRIORITIES },
  scanHistory: [],

  // Action implementations
  setCurrentScan: (scan: ScanResponse): void => {
    set({ currentScan: scan, error: null });
    // Auto-add to history when setting a new scan
    get().addToHistory(scan);
  },

  setLoading: (loading: boolean): void => {
    set({ isLoading: loading });
  },

  setError: (error: string | null): void => {
    set({ error, isLoading: false });
  },

  setPriorities: (newPriorities: Partial<PriorityWeights>): void => {
    set((state) => ({
      priorities: { ...state.priorities, ...newPriorities },
    }));
  },

  addToHistory: (scan: ScanResponse): void => {
    set((state) => {
      const updatedHistory = [scan, ...state.scanHistory];
      // Limit history to MAX_HISTORY_LENGTH entries
      return {
        scanHistory: updatedHistory.slice(0, MAX_HISTORY_LENGTH),
      };
    });
  },

  clearHistory: (): void => {
    set({ scanHistory: [] });
  },

  reset: (): void => {
    set({
      currentScan: null,
      isLoading: false,
      error: null,
    });
  },
}));
