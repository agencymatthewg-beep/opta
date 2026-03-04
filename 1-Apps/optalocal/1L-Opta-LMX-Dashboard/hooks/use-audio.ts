'use client'

/**
 * use-audio.ts — React hook for managing TTS / STT audio state.
 *
 * Note: Audio requests are fire-and-forget mutations (textToSpeech,
 * transcribeAudio) handled in lib/mutations.ts. This hook provides
 * UI state management — current op status, last result blob / text.
 */

export type AudioOp = 'idle' | 'generating-speech' | 'transcribing' | 'done' | 'error'

export interface AudioState {
    op: AudioOp
    /** Last TTS blob URL (auto-revoked when a new one is created). */
    speechUrl: string | null
    /** Last STT transcription text. */
    transcriptionText: string | null
    error: string | null
}
