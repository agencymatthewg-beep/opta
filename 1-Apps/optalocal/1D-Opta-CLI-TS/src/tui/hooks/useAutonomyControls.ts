import { useCallback } from 'react';
import { sanitizeTerminalText } from '../../utils/text.js';
import { errorMessage } from '../../utils/errors.js';
import type { TuiMessage } from '../App.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';

export interface UseAutonomyControlsOptions {
  autonomyLevel: number;
  setAutonomyLevel: (v: number) => void;
  autonomyMode: 'execution' | 'ceo';
  setAutonomyMode: (v: 'execution' | 'ceo') => void;
  appendAction: (event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => void;
  setMessages: React.Dispatch<React.SetStateAction<TuiMessage[]>>;
}

export interface UseAutonomyControlsReturn {
  applyAutonomyProfile: (nextLevel: number, nextMode: 'execution' | 'ceo') => Promise<void>;
  handleAutonomyUp: () => void;
  handleAutonomyDown: () => void;
  handleAutonomyToggleMode: () => void;
}

export function useAutonomyControls(options: UseAutonomyControlsOptions): UseAutonomyControlsReturn {
  const {
    autonomyLevel,
    setAutonomyLevel,
    autonomyMode,
    setAutonomyMode,
    appendAction,
    setMessages,
  } = options;

  const applyAutonomyProfile = useCallback(async (
    nextLevelInput: number,
    nextModeInput: 'execution' | 'ceo',
  ) => {
    try {
      const [
        { computeAutonomyConfigUpdates, buildAutonomyProfile, formatAutonomySlider, resolveAutonomyLevel, resolveAutonomyMode, autonomyDurationMinutes },
        { loadConfig, saveConfig },
      ] = await Promise.all([
        import('../../core/autonomy.js'),
        import('../../core/config.js'),
      ]);

      const nextLevel = resolveAutonomyLevel(nextLevelInput);
      const nextMode = resolveAutonomyMode(nextModeInput);
      const updates = computeAutonomyConfigUpdates(nextLevel, nextMode);
      await saveConfig(updates);

      const refreshed = await loadConfig();
      setAutonomyLevel(refreshed.autonomy.level);
      setAutonomyMode(refreshed.autonomy.mode);

      const profile = buildAutonomyProfile(nextLevel, nextMode);
      const summary = `${formatAutonomySlider(nextLevel)} L${nextLevel}/5 (${nextMode}) \u00b7 ${autonomyDurationMinutes(profile)} min budget`;
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `Autonomy profile updated: ${summary}`,
          createdAt: Date.now(),
        },
      ]);
      appendAction({
        kind: 'info',
        status: 'ok',
        icon: '🤖',
        label: 'Autonomy updated',
        detail: `L${nextLevel} ${nextMode}`,
      });
    } catch (err) {
      const msg = sanitizeTerminalText(errorMessage(err));
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: `Autonomy update failed: ${msg}`,
          createdAt: Date.now(),
        },
      ]);
      appendAction({
        kind: 'error',
        status: 'error',
        icon: '⛔',
        label: 'Autonomy update failed',
        detail: msg.slice(0, 100),
      });
    }
  }, [appendAction, setAutonomyLevel, setAutonomyMode, setMessages]);

  const handleAutonomyUp = useCallback(() => {
    void applyAutonomyProfile(autonomyLevel + 1, autonomyMode);
  }, [applyAutonomyProfile, autonomyLevel, autonomyMode]);

  const handleAutonomyDown = useCallback(() => {
    void applyAutonomyProfile(autonomyLevel - 1, autonomyMode);
  }, [applyAutonomyProfile, autonomyLevel, autonomyMode]);

  const handleAutonomyToggleMode = useCallback(() => {
    const nextMode = autonomyMode === 'ceo' ? 'execution' : 'ceo';
    void applyAutonomyProfile(autonomyLevel, nextMode);
  }, [applyAutonomyProfile, autonomyLevel, autonomyMode]);

  return {
    applyAutonomyProfile,
    handleAutonomyUp,
    handleAutonomyDown,
    handleAutonomyToggleMode,
  };
}
