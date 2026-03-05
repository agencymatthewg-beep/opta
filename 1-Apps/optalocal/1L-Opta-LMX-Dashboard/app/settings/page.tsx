'use client'

import { Settings, RefreshCw, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { reloadConfig, reloadPresets } from '@/lib/mutations'

export default function SettingsPage() {
    const { url, setUrl, status } = useConnection()
    const [endpoint, setEndpoint] = useState(url)
    const [adminKey, setAdminKey] = useState('')
    const [memoryLimit, setMemoryLimit] = useState(85)
    const [contextLength, setContextLength] = useState('16384')
    const [reloading, setReloading] = useState(false)
    const [reloadMsg, setReloadMsg] = useState<string | null>(null)

    function handleSaveConnection() {
        setUrl(endpoint)
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
                                <p className="config-label">LMX Node Endpoint</p>
                                <input
                                    type="text"
                                    className="holographic-input"
                                    value={endpoint}
                                    onChange={e => setEndpoint(e.target.value)}
                                />
                            </div>
                            <div>
                                <p className="config-label">Admin Authentication Key</p>
                                <input
                                    type="password"
                                    className="holographic-input"
                                    value={adminKey}
                                    onChange={e => setAdminKey(e.target.value)}
                                    placeholder="••••••••"
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
                            <button onClick={handleSaveConnection} className="holographic-btn w-full">
                                Apply Connection
                            </button>
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
