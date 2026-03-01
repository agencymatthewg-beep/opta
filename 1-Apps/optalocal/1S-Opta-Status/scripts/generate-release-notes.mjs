#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const APP_ROOT = path.resolve(__dirname, '..')
const OPTALOCAL_ROOT = path.resolve(APP_ROOT, '..')
const OUTPUT_FILE = path.join(APP_ROOT, 'app', 'release-notes.generated.ts')
const MAX_NOTES = 10

const SOURCES = [
  {
    key: 'cli',
    label: 'Opta CLI',
    updatesDir: path.join(OPTALOCAL_ROOT, '1D-Opta-CLI-TS', 'updates'),
    featuresHref: '/features?app=cli',
  },
  {
    key: 'lmx',
    label: 'Opta LMX',
    updatesDir: path.join(OPTALOCAL_ROOT, '1M-Opta-LMX', 'updates'),
    featuresHref: '/features?app=lmx',
  },
]

function toLocalDateIso(date = new Date()) {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => {
      if (part.toUpperCase() === part) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const out = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const idx = trimmed.indexOf(':')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (value === 'true') out[key] = true
    else if (value === 'false') out[key] = false
    else if (/^-?\d+$/.test(value)) out[key] = Number(value)
    else out[key] = value
  }

  return out
}

function extractSection(markdown, heading) {
  const re = new RegExp(
    `^##\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=^##\\s+|\\Z)`,
    'm',
  )
  return markdown.match(re)?.[1]?.trim() ?? ''
}

function extractSummaryBullets(markdown) {
  const summary = extractSection(markdown, 'Summary')
  if (!summary) return []

  const bullets = []
  for (const line of summary.split('\n')) {
    const match = line.match(/^- (.+)$/)
    if (match) bullets.push(match[1].trim())
  }
  return bullets
}

function normalizeTitle(rawTitle) {
  return rawTitle
    .replace(/\s+/g, ' ')
    .replace(/^\-\s*/, '')
    .trim()
}

async function readEntriesFromSource(source) {
  let files
  try {
    files = await fs.readdir(source.updatesDir)
  } catch {
    return []
  }

  const entries = []
  for (const file of files) {
    if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') continue

    const match = file.match(/^(\d+)_([0-9]{4}-[0-9]{2}-[0-9]{2})_(.+)\.md$/)
    if (!match) continue

    const numericId = Number(match[1])
    const filenameDate = match[2]
    const slug = match[3]
    const fullPath = path.join(source.updatesDir, file)

    let markdown = ''
    try {
      markdown = await fs.readFile(fullPath, 'utf-8')
    } catch {
      continue
    }

    const frontmatter = parseFrontmatter(markdown)
    const summaryBullets = extractSummaryBullets(markdown)
    const headingTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
    const title =
      normalizeTitle(headingTitle || summaryBullets[0] || slugToTitle(slug))

    entries.push({
      source: source.key,
      sourceLabel: source.label,
      sourceFeaturesHref: source.featuresHref,
      file,
      numericId,
      date: String(frontmatter.date || filenameDate),
      time: frontmatter.time ? String(frontmatter.time) : '',
      slug,
      title,
      summaryBullets,
      promoted: frontmatter.promoted === true,
    })
  }

  return entries
}

function classifyGroup(entry) {
  if (/^(load|unload)-/.test(entry.slug)) {
    return { kind: 'model-runtime', key: `model-runtime:${entry.date}` }
  }
  if (entry.slug.includes('opta-update')) {
    return { kind: 'stack-sync', key: `stack-sync:${entry.date}` }
  }
  return { kind: 'direct', key: `direct:${entry.date}:${entry.slug}` }
}

function buildNotes(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const { kind, key } = classifyGroup(entry)
    const existing = groups.get(key)
    if (existing) {
      existing.entries.push(entry)
      existing.maxId = Math.max(existing.maxId, entry.numericId)
    } else {
      groups.set(key, {
        key,
        kind,
        date: entry.date,
        entries: [entry],
        maxId: entry.numericId,
      })
    }
  }

  const today = toLocalDateIso()
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.maxId - a.maxId
  })

  return sortedGroups.slice(0, MAX_NOTES).map((group, index) => {
    const noteId = `${group.date}-${group.kind}-${index + 1}`
    const status = group.date === today ? 'rolling_out' : 'released'

    if (group.kind === 'model-runtime') {
      let loads = 0
      let unloads = 0
      const models = new Set()
      for (const e of group.entries) {
        if (e.slug.startsWith('load-')) loads += 1
        if (e.slug.startsWith('unload-')) unloads += 1
        const model = e.title.replace(/^(Load|Unload)\s+/i, '').trim()
        if (model) models.add(model)
      }

      const highlights = [
        `Loads: ${loads} · Unloads: ${unloads}`,
      ]
      if (models.size > 0) {
        highlights.push(
          `Models touched: ${[...models].slice(0, 3).join(', ')}${models.size > 3 ? '…' : ''}`,
        )
      }
      highlights.push('Source: Opta LMX update logs')

      return {
        id: noteId,
        date: group.date,
        title: 'Model Runtime Activity',
        summary: `${group.entries.length} model lifecycle events were recorded for the LMX runtime.`,
        status,
        highlights,
        links: [{ label: 'LMX Features', href: '/features?app=lmx' }],
      }
    }

    if (group.kind === 'stack-sync') {
      const modeSet = new Set()
      const highlightCandidates = []
      for (const e of group.entries) {
        for (const bullet of e.summaryBullets) {
          if (/^opta update \(/i.test(bullet)) {
            highlightCandidates.push(bullet)
            const modeMatch = bullet.match(/^opta update \(([^)]+)\)/i)
            if (modeMatch) modeSet.add(modeMatch[1])
          }
        }
      }

      const highlights = []
      if (modeSet.size > 0) {
        highlights.push(`Modes: ${[...modeSet].join(', ')}`)
      }
      for (const line of [...new Set(highlightCandidates)].slice(0, 2)) {
        highlights.push(line)
      }
      highlights.push('Source: Opta CLI update logs')

      return {
        id: noteId,
        date: group.date,
        title: 'Stack Sync & Promotion Updates',
        summary: `${group.entries.length} stack sync run${group.entries.length === 1 ? '' : 's'} recorded across CLI/LMX components.`,
        status,
        highlights,
        links: [{ label: 'CLI Features', href: '/features?app=cli' }],
      }
    }

    const first = group.entries[0]
    const bullets = [...new Set(first.summaryBullets)].slice(0, 3)
    return {
      id: noteId,
      date: group.date,
      title: first.title,
      summary:
        first.summaryBullets[0] ||
        `Update recorded in ${first.sourceLabel}.`,
      status,
      highlights: bullets.length > 0 ? bullets : ['Recorded in update journal'],
      links: [{ label: `${first.sourceLabel} Features`, href: first.sourceFeaturesHref }],
    }
  })
}

async function main() {
  const allEntries = []
  for (const source of SOURCES) {
    const sourceEntries = await readEntriesFromSource(source)
    allEntries.push(...sourceEntries)
  }

  const promotedEntries = allEntries.filter((e) => e.promoted)
  const notes = buildNotes(promotedEntries.length > 0 ? promotedEntries : allEntries)

  const generatedAt = new Date().toISOString()
  const output = `/* eslint-disable */
// Auto-generated by scripts/generate-release-notes.mjs
// Generated at: ${generatedAt}

import type { ReleaseNote } from './release-notes'

export const GENERATED_RELEASE_NOTES: ReleaseNote[] = ${JSON.stringify(
    notes,
    null,
    2,
  )}
`

  await fs.writeFile(OUTPUT_FILE, output, 'utf-8')
  console.log(
    `Generated ${notes.length} release note${notes.length === 1 ? '' : 's'} -> ${path.relative(
      APP_ROOT,
      OUTPUT_FILE,
    )}`,
  )
}

main().catch((err) => {
  console.error('Failed to generate release notes:', err)
  process.exitCode = 1
})
