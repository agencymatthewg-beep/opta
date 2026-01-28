/**
 * OptaTextZoneContext - Global context for managing text zone state.
 *
 * Provides methods for any component to update the text zone,
 * enabling system-wide contextual messaging.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import type { TextZoneType, TextZoneIndicator } from './OptaTextZone';

interface TextZoneState {
  message: string;
  type: TextZoneType;
  indicator?: TextZoneIndicator;
  hint?: string;
}

interface OptaTextZoneContextValue {
  state: TextZoneState;
  setMessage: (msg: string, type?: TextZoneType, hint?: string) => void;
  setIndicator: (indicator: TextZoneIndicator | undefined) => void;
  showSuccess: (msg: string, indicator?: TextZoneIndicator, hint?: string) => void;
  showWarning: (msg: string, hint?: string) => void;
  showError: (msg: string, hint?: string) => void;
  clear: () => void;
}

const DEFAULT_STATE: TextZoneState = {
  message: 'Ready to optimize',
  type: 'neutral',
};

const OptaTextZoneContext = createContext<OptaTextZoneContextValue | null>(null);

interface OptaTextZoneProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the OptaTextZone context.
 */
export function OptaTextZoneProvider({ children }: OptaTextZoneProviderProps) {
  const [state, setState] = useState<TextZoneState>(DEFAULT_STATE);

  const setMessage = useCallback(
    (message: string, type: TextZoneType = 'neutral', hint?: string) => {
      setState((prev) => ({
        ...prev,
        message,
        type,
        hint,
        indicator: undefined,
      }));
    },
    []
  );

  const setIndicator = useCallback((indicator: TextZoneIndicator | undefined) => {
    setState((prev) => ({
      ...prev,
      indicator,
    }));
  }, []);

  const showSuccess = useCallback(
    (msg: string, indicator?: TextZoneIndicator, hint?: string) => {
      setState({
        message: msg,
        type: 'positive',
        indicator,
        hint,
      });
    },
    []
  );

  const showWarning = useCallback((msg: string, hint?: string) => {
    setState({
      message: msg,
      type: 'warning',
      hint,
      indicator: undefined,
    });
  }, []);

  const showError = useCallback((msg: string, hint?: string) => {
    setState({
      message: msg,
      type: 'error',
      hint,
      indicator: undefined,
    });
  }, []);

  const clear = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return (
    <OptaTextZoneContext.Provider
      value={{
        state,
        setMessage,
        setIndicator,
        showSuccess,
        showWarning,
        showError,
        clear,
      }}
    >
      {children}
    </OptaTextZoneContext.Provider>
  );
}

/**
 * Hook to access the OptaTextZone context.
 * Must be used within an OptaTextZoneProvider.
 */
export function useOptaTextZone(): OptaTextZoneContextValue {
  const context = useContext(OptaTextZoneContext);
  if (!context) {
    throw new Error('useOptaTextZone must be used within an OptaTextZoneProvider');
  }
  return context;
}

export default OptaTextZoneProvider;
