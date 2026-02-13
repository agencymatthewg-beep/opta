'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { AIModel } from '@/lib/types';

const MAX_COMPARE_MODELS = 4;

interface CompareContextType {
  /** Models selected for comparison */
  selectedModels: AIModel[];
  /** Maximum number of models that can be compared */
  maxModels: number;
  /** Whether the compare panel is visible */
  isPanelOpen: boolean;
  /** Whether the full comparison view is open */
  isCompareViewOpen: boolean;
  /** Add a model to comparison */
  addModel: (model: AIModel) => void;
  /** Remove a model from comparison */
  removeModel: (modelId: string) => void;
  /** Toggle a model in/out of comparison */
  toggleModel: (model: AIModel) => void;
  /** Check if a model is selected for comparison */
  isSelected: (modelId: string) => boolean;
  /** Clear all selected models */
  clearAll: () => void;
  /** Open the full comparison view */
  openCompareView: () => void;
  /** Close the full comparison view */
  closeCompareView: () => void;
  /** Whether we can add more models */
  canAddMore: boolean;
}

const CompareContext = createContext<CompareContextType | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [isCompareViewOpen, setIsCompareViewOpen] = useState(false);

  const addModel = useCallback((model: AIModel) => {
    setSelectedModels((prev) => {
      if (prev.length >= MAX_COMPARE_MODELS) return prev;
      if (prev.some((m) => m.id === model.id)) return prev;
      return [...prev, model];
    });
  }, []);

  const removeModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => prev.filter((m) => m.id !== modelId));
  }, []);

  const toggleModel = useCallback((model: AIModel) => {
    setSelectedModels((prev) => {
      const isAlreadySelected = prev.some((m) => m.id === model.id);
      if (isAlreadySelected) {
        return prev.filter((m) => m.id !== model.id);
      }
      if (prev.length >= MAX_COMPARE_MODELS) return prev;
      return [...prev, model];
    });
  }, []);

  const isSelected = useCallback(
    (modelId: string) => selectedModels.some((m) => m.id === modelId),
    [selectedModels]
  );

  const clearAll = useCallback(() => {
    setSelectedModels([]);
    setIsCompareViewOpen(false);
  }, []);

  const openCompareView = useCallback(() => {
    if (selectedModels.length >= 2) {
      setIsCompareViewOpen(true);
    }
  }, [selectedModels.length]);

  const closeCompareView = useCallback(() => {
    setIsCompareViewOpen(false);
  }, []);

  const value = useMemo<CompareContextType>(
    () => ({
      selectedModels,
      maxModels: MAX_COMPARE_MODELS,
      isPanelOpen: selectedModels.length > 0,
      isCompareViewOpen,
      addModel,
      removeModel,
      toggleModel,
      isSelected,
      clearAll,
      openCompareView,
      closeCompareView,
      canAddMore: selectedModels.length < MAX_COMPARE_MODELS,
    }),
    [
      selectedModels,
      isCompareViewOpen,
      addModel,
      removeModel,
      toggleModel,
      isSelected,
      clearAll,
      openCompareView,
      closeCompareView,
    ]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}

/**
 * Hook to check if a specific model is selected
 */
export function useIsModelSelected(modelId: string) {
  const { isSelected } = useCompare();
  return isSelected(modelId);
}
