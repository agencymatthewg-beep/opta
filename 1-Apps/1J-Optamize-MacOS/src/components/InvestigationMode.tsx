/**
 * Investigation Mode context and provider.
 * Enables power users to see full transparency on what Opta is doing.
 */
import { createContext, useContext, useState, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { InvestigationPanel } from './InvestigationPanel';
import type { InvestigationReport } from '@/types/investigation';

interface InvestigationModeContextType {
  /** Whether investigation mode is enabled */
  isInvestigationMode: boolean;
  /** Enable or disable investigation mode */
  setInvestigationMode: (enabled: boolean) => void;
  /** Currently displayed report (if any) */
  currentReport: InvestigationReport | null;
  /** Show the investigation panel with a report */
  showReport: (report: InvestigationReport) => void;
  /** Hide the investigation panel */
  hideReport: () => void;
}

const InvestigationModeContext = createContext<InvestigationModeContextType | undefined>(undefined);

interface InvestigationModeProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Investigation Mode.
 * Wraps the app and provides investigation mode state globally.
 */
export function InvestigationModeProvider({ children }: InvestigationModeProviderProps) {
  // Persist investigation mode preference in localStorage
  const [isInvestigationMode, setIsInvestigationModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('opta_investigation_mode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [currentReport, setCurrentReport] = useState<InvestigationReport | null>(null);

  const setInvestigationMode = (enabled: boolean) => {
    setIsInvestigationModeState(enabled);
    try {
      localStorage.setItem('opta_investigation_mode', JSON.stringify(enabled));
    } catch {
      // Ignore localStorage errors
    }
  };

  const showReport = (report: InvestigationReport) => {
    setCurrentReport(report);
  };

  const hideReport = () => {
    setCurrentReport(null);
  };

  return (
    <InvestigationModeContext.Provider
      value={{
        isInvestigationMode,
        setInvestigationMode,
        currentReport,
        showReport,
        hideReport,
      }}
    >
      {children}
      <AnimatePresence>
        {currentReport && (
          <InvestigationPanel report={currentReport} onClose={hideReport} />
        )}
      </AnimatePresence>
    </InvestigationModeContext.Provider>
  );
}

/**
 * Hook to access investigation mode context.
 * Must be used within an InvestigationModeProvider.
 */
export function useInvestigationMode() {
  const context = useContext(InvestigationModeContext);
  if (!context) {
    throw new Error('useInvestigationMode must be used within InvestigationModeProvider');
  }
  return context;
}

export default InvestigationModeProvider;
