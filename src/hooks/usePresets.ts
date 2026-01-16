/**
 * usePresets Hook
 *
 * Manages optimization presets - loading, saving, deleting, and applying.
 * Persists custom presets and active preset selection to localStorage.
 */

import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_PRESETS } from '@/data/defaultPresets';
import type { OptimizationPreset } from '@/types/presets';

const PRESETS_STORAGE_KEY = 'opta-presets';
const ACTIVE_PRESET_STORAGE_KEY = 'opta-active-preset';

export function usePresets() {
  // Load custom presets from localStorage and combine with defaults
  const [customPresets, setCustomPresets] = useState<OptimizationPreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load active preset from localStorage
  const [activePresetId, setActivePresetId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
  });

  // Combine built-in and custom presets
  const presets = useMemo(
    () => [...DEFAULT_PRESETS, ...customPresets],
    [customPresets]
  );

  // Get the currently active preset object
  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId]
  );

  // Save a new custom preset
  const savePreset = useCallback(
    (preset: Omit<OptimizationPreset, 'id' | 'isBuiltIn'>) => {
      const newPreset: OptimizationPreset = {
        ...preset,
        id: `custom-${Date.now()}`,
        isBuiltIn: false,
      };

      setCustomPresets((prev) => {
        const updated = [...prev, newPreset];
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });

      return newPreset;
    },
    []
  );

  // Delete a custom preset (built-in presets cannot be deleted)
  const deletePreset = useCallback((id: string) => {
    const preset = [...DEFAULT_PRESETS, ...customPresets].find((p) => p.id === id);

    // Prevent deleting built-in presets
    if (preset?.isBuiltIn) {
      return false;
    }

    setCustomPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // If the deleted preset was active, clear active selection
    if (activePresetId === id) {
      setActivePresetId(null);
      localStorage.removeItem(ACTIVE_PRESET_STORAGE_KEY);
    }

    return true;
  }, [customPresets, activePresetId]);

  // Apply a preset (set as active)
  const applyPreset = useCallback((id: string) => {
    setActivePresetId(id);
    localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, id);
  }, []);

  // Clear active preset
  const clearActivePreset = useCallback(() => {
    setActivePresetId(null);
    localStorage.removeItem(ACTIVE_PRESET_STORAGE_KEY);
  }, []);

  return {
    presets,
    activePreset,
    activePresetId,
    savePreset,
    deletePreset,
    applyPreset,
    clearActivePreset,
  };
}
