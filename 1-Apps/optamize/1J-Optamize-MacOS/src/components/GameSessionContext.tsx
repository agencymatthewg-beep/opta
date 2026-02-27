/**
 * GameSessionContext - Global state management for game sessions.
 *
 * Provides session state and controls that persist across page navigation.
 */

import { createContext, useContext, ReactNode } from 'react';
import { useGameSession, UseGameSessionResult } from '../hooks/useGameSession';

/**
 * Context for game session state.
 */
const GameSessionContext = createContext<UseGameSessionResult | null>(null);

/**
 * Provider component for game session context.
 */
export function GameSessionProvider({ children }: { children: ReactNode }) {
  const sessionState = useGameSession();

  return (
    <GameSessionContext.Provider value={sessionState}>
      {children}
    </GameSessionContext.Provider>
  );
}

/**
 * Hook to access game session context.
 */
export function useGameSessionContext(): UseGameSessionResult {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error('useGameSessionContext must be used within a GameSessionProvider');
  }
  return context;
}

export default GameSessionContext;
