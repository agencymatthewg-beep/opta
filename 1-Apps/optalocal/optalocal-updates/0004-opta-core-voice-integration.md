# Opta Core Voice Integration

**Date:** 2026-03-04T07:15:00Z
**Target:** Opta Code Desktop, Opta CLI Daemon, Opta LMX
**Update Type:** Feature
**Commit:** N/A

## Summary

This update introduces native localized voice dictation, Text-to-Speech (TTS), and global audio processing across the Opta Local stack. Users can now dictate commands across the ecosystem securely, and LMX natively translates these voice commands directly within the dedicated Apple Silicon host network.

## Detailed Changes

- **Opta LMX:** Integrated the `mlx-whisper` package for STT processing at `POST /v1/audio/transcriptions` and `mlx-audio` for TTS generation at `POST /v1/audio/speech`. Handled natively using the MLX framework with no system-crashing processes.
- **Opta CLI Daemon:** Introduced typed protocols via `protocol/v3` schemas (`V3Event` and `audio.transcribe`/`audio.tts`). Connected logic for proxying directly into LMX and fallback routines natively into the OpenAI APIs (`whisper-1`/`tts-1`) if configured that way via the `keychain` integration.
- **Opta Code Desktop:** Implemented a new `useAudioRecorder` React hook which hooks directly into window MediaStreams. Configured a newly-designed pulsating microphone UI on the Chat `Composer.tsx` panel which passes base64 audio directly to the Daemon processes.

## Rollout Impact

Seamless / No action required. New audio integrations will appear transparently as an accessible "microphone" action next to text input throughout Opta Code.
