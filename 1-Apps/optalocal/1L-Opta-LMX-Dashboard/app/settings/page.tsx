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
            setConnectionMsg('LMX endpoint is required.')
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
        setConnectionMsg('Connection settings applied.')
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
            setReloadMsg('Presets reloaded.')
        } catch (e) { setReloadMsg((e as Error).message) }
        finally { setReloading(false) }
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Settings"
                subtitle="Connection parameters and engine directives"
                icon={Settings}
            />

            <div className="px-8 py-6 hud-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Connection Parameters */}
                    <div className="config-panel">
                        <div className="config-title">Connection Parameters</div>
                        <div className="space-y-5">
                            <div>
                                <p className="config-label">Control Mode</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-mono text-text-secondary">
                                        {pairedDevice.mode === 'paired' ? 'paired-device' : 'direct-connect'}
                                    </span>
                                    {pairedDevice.mode === 'paired' ? (
                                        <button
                                            className="holographic-btn !py-1 !px-2 !text-[10px]"
                                            onClick={() => pairedDevice.switchToDirectMode()}
                                        >
                                            Switch to Direct Fallback
                                        </button>
                                    ) : (
                                        <button
                                            className="holographic-btn !py-1 !px-2 !text-[10px]"
                                            onClick={() => {
                                                pairedDevice.clearPairing()
                                                window.location.href = '/pair'
                                            }}
                                        >
                                            Re-enable Pairing
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="config-label">LMX Node Endpoint</p>
                                <input
                                    type="text"
                                    className="holographic-input"
                                    value={endpoint}
                                    onChange={e => {
                                        setEndpoint(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                />
                            </div>
                            <div>
                                <p className="config-label">Admin Authentication Key</p>
                                <input
                                    type="password"
                                    className="holographic-input"
                                    value={adminKeyInput}
                                    onChange={e => {
                                        setAdminKeyInput(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <p className="config-label">Inference API Key (Bearer)</p>
                                <input
                                    type="password"
                                    className="holographic-input"
                                    value={inferenceKeyInput}
                                    onChange={e => {
                                        setInferenceKeyInput(e.target.value)
                                        setConnectionMsg(null)
                                    }}
                                    placeholder="sk-..."
                                />
                            </div>
                            <div>
                                <p className="config-label">Connection Status</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`status-dot ${status === 'connected' ? 'status-dot-online'
                                            : status === 'connecting' ? 'status-dot-loading'
                                                : 'status-dot-offline'
                                        }`} />
                                    <span className="text-sm font-mono text-text-secondary">{status}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleApplyConnection}
                                disabled={!hasConnectionChanges}
                                className="holographic-btn w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Apply Connection & Keys
                            </button>
                            {connectionMsg && (
                                <p className="text-xs font-mono text-text-muted">{connectionMsg}</p>
                            )}
                        </div>
                    </div>

                    {/* Engine Directives */}
                    <div className="config-panel">
                        <div className="config-title">Engine Directives</div>
                        <div className="space-y-5">
                            <div>
                                <p className="config-label">Unified Memory Soft Limit</p>
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
                            </div>
                            <div>
                                <p className="config-label">Default Context Length (Tokens)</p>
                                <input
                                    type="text"
                                    className="holographic-input"
                                    value={contextLength}
                                    onChange={e => setContextLength(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleReloadConfig} disabled={reloading || status !== 'connected'} className="holographic-btn flex-1 flex items-center justify-center gap-2">
                                    {reloading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Reload Config
                                </button>
                                <button onClick={handleReloadPresets} disabled={reloading || status !== 'connected'} className="holographic-btn flex-1 flex items-center justify-center gap-2">
                                    {reloading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Reload Presets
                                </button>
                            </div>
                            {reloadMsg && <p className="text-xs font-mono text-text-muted">{reloadMsg}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
