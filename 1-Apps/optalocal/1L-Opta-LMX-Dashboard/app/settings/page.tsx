'use client'

import { Loader2, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { getInferenceKey } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import { usePairedDevice } from '@/lib/paired-device'
import { reloadConfig, reloadPresets } from '@/lib/mutations'

const INFERENCE_KEY_STORAGE_KEY = 'opta-lmx-inference-key'

function normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, '')
}

function normalizeKey(value: string): string | null {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

export default function SettingsPage() {
    const pairedDevice = usePairedDevice()
    const {
        url,
        adminKey,
        setUrl,
        setAdminKey,
        setInferenceApiKey,
        status,
    } = useConnection()

    const [endpoint, setEndpoint] = useState(url)
    const [adminKeyInput, setAdminKeyInput] = useState(adminKey ?? '')
    const [inferenceKeyInput, setInferenceKeyInput] = useState('')
    const [appliedInferenceKey, setAppliedInferenceKey] = useState('')
    const [connectionMsg, setConnectionMsg] = useState<string | null>(null)
    const [memoryLimit, setMemoryLimit] = useState(85)
    const [contextLength, setContextLength] = useState('16384')
    const [reloading, setReloading] = useState(false)
    const [reloadMsg, setReloadMsg] = useState<string | null>(null)

    useEffect(() => {
        setEndpoint(url)
    }, [url])

    useEffect(() => {
        setAdminKeyInput(adminKey ?? '')
    }, [adminKey])

    useEffect(() => {
        const apiInferenceKey = getInferenceKey()
        const storedInferenceKey =
            typeof window !== 'undefined'
                ? localStorage.getItem(INFERENCE_KEY_STORAGE_KEY)
                : null
        const initialInferenceKey = apiInferenceKey ?? storedInferenceKey ?? ''
        setInferenceKeyInput(initialInferenceKey)
        setAppliedInferenceKey(initialInferenceKey)
    }, [])

    const hasConnectionChanges = useMemo(() => {
        const activeAdminKey = adminKey ?? ''
        return (
            normalizeUrl(endpoint) !== normalizeUrl(url) ||
            adminKeyInput !== activeAdminKey ||
            inferenceKeyInput !== appliedInferenceKey
        )
    }, [adminKey, adminKeyInput, appliedInferenceKey, endpoint, inferenceKeyInput, url])

    function handleApplyConnection() {
        const cleanedEndpoint = normalizeUrl(endpoint)
        if (!cleanedEndpoint) {
            setConnectionMsg('Server address is required.')
            return
        }

        const normalizedAdminKey = normalizeKey(adminKeyInput)
        const normalizedInferenceKey = normalizeKey(inferenceKeyInput)

        setUrl(cleanedEndpoint)
        setAdminKey(normalizedAdminKey)
        setInferenceApiKey(normalizedInferenceKey)

        setEndpoint(cleanedEndpoint)
        setAdminKeyInput(normalizedAdminKey ?? '')
        setInferenceKeyInput(normalizedInferenceKey ?? '')
        setAppliedInferenceKey(normalizedInferenceKey ?? '')
        setConnectionMsg('Settings saved.')
    }

    async function handleReloadConfig() {
        setReloading(true)
        setReloadMsg(null)
        try {
            await reloadConfig()
            setReloadMsg('Configuration reloaded.')
        } catch (e) { setReloadMsg((e as Error).message) }
        finally { setReloading(false) }
    }

    async function handleReloadPresets() {
        setReloading(true)
        setReloadMsg(null)
        try {
            await reloadPresets()
            setReloadMsg('Model presets reloaded.')
        } catch (e) { setReloadMsg((e as Error).message) }
        finally { setReloading(false) }
    }

    const connectionMode = pairedDevice.mode === 'paired' ? 'Paired' : 'Direct address'
    const statusColor =
        status === 'connected' ? 'text-[var(--opta-neon-green)]'
            : status === 'connecting' ? 'text-[var(--opta-neon-amber)]'
                : 'text-[var(--opta-neon-red)]'
    const statusLabel =
        status === 'connected' ? 'Connected'
            : status === 'connecting' ? 'Connecting…'
                : 'Disconnected'

    return (
        <DashboardLayout>
            <PageHeader
                title="Settings"
                subtitle="Connection and performance settings"
                icon={Settings}
            />

            <div className="px-8 py-6 hud-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Server Connection */}
                    <div className="config-panel">
                        <div className="config-title">Server Connection</div>
                        <div className="space-y-5">

                            {/* Connection mode */}
                            <div>
                                <p className="config-label">Connection Mode</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-mono text-text-secondary">
                                        {connectionMode}
                                    </span>
                                    {pairedDevice.mode === 'paired' ? (
                                        <button
                                            className="holographic-btn !py-1 !px-2 !text-[10px]"
                                            onClick={() => pairedDevice.switchToDirectMode()}
                                            title="Enter the server address manually instead of using pairing"
                                        >
                                            Enter address manually
                                        </button>
                                    ) : (
                                        <button
                                            className="holographic-btn !py-1 !px-2 !text-[10px]"
                                            onClick={() => {
                                                pairedDevice.clearPairing()
                                                window.location.href = '/pair'
                                            }}
                                            title="Use the pairing flow to connect automatically"
                                        >
                                            Use paired connection
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-text-muted mt-1">
                                    {pairedDevice.mode === 'paired'
                                        ? 'Connected via pairing — server address is set automatically.'
                                        : 'Enter your server address below to connect directly.'}
                                </p>
                            </div>

                            {/* Server address */}
                            <div>
                                <p className="config-label">Server Address</p>
                                <input
                                    type="text"
                                    className="holographic-input"
                                    value={endpoint}
                                    placeholder="192.168.1.x:1234"
                                    onChange={e => {
                                        setEndpoint(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                />
                                <p className="text-[11px] text-text-muted mt-1">
                                    The address of your Opta LMX server, e.g. <span className="font-mono">192.168.188.11:1234</span>
                                </p>
                            </div>

                            {/* Admin key */}
                            <div>
                                <p className="config-label">Admin Key</p>
                                <input
                                    type="password"
                                    className="holographic-input"
                                    value={adminKeyInput}
                                    onChange={e => {
                                        setAdminKeyInput(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                    placeholder="Leave blank if not set"
                                />
                                <p className="text-[11px] text-text-muted mt-1">
                                    Required to manage models and reload configuration.
                                </p>
                            </div>

                            {/* Inference API key */}
                            <div>
                                <p className="config-label">API Key</p>
                                <input
                                    type="password"
                                    className="holographic-input"
                                    value={inferenceKeyInput}
                                    onChange={e => {
                                        setInferenceKeyInput(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                    placeholder="Leave blank if LMX has no key set"
                                />
                                <p className="text-[11px] text-text-muted mt-1">
                                    Sent with every AI request. Leave blank if your server doesn&apos;t require one.
                                </p>
                            </div>

                            {/* Status */}
                            <div>
                                <p className="config-label">Status</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`status-dot ${status === 'connected' ? 'status-dot-online'
                                        : status === 'connecting' ? 'status-dot-loading'
                                            : 'status-dot-offline'
                                        }`} />
                                    <span className={`text-sm font-mono ${statusColor}`}>{statusLabel}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleApplyConnection}
                                disabled={!hasConnectionChanges}
                                className="holographic-btn w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save & Connect
                            </button>
                            {connectionMsg && (
                                <p className="text-xs font-mono text-text-muted">{connectionMsg}</p>
                            )}
                        </div>
                    </div>

                    {/* Performance */}
                    <div className="config-panel">
                        <div className="config-title">Performance</div>
                        <div className="space-y-5">

                            <div>
                                <p className="config-label">Memory Limit</p>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        className="holographic-slider flex-1"
                                        min={10}
                                        max={95}
                                        value={memoryLimit}
                                        onChange={e => setMemoryLimit(Number(e.target.value))}
                                    />
                                    <span className="font-mono text-sm text-primary w-10 text-right">{memoryLimit}%</span>
                                </div>
                                <p className="text-[11px] text-text-muted mt-1">
                                    How much RAM the AI can use. Keeping this under 90% prevents crashes when running large models.
                                </p>
                            </div>

                            <div>
                                <p className="config-label">Conversation Memory</p>
                                <input
                                    type="text"
                                    className="holographic-input"
                                    value={contextLength}
                                    onChange={e => setContextLength(e.target.value)}
                                />
                                <p className="text-[11px] text-text-muted mt-1">
                                    How much of a conversation the AI remembers at once, in tokens. 16,384 is a good default — higher values use more memory.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <button
                                        onClick={handleReloadConfig}
                                        disabled={reloading || status !== 'connected'}
                                        className="holographic-btn w-full flex items-center justify-center gap-2"
                                        title="Apply updated settings files without restarting the server"
                                    >
                                        {reloading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Reload Settings
                                    </button>
                                    <p className="text-[10px] text-text-muted mt-1 text-center">
                                        Applies config file changes
                                    </p>
                                </div>
                                <div className="flex-1">
                                    <button
                                        onClick={handleReloadPresets}
                                        disabled={reloading || status !== 'connected'}
                                        className="holographic-btn w-full flex items-center justify-center gap-2"
                                        title="Reload saved model configurations from disk"
                                    >
                                        {reloading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Reload Presets
                                    </button>
                                    <p className="text-[10px] text-text-muted mt-1 text-center">
                                        Refreshes saved model configs
                                    </p>
                                </div>
                            </div>
                            {reloadMsg && <p className="text-xs font-mono text-text-muted">{reloadMsg}</p>}
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    )
}
