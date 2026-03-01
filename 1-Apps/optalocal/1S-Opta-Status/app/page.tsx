'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Terminal, Server, Globe, RefreshCw, ExternalLink, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { OptaRing } from '@/components/OptaRing'
import { FALLBACK_RELEASE_NOTES } from './release-notes'
import { GENERATED_RELEASE_NOTES } from './release-notes.generated'

type ServiceStatus = 'online' | 'offline' | 'degraded' | 'checking' | 'unconfigured'

interface HealthData {
  status: ServiceStatus
  version?: string
  latency?: number
  error?: string
  // LMX specific
  models_loaded?: number
  loaded_models?: number
  memory_percent?: number
  // Daemon specific
  uptime?: number
  sessions?: number
}

interface ServiceDef {
  id: string
  name: string
  subtitle: string
  icon: React.ElementType
  docs?: string
  metricFn?: (d: HealthData) => string | null
}

const SERVICES: ServiceDef[] = [
  {
    id: 'lmx',
    name: 'Opta LMX',
    subtitle: 'MLX inference server',
    icon: Cpu,
    metricFn: (d) => {
      const n = d.models_loaded ?? d.loaded_models
      if (n != null) return `${n} model${n !== 1 ? 's' : ''} loaded`
      if (d.memory_percent != null) return `${d.memory_percent}% memory`
      return null
    },
  },
  {
    id: 'daemon',
    name: 'Opta Daemon',
    subtitle: 'CLI session orchestrator',
    icon: Terminal,
    metricFn: (d) => {
      if (d.uptime != null) return `Up ${Math.floor(d.uptime / 60)}m`
      if (d.sessions != null) return `${d.sessions} session${d.sessions !== 1 ? 's' : ''}`
      return null
    },
  },
  {
    id: 'local',
    name: 'OptaLocal.com',
    subtitle: 'Opta Local management website',
    icon: Server,
    docs: 'https://optalocal.com',
  },
  {
    id: 'init',
    name: 'Opta Init',
    subtitle: 'Setup & download portal',
    icon: Globe,
    docs: 'https://init.optalocal.com',
  },
  {
    id: 'accounts',
    name: 'Opta Accounts',
    subtitle: 'Identity, SSO & capability control',
    icon: Globe,
    docs: 'https://accounts.optalocal.com',
  },
  {
    id: 'help',
    name: 'Opta Help',
    subtitle: 'Documentation & support',
    icon: Globe,
    docs: 'https://help.optalocal.com',
  },
]

const BORDER_COLOR: Record<ServiceStatus, string> = {
  online: 'var(--color-neon-green)',
  degraded: 'var(--color-neon-amber)',
  offline: 'var(--color-neon-red)',
  checking: 'var(--color-primary)',
  unconfigured: 'var(--color-text-muted)',
}

const BADGE: Record<ServiceStatus, { bg: string; text: string; dot: string }> = {
  online: { bg: 'bg-green-500/10', text: 'text-neon-green', dot: 'bg-neon-green' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-neon-amber', dot: 'bg-neon-amber animate-pulse' },
  offline: { bg: 'bg-red-500/10', text: 'text-neon-red', dot: 'bg-neon-red' },
  checking: { bg: 'bg-violet-500/10', text: 'text-primary', dot: 'bg-primary animate-pulse' },
  unconfigured: { bg: 'bg-zinc-500/10', text: 'text-text-muted', dot: 'bg-text-muted' },
}

const RELEASE_NOTES =
  GENERATED_RELEASE_NOTES.length > 0
    ? GENERATED_RELEASE_NOTES
    : FALLBACK_RELEASE_NOTES

function StatusBadge({ status }: { status: ServiceStatus }) {
  const b = BADGE[status]
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${b.bg} ${b.text}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
      {status}
    </div>
  )
}

export default function StatusPage() {
  const [health, setHealth] = useState<Record<string, HealthData>>(() => {
    const init: Record<string, HealthData> = {}
    SERVICES.forEach((s) => { init[s.id] = { status: 'checking' } })
    return init
  })
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    const results = await Promise.allSettled(
      SERVICES.map(async (svc) => {
        const res = await fetch(`/api/health/${svc.id}`, { cache: 'no-store' })
        const data = (await res.json()) as HealthData
        return { id: svc.id, data }
      })
    )
    setHealth((prev) => {
      const next = { ...prev }
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next[SERVICES[i].id] = r.value.data
        } else {
          next[SERVICES[i].id] = { status: 'offline', error: 'Network error' }
        }
      })
      return next
    })
    setLastChecked(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [fetchAll])

  const statuses = SERVICES.map((s) => health[s.id]?.status ?? 'checking')
  const allOnline = statuses.every((s) => s === 'online')
  const anyOffline = statuses.some((s) => s === 'offline')
  const anyChecking = statuses.some((s) => s === 'checking')

  const overallColor = anyOffline
    ? 'var(--color-neon-red)'
    : allOnline
    ? 'var(--color-neon-green)'
    : 'var(--color-neon-amber)'

  return (
    <div className="min-h-screen bg-void text-text-primary">
      {/* Header bar */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <OptaRing size={48} className="shrink-0 scale-[0.6] origin-center -ml-2" paused={!allOnline || anyOffline} />
            <span className="font-mono text-sm text-text-secondary tracking-tight -ml-2">
              status.optalocal.com
            </span>
          </div>

          <div className="flex items-center gap-4">
            {lastChecked && (
              <span className="hidden sm:block text-xs text-text-muted font-mono">
                {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchAll}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1 rounded hover:bg-elevated disabled:opacity-50"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <Link
              href="#release-notes"
              className="hidden sm:flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
            >
              Release Notes
              <ArrowRight size={11} />
            </Link>
            <Link
              href="/features"
              className="flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
            >
              Features
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-14 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-4xl font-bold font-sora tracking-tight mb-2">
            Opta Status
          </h1>
          <p className="text-text-secondary">
            Real-time health of the{' '}
            <span className="text-primary">
              Opta Local
            </span>{' '}
            ecosystem.
          </p>
        </motion.div>

        {/* Overall banner */}
        <motion.div
          className="mt-7 rounded-xl p-4 flex items-center gap-3 glass-subtle"
          style={{
            borderLeftWidth: 3,
            borderLeftStyle: 'solid',
            borderLeftColor: overallColor,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: overallColor }}
          />
          <span className="text-sm font-medium">
            {anyChecking
              ? 'Checking service status…'
              : anyOffline
              ? 'One or more services are offline'
              : allOnline
              ? 'All systems operational'
              : 'Some services are degraded'}
          </span>
          {lastChecked && (
            <span className="ml-auto text-xs text-text-muted font-mono hidden sm:block">
              Auto-refreshes every 30s
            </span>
          )}
        </motion.div>
      </div>

      {/* Service cards */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 gap-4">
          {SERVICES.map((svc, i) => {
            const h = health[svc.id]
            const status = h?.status ?? 'checking'
            const Icon = svc.icon
            const metric = h && svc.metricFn ? svc.metricFn(h) : null

            return (
              <motion.div
                key={svc.id}
                className="glass rounded-xl p-5"
                style={{
                  borderLeftWidth: 4,
                  borderLeftStyle: 'solid',
                  borderLeftColor: BORDER_COLOR[status],
                }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.3 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-elevated">
                      <Icon size={17} className="text-text-secondary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm leading-none">{svc.name}</div>
                      <div className="text-xs text-text-muted mt-1">{svc.subtitle}</div>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
                    {h?.version && <span>v{h.version}</span>}
                    {metric && <span className="text-text-secondary">{metric}</span>}
                    {!h?.version && !metric && status === 'unconfigured' && (
                      <span className="text-text-muted italic">tunnel not configured</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {h?.latency != null && (
                      <span className="text-xs font-mono text-text-muted">{h.latency}ms</span>
                    )}
                    {svc.docs && (
                      <a
                        href={svc.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-text-secondary transition-colors"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                {h?.error && status === 'offline' && (
                  <div className="mt-2.5 text-xs text-neon-amber/70 font-mono truncate">
                    {h.error}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Release notes */}
        <motion.section
          id="release-notes"
          className="mt-12"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.3 }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold font-sora tracking-tight">
                Release Notes
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Recent platform updates across the Opta Local ecosystem.
              </p>
            </div>
            <Link
              href="/features"
              className="text-xs text-text-muted hover:text-primary transition-colors whitespace-nowrap"
            >
              View feature registry
            </Link>
          </div>

          <div className="space-y-3">
            {RELEASE_NOTES.map((note) => {
              const isRolling = note.status === 'rolling_out'
              return (
                <article key={note.id} className="glass rounded-xl p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-mono text-text-muted">
                      {note.date}
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        isRolling
                          ? 'bg-amber-500/10 text-neon-amber'
                          : 'bg-green-500/10 text-neon-green'
                      }`}
                    >
                      {isRolling ? 'Rolling Out' : 'Released'}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm sm:text-base font-semibold text-text-primary">
                    {note.title}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {note.summary}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {note.highlights.map((item) => (
                      <li
                        key={item}
                        className="text-xs text-text-secondary flex items-start gap-2"
                      >
                        <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {note.links && note.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {note.links.map((link) => (
                        <Link
                          key={link.href + link.label}
                          href={link.href}
                          className="text-xs text-primary hover:text-primary-glow transition-colors inline-flex items-center gap-1"
                        >
                          {link.label}
                          <ArrowRight size={11} />
                        </Link>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </motion.section>

        {/* Footer nav */}
        <motion.div
          className="mt-14 pt-8 border-t border-[var(--color-border)] flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            href="/features"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors group"
          >
            View feature registry
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <span className="text-xs text-text-muted font-mono">
            Opta Local ecosystem
          </span>
        </motion.div>
      </div>
    </div>
  )
}
