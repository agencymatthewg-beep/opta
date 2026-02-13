/**
 * useChessSound - Hook for chess-specific sound effects
 *
 * Provides easy access to chess sounds with settings integration.
 * Automatically respects user's sound preferences from ChessSettings.
 *
 * Features:
 * - Plays appropriate sounds for moves, captures, checks, and game events
 * - Respects individual sound toggle settings
 * - Integrates with the global audio system volume
 * - Auto-initializes audio on first interaction
 *
 * @example
 * ```tsx
 * const { playMoveSound, playCaptureSound } = useChessSound(settings.sound);
 *
 * const handleMove = (move: ChessMove) => {
 *   if (move.captured) {
 *     playCaptureSound();
 *   } else {
 *     playMoveSound();
 *   }
 * };
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useAudio } from './useAudio';
import type { ChessSoundSettings } from '@/types/chess';
import type { ChessSoundName } from '@/lib/audio';

export interface UseChessSoundReturn {
  /** Play piece move sound */
  playMoveSound: () => void;
  /** Play capture sound */
  playCaptureSound: () => void;
  /** Play check sound */
  playCheckSound: () => void;
  /** Play castling sound */
  playCastleSound: () => void;
  /** Play promotion sound */
  playPromoteSound: () => void;
  /** Play game start sound */
  playGameStartSound: () => void;
  /** Play game over sound */
  playGameOverSound: () => void;
  /** Play sound based on move type (convenience method) */
  playMoveTypeSound: (options: {
    captured?: boolean;
    isCheck?: boolean;
    isCastle?: boolean;
    isPromotion?: boolean;
  }) => void;
  /** Whether sound is enabled */
  isEnabled: boolean;
}

/**
 * Hook for playing chess sounds based on user settings
 */
export function useChessSound(soundSettings: ChessSoundSettings): UseChessSoundReturn {
  const { playSound, isInitialized, initialize, setMasterVolume } = useAudio();

  // Check if sounds are globally enabled
  const isEnabled = useMemo(
    () => soundSettings.enabled,
    [soundSettings.enabled]
  );

  // Helper to play a chess sound if enabled
  const playChessSound = useCallback(
    (name: ChessSoundName, checkSetting: boolean) => {
      if (!isEnabled || !checkSetting) return;

      // Ensure audio is initialized
      if (!isInitialized) {
        void initialize().then((success) => {
          if (success) {
            // Apply volume setting
            setMasterVolume(soundSettings.volume);
            playSound(name);
          }
        });
        return;
      }

      playSound(name);
    },
    [isEnabled, isInitialized, initialize, playSound, setMasterVolume, soundSettings.volume]
  );

  // Individual sound play functions
  const playMoveSound = useCallback(() => {
    playChessSound('chess-move', soundSettings.moveSound);
  }, [playChessSound, soundSettings.moveSound]);

  const playCaptureSound = useCallback(() => {
    playChessSound('chess-capture', soundSettings.captureSound);
  }, [playChessSound, soundSettings.captureSound]);

  const playCheckSound = useCallback(() => {
    playChessSound('chess-check', soundSettings.checkSound);
  }, [playChessSound, soundSettings.checkSound]);

  const playCastleSound = useCallback(() => {
    playChessSound('chess-castle', soundSettings.moveSound); // Castling uses move setting
  }, [playChessSound, soundSettings.moveSound]);

  const playPromoteSound = useCallback(() => {
    playChessSound('chess-promote', soundSettings.moveSound); // Promotion uses move setting
  }, [playChessSound, soundSettings.moveSound]);

  const playGameStartSound = useCallback(() => {
    playChessSound('chess-game-start', soundSettings.gameOverSound);
  }, [playChessSound, soundSettings.gameOverSound]);

  const playGameOverSound = useCallback(() => {
    playChessSound('chess-game-over', soundSettings.gameOverSound);
  }, [playChessSound, soundSettings.gameOverSound]);

  // Convenience method to play appropriate sound based on move type
  const playMoveTypeSound = useCallback(
    (options: {
      captured?: boolean;
      isCheck?: boolean;
      isCastle?: boolean;
      isPromotion?: boolean;
    }) => {
      const { captured, isCheck, isCastle, isPromotion } = options;

      // Priority: check > capture > promotion > castle > move
      if (isCheck && soundSettings.checkSound) {
        playCheckSound();
      } else if (captured && soundSettings.captureSound) {
        playCaptureSound();
      } else if (isPromotion && soundSettings.moveSound) {
        playPromoteSound();
      } else if (isCastle && soundSettings.moveSound) {
        playCastleSound();
      } else if (soundSettings.moveSound) {
        playMoveSound();
      }
    },
    [
      playCheckSound,
      playCaptureSound,
      playPromoteSound,
      playCastleSound,
      playMoveSound,
      soundSettings.checkSound,
      soundSettings.captureSound,
      soundSettings.moveSound,
    ]
  );

  return {
    playMoveSound,
    playCaptureSound,
    playCheckSound,
    playCastleSound,
    playPromoteSound,
    playGameStartSound,
    playGameOverSound,
    playMoveTypeSound,
    isEnabled,
  };
}

export default useChessSound;
