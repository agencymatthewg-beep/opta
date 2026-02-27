/**
 * CommunicationStyleContext - Global state provider for communication style preference.
 *
 * Communication style affects how verbose Opta's explanations are:
 * - informative: Explains the "why" behind optimizations, educational
 * - concise: Just the facts, minimal explanation
 *
 * Persists to localStorage for session continuity.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CommunicationStyle } from '@/types/preferences';

interface CommunicationStyleContextType {
  /** Current communication style preference */
  style: CommunicationStyle;
  /** Set communication style directly */
  setStyle: (style: CommunicationStyle) => void;
  /** Helper: true if style is informative (verbose mode) */
  isVerbose: boolean;
}

const CommunicationStyleContext = createContext<CommunicationStyleContextType | undefined>(undefined);

const STORAGE_KEY = 'opta_communication_style';

export function CommunicationStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<CommunicationStyle>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'informative' || saved === 'concise') {
        return saved;
      }
    }
    return 'informative'; // Default to informative
  });

  // Persist to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, style);
  }, [style]);

  const setStyle = (newStyle: CommunicationStyle) => setStyleState(newStyle);
  const isVerbose = style === 'informative';

  return (
    <CommunicationStyleContext.Provider value={{ style, setStyle, isVerbose }}>
      {children}
    </CommunicationStyleContext.Provider>
  );
}

/**
 * Hook to access communication style preference.
 * Must be used within CommunicationStyleProvider.
 */
export function useCommunicationStyle() {
  const context = useContext(CommunicationStyleContext);
  if (!context) {
    throw new Error('useCommunicationStyle must be used within CommunicationStyleProvider');
  }
  return context;
}
