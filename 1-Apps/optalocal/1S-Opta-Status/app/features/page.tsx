// Note on dangerouslySetInnerHTML: the HTML rendered here is generated
// server-side from docs/features/*.md files that are committed to this
// repository. The content is not user-supplied and is never derived from
// external input, so XSS risk is not present in this context.

import { readFileSync } from 'fs'
import path from 'path'
import { marked } from 'marked'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const APPS = [
  { id: 'cli', label: 'CLI', name: 'Opta CLI', subtitle: '1D — Terminal & Daemon' },
  { id: 'lmx', label: 'LMX', name: 'Opta LMX', subtitle: '1M — MLX Inference' },
  { id: 'local-web', label: 'Local Web', name: 'Opta Local', subtitle: '1L — Dashboard & Chat' },
  { id: 'code-desktop', label: 'Code', name: 'Opta Code Desktop', subtitle: '1P — Desktop Client' },
  { id: 'init', label: 'Init', name: 'Opta Init', subtitle: '1O — Setup Portal' },
] as const

type AppId = (typeof APPS)[number]['id']

function readFeatureFile(appId: string): string {
  const filePath = path.join(process.cwd(), 'docs', 'features', `${appId}.md`)
  return readFileSync(filePath, 'utf-8')
}

function countFeatures(markdown: string): { total: number; complete: number } {
  const complete = (markdown.match(/^- \[x\]/gim) ?? []).length
  const pending = (markdown.match(/^- \[ \]/gim) ?? []).length
  return { total: complete + pending, complete }
}

function processMarkdown(raw: string): string {
  // Pre-process: replace GFM task list markers with Unicode placeholders
  // before marked sees them — prevents <input type="checkbox"> rendering.
  const preprocessed = raw
    .replace(/^- \[x\]\s*/gim, '- \u2611 ')
    .replace(/^- \[ \]\s*/gim, '- \u2610 ')

  const html = marked.parse(preprocessed) as string

  // Post-process: map placeholder characters to CSS class hooks
  return html
    .replace(/<li>\u2611\s*/g, '<li class="feature-done">')
    .replace(/<li>\u2610\s*/g, '<li class="feature-todo">')
}

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>
}) {
  const { app = 'cli' } = await searchParams
  const activeApp = APPS.find((a) => a.id === (app as AppId)) ?? APPS[0]

  // Read and render active app markdown
  let html = '<p class="text-text-muted italic">Feature list unavailable.</p>'
  let stats = { total: 0, complete: 0 }

  try {
    const raw = readFeatureFile(activeApp.id)
    stats = countFeatures(raw)
    html = processMarkdown(raw)
  } catch {
    // gracefully degrade if file is missing
  }

  // Aggregate stats across all apps for the global progress bar
  const allStats = APPS.reduce(
    (acc, a) => {
      try {
        const s = countFeatures(readFeatureFile(a.id))
        return { total: acc.total + s.total, complete: acc.complete + s.complete }
      } catch {
        return acc
      }
    },
    { total: 0, complete: 0 }
  )

  const allPct = allStats.total > 0 ? Math.round((allStats.complete / allStats.total) * 100) : 0
  const appPct = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-void text-text-primary">
      {/* Header */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Status
          </Link>
          <span className="text-xs font-mono text-text-muted">
            {allStats.complete}/{allStats.total} features ({allPct}%)
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-6">
        <h1 className="text-3xl font-bold font-sora tracking-tight mb-1.5">
          Feature Registry
        </h1>
        <p className="text-text-secondary text-sm">
          Canonical feature completeness across the optalocal stack.
        </p>

        {/* Global progress */}
        <div className="mt-6">
          <div className="h-1.5 rounded-full overflow-hidden bg-elevated">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${allPct}%`,
                background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-glow))',
              }}
            />
          </div>
          <div className="mt-1.5 text-xs text-text-muted font-mono">
            {allStats.complete} of {allStats.total} features implemented across all apps
          </div>
        </div>
      </div>

      {/* App tabs */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[var(--color-border)]">
          {APPS.map((a) => {
            const isActive = a.id === activeApp.id
            let appStats = { total: 0, complete: 0 }
            try {
              appStats = countFeatures(readFeatureFile(a.id))
            } catch {}

            return (
              <Link
                key={a.id}
                href={`/features?app=${a.id}`}
                className={`relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {a.label}
                {appStats.total > 0 && (
                  <span
                    className={`ml-1.5 text-xs font-mono ${
                      isActive ? 'text-primary/70' : 'text-text-muted/60'
                    }`}
                  >
                    {appStats.complete}/{appStats.total}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Feature content */}
      <div className="max-w-4xl mx-auto px-6 py-8 pb-20">
        <div className="glass rounded-xl p-6 sm:p-8">
          {/* App header */}
          <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-lg font-semibold font-sora">{activeApp.name}</h2>
              <div className="text-xs text-text-muted mt-0.5 font-mono">{activeApp.subtitle}</div>
            </div>
            {stats.total > 0 && (
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="text-xs font-mono text-text-muted bg-elevated px-3 py-1.5 rounded-full">
                  {stats.complete}/{stats.total}
                </span>
                <div className="w-20 h-1 rounded-full overflow-hidden bg-elevated">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${appPct}%`, backgroundColor: 'var(--color-primary)' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rendered markdown — source is repository files, not user input */}
          {/* eslint-disable-next-line react/no-danger */}
          <div className="feature-content" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  )
}
