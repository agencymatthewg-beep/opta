/**
 * useAudio - Hook for audio feedback in Opta
 *
 * Provides easy access to the audio system from React components.
 * Handles initialization, state management, and automatic cleanup.
 *
 * Features:
 * - Auto-initialization on first user interaction
 * - Reactive state for mute/volume changes
 * - Integration with OptaRing state transitions
 * - Respects user preferences (reduced motion = no audio)
 *
 * @example
 * ```tsx
 * const { playSound, isMuted, toggleMute } = useAudio();
 *
 * const handleClick = () => {
 *   playSound('ui-click');
 * };
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AudioEngine,
  initAudio,
  isWebAudioAvailable,
  type SoundName,
  type AudioPreferences,
} from '@/lib/audio';

export interface UseAudioOptions {
  /** Whether to auto-initialize on first interaction (default: true) */
  autoInit?: boolean;
  /** Whether to respect reduced motion preference (default: true) */
  respectReducedMotion?: boolean;
}

export interface UseAudioReturn {
  /** Play a sound by name */
  playSound: (name: SoundName) => void;
  /** Start a looping sound */
  startLoop: (name: SoundName) => void;
  /** Stop a looping sound */
  stopLoop: (name: SoundName) => void;
  /** Whether audio is currently muted */
  isMuted: boolean;
  /** Toggle mute state */
  toggleMute: () => void;
  /** Set mute state */
  setMuted: (muted: boolean) => void;
  /** Current master volume (0-1) */
  masterVolume: number;
  /** Set master volume (0-1) */
  setMasterVolume: (volume: number) => void;
  /** Whether audio system is initialized */
  isInitialized: boolean;
  /** Initialize the audio system (requires user interaction) */
  initialize: () => Promise<boolean>;
  /** Whether Web Audio is supported */
  isSupported: boolean;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Current audio preferences */
  preferences: AudioPreferences;
  /** Update audio preferences */
  setPreferences: (prefs: Partial<AudioPreferences>) => void;
}

/**
 * Hook for audio playback and control
 */
export function useAudio(options: UseAudioOptions = {}): UseAudioReturn {
  const { autoInit = true, respectReducedMotion = true } = options;

  // State
  const [isInitialized, setIsInitialized] = useState(AudioEngine.isInitialized());
  const [isMuted, setIsMuted] = useState(AudioEngine.isMuted());
  const [masterVolume, setMasterVolumeState] = useState(AudioEngine.getMasterVolume());
  const [preferences, setPreferencesState] = useState<AudioPreferences>(
    AudioEngine.getPreferences()
  );

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Check Web Audio support
  const isSupported = useMemo(() => isWebAudioAvailable(), []);

  // Initialize audio
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    if (isInitialized) return true;

    const success = await initAudio();
    setIsInitialized(success);

    if (success) {
      // Sync state after initialization
      setIsMuted(AudioEngine.isMuted());
      setMasterVolumeState(AudioEngine.getMasterVolume());
      setPreferencesState(AudioEngine.getPreferences());
    }

    return success;
  }, [isSupported, isInitialized]);

  // Auto-init on user interaction
  useEffect(() => {
    if (!autoInit || isInitialized || !isSupported) return;

    const handleInteraction = () => {
      void initialize();
    };

    // Listen for first user interaction
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [autoInit, isInitialized, isSupported, initialize]);

  // Play sound
  const playSound = useCallback(
    (name: SoundName) => {
      // Skip if reduced motion is preferred and we respect it
      if (respectReducedMotion && prefersReducedMotion) return;

      // Initialize if not already
      if (!isInitialized) {
        void initialize().then((success) => {
          if (success) {
            AudioEngine.play(name);
          }
        });
        return;
      }

      AudioEngine.play(name);
    },
    [isInitialized, initialize, respectReducedMotion, prefersReducedMotion]
  );

  // Start loop
  const startLoop = useCallback(
    (name: SoundName) => {
      if (respectReducedMotion && prefersReducedMotion) return;

      if (!isInitialized) {
        void initialize().then((success) => {
          if (success) {
            AudioEngine.startLoop(name);
          }
        });
        return;
      }

      AudioEngine.startLoop(name);
    },
    [isInitialized, initialize, respectReducedMotion, prefersReducedMotion]
  );

  // Stop loop
  const stopLoop = useCallback((name: SoundName) => {
    AudioEngine.stopLoop(name);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = AudioEngine.toggleMute();
    setIsMuted(newMuted);
  }, []);

  // Set muted
  const setMuted = useCallback((muted: boolean) => {
    AudioEngine.setMuted(muted);
    setIsMuted(muted);
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    AudioEngine.setMasterVolume(volume);
    setMasterVolumeState(volume);
  }, []);

  // Set preferences
  const setPreferences = useCallback((prefs: Partial<AudioPreferences>) => {
    AudioEngine.setPreferences(prefs);
    setPreferencesState(AudioEngine.getPreferences());
    setIsMuted(AudioEngine.isMuted());
    setMasterVolumeState(AudioEngine.getMasterVolume());
  }, []);

  return {
    playSound,
    startLoop,
    stopLoop,
    isMuted,
    toggleMute,
    setMuted,
    masterVolume,
    setMasterVolume,
    isInitialized,
    initialize,
    isSupported,
    prefersReducedMotion,
    preferences,
    setPreferences,
  };
}

/**
 * Hook for ring-synchronized audio
 * Automatically plays sounds based on ring state changes
 */
export function useRingAudio(ringState: 'dormant' | 'active' | 'processing' | undefined): void {
  const { playSound, startLoop, stopLoop, isInitialized, isMuted } = useAudio();
  const [prevState, setPrevState] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isInitialized || isMuted || !ringState) return;

    // Detect state transitions
    if (prevState !== ringState) {
      // Stop any existing loops
      stopLoop('ring-hum');
      stopLoop('ring-processing');

      // Play transition sounds
      switch (ringState) {
        case 'active':
          if (prevState === 'dormant') {
            // Wake up: dormant -> active
            playSound('ring-wake');
          }
          // Start subtle hum
          startLoop('ring-hum');
          break;

        case 'processing':
          // Start processing pulse
          startLoop('ring-processing');
          break;

        case 'dormant':
          if (prevState === 'active' || prevState === 'processing') {
            // Going to sleep
            playSound('ring-sleep');
          }
          break;
      }

      setPrevState(ringState);
    }
  }, [ringState, prevState, isInitialized, isMuted, playSound, startLoop, stopLoop]);

  // Cleanup loops on unmount
  useEffect(() => {
    return () => {
      stopLoop('ring-hum');
      stopLoop('ring-processing');
    };
  }, [stopLoop]);
}

/**
 * Play explosion sound (for ring explosion effect)
 */
export function useExplosionSound(): () => void {
  const { playSound, isInitialized, initialize } = useAudio();

  return useCallback(() => {
    if (!isInitialized) {
      void initialize().then((success) => {
        if (success) {
          AudioEngine.play('ring-explosion');
        }
      });
      return;
    }
    playSound('ring-explosion');
  }, [isInitialized, initialize, playSound]);
}

export default useAudio;
