import React, { createContext, useContext, useState, useCallback } from 'react';

export type Panel = 'input' | 'messages' | 'sidebar';

interface FocusContextValue {
  activePanel: Panel;
  setActivePanel: (panel: Panel) => void;
  nextPanel: () => void;
  previousPanel: () => void;
}

const PANEL_ORDER: Panel[] = ['input', 'messages', 'sidebar'];

const FocusCtx = createContext<FocusContextValue>({
  activePanel: 'input',
  setActivePanel: () => {},
  nextPanel: () => {},
  previousPanel: () => {},
});

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<Panel>('input');

  const nextPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]!;
    });
  }, []);

  const previousPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]!;
    });
  }, []);

  return (
    <FocusCtx.Provider value={{ activePanel, setActivePanel, nextPanel, previousPanel }}>
      {children}
    </FocusCtx.Provider>
  );
}

export function useFocusPanel() {
  return useContext(FocusCtx);
}
