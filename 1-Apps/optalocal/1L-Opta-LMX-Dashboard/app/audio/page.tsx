'use client'

import { Mic, Volume2, FileAudio, Upload, Play, StopCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { useState, useRef } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useConnection } from '@/lib/connection'
import { textToSpeech, transcribeAudio } from '@/lib/mutations'

function PageHeader({ title, subtitle, icon: Icon }: {
    title: string; subtitle: string; icon: React.ElementType
}) {
    return (
        <div className="border-b border-[var(--opta-border)] px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                </div>
                <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            <p className="text-sm text-text-secondary ml-12">{subtitle}</p>
        </div>
    )
}

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

            <div className="px-8 py-6 space-y-6">
                {!isConnected && (
                    <div className="dashboard-card flex items-center gap-3 text-[var(--opta-neon-amber)]">
                        <AlertCircle size={16} />
                        <span className="text-sm">Connect to LMX to use audio features.</span>
                    </div>
                )}

                {/* TTS section */}
                <div className="dashboard-card">
                    <div className="flex items-center gap-2 mb-5">
                        <Volume2 size={16} className="text-primary" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                            Text to Speech
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div className="lg:col-span-2">
                            <textarea
                                className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 text-text-primary placeholder:text-text-muted"
                                rows={4}
                                placeholder="Enter text to synthesize…"
                                value={ttsInput}
                                onChange={(e) => setTtsInput(e.target.value)}
                                disabled={!isConnected || ttsLoading}
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="text-xs text-text-muted mb-1.5 block">Voice</label>
                                <select
                                    className="w-full bg-[var(--opta-elevated)] border border-[var(--opta-border)] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
                                    value={ttsVoice}
                                    onChange={(e) => setTtsVoice(e.target.value)}
                                    disabled={!isConnected || ttsLoading}
                                >
                                    {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={handleTTS}
                                disabled={!isConnected || ttsLoading || !ttsInput.trim()}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-auto"
                            >
                                <Play size={14} />
                                {ttsLoading ? 'Synthesizing…' : 'Generate'}
                            </button>
                        </div>
                    </div>

                    {ttsError && (
                        <p className="text-xs text-[var(--opta-neon-red)] font-mono mt-2">{ttsError}</p>
                    )}
                    {ttsAudioUrl && (
                        <div className="mt-4 p-4 bg-[var(--opta-elevated)] rounded-lg">
                            <p className="text-xs text-text-muted mb-2">Generated audio</p>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio controls src={ttsAudioUrl} className="w-full" />
                        </div>
                    )}
                </div>

                {/* STT section */}
                <div className="dashboard-card">
                    <div className="flex items-center gap-2 mb-5">
                        <Mic size={16} className="text-primary" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                            Speech to Text
                        </h2>
                        <span className="ml-auto text-xs font-mono text-text-muted bg-[var(--opta-elevated)] px-2 py-0.5 rounded">
                            mlx-whisper
                        </span>
                    </div>

                    <div className="flex gap-3 mb-4">
                        {/* Upload zone */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!isConnected || sttLoading || isRecording}
                            className="flex-1 flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-[var(--opta-border)] rounded-lg text-text-muted hover:border-primary/40 hover:text-text-secondary transition-colors disabled:opacity-40"
                        >
                            <Upload size={20} />
                            <span className="text-sm">{sttFile ? sttFile.name : 'Upload audio file'}</span>
                            <span className="text-xs">WAV · MP3 · M4A · WebM</span>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        />

                        <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                            <span className="text-xs">or</span>
                        </div>

                        {/* Record button */}
                        <button
                            onClick={toggleRecording}
                            disabled={!isConnected || sttLoading}
                            className={`flex-1 flex flex-col items-center justify-center gap-2 py-8 border border-dashed rounded-lg transition-all disabled:opacity-40 ${isRecording
                                ? 'border-[var(--opta-neon-red)] text-[var(--opta-neon-red)] animate-pulse'
                                : 'border-[var(--opta-border)] text-text-muted hover:border-primary/40 hover:text-text-secondary'
                                }`}
                        >
                            {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                            <span className="text-sm">{isRecording ? 'Stop recording' : 'Record from mic'}</span>
                        </button>
                    </div>

                    {sttLoading && (
                        <p className="text-xs text-text-muted font-mono animate-pulse">Transcribing…</p>
                    )}
                    {sttError && (
                        <p className="text-xs text-[var(--opta-neon-red)] font-mono">{sttError}</p>
                    )}
                    {sttResult && (
                        <div className="mt-4 p-4 bg-[var(--opta-elevated)] rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={13} className="text-[var(--opta-neon-green)]" />
                                <span className="text-xs text-text-muted">Transcription</span>
                            </div>
                            <p className="text-sm font-mono text-text-primary leading-relaxed">{sttResult}</p>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="dashboard-card">
                    <div className="flex items-center gap-2 mb-3">
                        <FileAudio size={14} className="text-text-muted" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Endpoints</h3>
                    </div>
                    <div className="space-y-2">
                        {[
                            { method: 'POST', path: '/v1/audio/speech', desc: 'Text-to-speech (OpenAI compatible)' },
                            { method: 'POST', path: '/v1/audio/transcriptions', desc: 'Transcription via mlx-whisper' },
                        ].map(({ method, path, desc }) => (
                            <div key={path} className="flex items-center gap-3 font-mono text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary">{method}</span>
                                <span className="text-text-secondary">{path}</span>
                                <span className="text-text-muted ml-auto">{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
