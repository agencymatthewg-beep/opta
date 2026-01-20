/**
 * LearnModeContext - Global state provider for Learn Mode.
 *
 * Learn Mode enables educational explanations throughout the app,
 * helping users understand what Opta is doing and why.
 * Persists to localStorage for session continuity.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LearnModeContextType {
  /** Whether Learn Mode is currently enabled */
  isLearnMode: boolean;
  /** Set Learn Mode state directly */
  setLearnMode: (enabled: boolean) => void;
  /** Toggle Learn Mode on/off */
  toggleLearnMode: () => void;
}

const LearnModeContext = createContext<LearnModeContextType | undefined>(undefined);

const STORAGE_KEY = 'opta_learn_mode';

export function LearnModeProvider({ children }: { children: ReactNode }) {
  const [isLearnMode, setIsLearnMode] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isLearnMode));
  }, [isLearnMode]);

  const setLearnMode = (enabled: boolean) => setIsLearnMode(enabled);
  const toggleLearnMode = () => setIsLearnMode((prev: boolean) => !prev);

  return (
    <LearnModeContext.Provider value={{ isLearnMode, setLearnMode, toggleLearnMode }}>
      {children}
    </LearnModeContext.Provider>
  );
}

/**
 * Hook to access Learn Mode state.
 * Must be used within LearnModeProvider.
 */
export function useLearnMode() {
  const context = useContext(LearnModeContext);
  if (!context) {
    throw new Error('useLearnMode must be used within LearnModeProvider');
  }
  return context;
}
