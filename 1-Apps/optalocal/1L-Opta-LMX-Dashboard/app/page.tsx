'use client'

import { Activity, Box, Cpu, HardDrive, Zap } from 'lucide-react'

function StatCard({
    icon: Icon,
    label,
    value,
    unit,
}: {
    icon: React.ElementType
    label: string
    value: string
    unit?: string
}) {
    return (
        <div className="dashboard-card flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <Icon size={20} />
            </div>
            <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">
                    {label}
                </p>
                <p className="text-xl font-semibold font-mono">
                    {value}
                    {unit && (
                        <span className="text-sm text-text-muted ml-1">{unit}</span>
                    )}
                </p>
            </div>
        </div>
    )
}

export default function DashboardHome() {
    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="border-b border-[var(--opta-border)] glass-subtle">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/15 border border-primary/30">
                            <Zap size={16} className="text-primary" />
                        </div>
                        <h1
                            className="text-sm font-semibold tracking-wide"
                            style={{
                                background:
                                    'linear-gradient(135deg, var(--opta-primary) 0%, var(--opta-primary-glow) 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            Opta LMX
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="status-dot status-dot-offline" />
                        <span className="text-xs text-text-muted font-mono">
                            disconnected
                        </span>
                    </div>
                </div>
            </header>

            {/* Dashboard Grid */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard icon={Box} label="Loaded Models" value="—" />
                    <StatCard icon={Cpu} label="Tokens/sec" value="—" />
                    <StatCard icon={HardDrive} label="Memory" value="—" unit="GB" />
                    <StatCard icon={Activity} label="Requests" value="—" />
                </div>

                {/* Placeholder content */}
                <div className="dashboard-card text-center py-16">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-6">
                        <Zap size={28} className="text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">
                        Opta LMX Dashboard
                    </h2>
                    <p className="text-sm text-text-secondary max-w-md mx-auto mb-6">
                        The primary management surface for your local AI inference engine.
                        Connect to your Opta LMX instance to monitor models, memory, and
                        throughput.
                    </p>
                    <p className="text-xs text-text-muted font-mono">
                        Default endpoint: 192.168.188.11:1234
                    </p>
                </div>
            </div>
        </main>
    )
}
