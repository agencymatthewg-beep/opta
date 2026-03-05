'use client'

import { Mic, Volume2, FileAudio, Upload, Play, StopCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { useState, useRef } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { textToSpeech, transcribeAudio } from '@/lib/mutations'

export default function AudioPage() {
    const { isConnected } = useConnection()

    // TTS state
    const [ttsInput, setTtsInput] = useState('')
    const [ttsVoice, setTtsVoice] = useState('alloy')
    const [ttsLoading, setTtsLoading] = useState(false)
    const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
    const [ttsError, setTtsError] = useState<string | null>(null)

    // STT state
    const [sttFile, setSttFile] = useState<File | null>(null)
    const [sttLoading, setSttLoading] = useState(false)
    const [sttResult, setSttResult] = useState<string | null>(null)
    const [sttError, setSttError] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    async function handleTTS() {
        if (!ttsInput.trim()) return
        setTtsLoading(true)
        setTtsError(null)
        setTtsAudioUrl(null)
        try {
            const blob = await textToSpeech({ input: ttsInput, voice: ttsVoice, response_format: 'mp3' })
            const url = URL.createObjectURL(blob)
            setTtsAudioUrl(url)
        } catch (e) {
            setTtsError((e as Error).message)
        } finally {
            setTtsLoading(false)
        }
    }

    async function handleFileUpload(file: File) {
        setSttFile(file)
        setSttLoading(true)
        setSttResult(null)
        setSttError(null)
        try {
            const result = await transcribeAudio(file)
            setSttResult(result.text)
        } catch (e) {
            setSttError((e as Error).message)
        } finally {
            setSttLoading(false)
        }
    }

    async function toggleRecording() {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            setIsRecording(false)
            return
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mr = new MediaRecorder(stream)
            chunksRef.current = []
            mr.ondataavailable = (e) => chunksRef.current.push(e.data)
            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop())
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                await handleFileUpload(new File([blob], 'recording.webm', { type: 'audio/webm' }))
            }
            mr.start()
            mediaRecorderRef.current = mr
            setIsRecording(true)
        } catch {
            setSttError('Microphone access denied')
        }
    }

    const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

    return (
        <DashboardLayout>
            <PageHeader
                title="Audio"
                subtitle="Text-to-speech synthesis and audio transcription via Opta LMX"
                icon={Mic}
            />

            <div className="px-8 py-6 space-y-6 hud-fade-in">
                {!isConnected && (
                    <div className="config-panel flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm font-mono tracking-wide">Connect to LMX to use audio features.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* TTS section */}
                    <div className="config-panel">
                        <div className="config-title flex items-center gap-2">
                            <Volume2 size={14} className="text-primary" />
                            Text to Speech
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="config-label">Text input</label>
                                <textarea
                                    className="holographic-input resize-none w-full"
                                    rows={4}
                                    placeholder="Enter text to synthesize…"
                                    value={ttsInput}
                                    onChange={(e) => setTtsInput(e.target.value)}
                                    disabled={!isConnected || ttsLoading}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="config-label">Voice</label>
                                    <select
                                        className="holographic-input w-full"
                                        value={ttsVoice}
                                        onChange={(e) => setTtsVoice(e.target.value)}
                                        disabled={!isConnected || ttsLoading}
                                    >
                                        {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="pt-6">
                                    <button
                                        onClick={handleTTS}
                                        disabled={!isConnected || ttsLoading || !ttsInput.trim()}
                                        className="holographic-btn flex items-center justify-center gap-2 h-10 px-6"
                                    >
                                        {ttsLoading ? <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> Synthesizing…</> : <><Play size={14} /> Generate</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {ttsError && (
                            <p className="text-xs text-[var(--opta-neon-red)] font-mono mt-4">{ttsError}</p>
                        )}
                        {ttsAudioUrl && (
                            <div className="mt-6 p-4 bg-[var(--opta-elevated)]/50 border border-[rgba(168,85,247,0.2)] rounded-xl relative overflow-hidden group">
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                                <p className="text-xs text-text-muted mb-3 font-mono uppercase tracking-wider">Generated Output</p>
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <audio controls src={ttsAudioUrl} className="w-full grayscale group-hover:grayscale-0 transition-all duration-500 opacity-90 group-hover:opacity-100" />
                            </div>
                        )}
                    </div>

                    {/* STT section */}
                    <div className="config-panel">
                        <div className="config-title flex items-center gap-2">
                            <Mic size={14} className="text-primary" />
                            Speech to Text
                            <span className="ml-auto text-[10px] font-mono text-text-muted bg-[var(--opta-elevated)] px-2 py-0.5 rounded border border-[rgba(168,85,247,0.15)]">
                                mlx-whisper
                            </span>
                        </div>

                        <div className="flex gap-4 mb-6">
                            {/* Upload zone */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!isConnected || sttLoading || isRecording}
                                className="flex-1 flex flex-col items-center justify-center gap-2 py-8 bg-[var(--opta-elevated)] border border-dashed border-[rgba(168,85,247,0.3)] rounded-xl text-text-muted hover:border-primary/80 hover:text-primary transition-all disabled:opacity-40 group"
                            >
                                <Upload size={24} className="group-hover:-translate-y-1 transition-transform" />
                                <span className="text-sm font-mono tracking-wide">{sttFile ? <span className="text-text-primary">{sttFile.name}</span> : 'Upload Audio'}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-60">WAV · MP3 · M4A · WebM</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                            />

                            {/* Record button */}
                            <button
                                onClick={toggleRecording}
                                disabled={!isConnected || sttLoading}
                                className={`flex-1 flex flex-col items-center justify-center gap-2 py-8 border border-dashed rounded-xl transition-all disabled:opacity-40 relative overflow-hidden ${isRecording
                                    ? 'bg-[var(--opta-neon-red)]/5 border-[var(--opta-neon-red)]/50 text-[var(--opta-neon-red)]'
                                    : 'bg-[var(--opta-elevated)] border-[rgba(168,85,247,0.3)] text-text-muted hover:border-primary/80 hover:text-primary'
                                    }`}
                            >
                                {isRecording && <div className="absolute inset-0 bg-[var(--opta-neon-red)]/10 animate-pulse pointer-events-none"></div>}
                                {isRecording ? <StopCircle size={24} className="animate-pulse" /> : <Mic size={24} className="group-hover:-translate-y-1 transition-transform" />}
                                <span className="text-sm font-mono tracking-wide">{isRecording ? 'Recording…' : 'Record'}</span>
                                <span className="text-[10px] uppercase tracking-wider opacity-60">From Microphone</span>
                            </button>
                        </div>

                        {sttLoading && (
                            <div className="p-4 flex items-center justify-center gap-3">
                                <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                                <p className="text-xs text-primary font-mono tracking-widest uppercase">Transcribing…</p>
                            </div>
                        )}
                        {sttError && (
                            <p className="text-xs text-[var(--opta-neon-red)] font-mono px-2">{sttError}</p>
                        )}
                        {sttResult && (
                            <div className="p-4 bg-[var(--opta-elevated)]/50 border border-[rgba(16,185,129,0.3)] rounded-xl relative">
                                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--opta-neon-green)] rounded-tl-sm"></div>
                                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[var(--opta-neon-green)] rounded-tr-sm"></div>
                                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[var(--opta-neon-green)] rounded-bl-sm"></div>
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--opta-neon-green)] rounded-br-sm"></div>

                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle size={14} className="text-[var(--opta-neon-green)]" />
                                    <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--opta-neon-green)]">Transcription Complete</span>
                                </div>
                                <p className="text-sm font-mono text-text-primary leading-relaxed whitespace-pre-wrap">{sttResult}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="config-panel">
                    <div className="config-title flex items-center gap-2">
                        <FileAudio size={14} className="text-text-muted" />
                        API Endpoints
                    </div>
                    <div className="space-y-3 mt-2">
                        {[
                            { method: 'POST', path: '/v1/audio/speech', desc: 'Text-to-speech (OpenAI compatible)' },
                            { method: 'POST', path: '/v1/audio/transcriptions', desc: 'Transcription via mlx-whisper' },
                        ].map(({ method, path, desc }) => (
                            <div key={path} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 font-mono text-xs p-3 rounded-lg bg-[var(--opta-elevated)] border border-[rgba(168,85,247,0.1)] hover:border-[rgba(168,85,247,0.3)] transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded bg-primary text-white font-bold">{method}</span>
                                    <span className="text-text-secondary">{path}</span>
                                </div>
                                <span className="text-text-muted sm:ml-auto">{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
