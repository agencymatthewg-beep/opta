#!/usr/bin/env node
/**
 * sync-feature-registry.mjs
 *
 * Reads all optalocal-updates/*.md files and appends new feature-line entries
 * to the matching 1S-Opta-Status/docs/features/{appId}.md files.
 *
 * Idempotent: each entry is tracked by its update file slug. Already-applied
 * entries are skipped (checked via a hidden tracking comment block).
 *
 * Target field mapping (case-insensitive partial match):
 *   "Opta LMX"           → lmx.md
 *   "Opta CLI"           → cli.md
 *   "Opta Code Desktop"  → code-desktop.md
 *   "Opta Accounts"      → accounts.md
 *   "Opta Init"          → init.md
 *   "Opta Status"        → status.md
 *   "Opta Help"          → help.md
 *   "Opta Learn"         → learn.md
 *   "Opta Admin"         → admin.md
 *   "Opta Local" or "LMX Dashboard" → local-web.md
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const UPDATES_DIR = join(ROOT, 'optalocal-updates')
const FEATURES_DIR = join(ROOT, '1S-Opta-Status', 'docs', 'features')
const TRACKING_COMMENT_START = '<!-- opta-sync-applied:'
const TRACKING_COMMENT_END = '-->'

// Maps partial target strings → feature file appId
const TARGET_MAP = [
    { match: 'opta code desktop', appId: 'code-desktop' },
    { match: 'code desktop', appId: 'code-desktop' },
    { match: 'opta lmx', appId: 'lmx' },
    { match: 'opta cli', appId: 'cli' },
    { match: 'opta accounts', appId: 'accounts' },
    { match: 'opta init', appId: 'init' },
    { match: 'opta status', appId: 'status' },
    { match: 'opta help', appId: 'help' },
    { match: 'opta learn', appId: 'learn' },
    { match: 'opta admin', appId: 'admin' },
    { match: 'lmx dashboard', appId: 'local-web' },
    { match: 'opta local', appId: 'local-web' },
]

/**
 * Parse a single optalocal-updates markdown file.
 * Returns { slug, date, targets[], updateType, summary, detailedChanges[] }
 */
function parseUpdateFile(filePath) {
    const filename = filePath.split('/').pop().replace('.md', '')
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    let date = ''
    let targets = []
    let updateType = 'Feature'
    let summary = ''
    let inSummary = false
    let inChanges = false
    let detailedChanges = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Extract metadata fields
        if (line.startsWith('**Date:**')) {
            date = line.replace('**Date:**', '').trim()
        } else if (line.startsWith('**Target:**')) {
            const rawTargets = line.replace('**Target:**', '').trim()
            targets = rawTargets.split(',').map(t => t.trim())
        } else if (line.startsWith('**Update Type:**')) {
            updateType = line.replace('**Update Type:**', '').trim()
        } else if (line === '## Summary') {
            inSummary = true
            inChanges = false
        } else if (line === '## Detailed Changes') {
            inSummary = false
            inChanges = true
        } else if (line.startsWith('## ') && line !== '## Summary' && line !== '## Detailed Changes') {
            inSummary = false
            inChanges = false
        } else if (inSummary && line) {
            summary += (summary ? ' ' : '') + line
        } else if (inChanges && line.startsWith('- **')) {
            // e.g. "- **Opta LMX:** Integrated mlx-whisper..."
            detailedChanges.push(line)
        }
    }

    // Parse date to a short form for the Recent Updates entry (YYYY-MM-DD)
    let shortDate = date
    const dateMatch = date.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) shortDate = dateMatch[1]

    return { slug: filename, date, shortDate, targets, updateType, summary, detailedChanges }
}

/**
 * Resolve which feature appIds an update targets.
 */
function resolveAppIds(targets) {
    const appIds = new Set()
    for (const target of targets) {
        const lowerTarget = target.toLowerCase()
        for (const { match, appId } of TARGET_MAP) {
            if (lowerTarget.includes(match)) {
                appIds.add(appId)
                break
            }
        }
    }
    return [...appIds]
}

/**
 * Check if a slug has already been applied to a feature file.
 */
function isAlreadyApplied(featureContent, slug) {
    return featureContent.includes(`${TRACKING_COMMENT_START} ${slug} ${TRACKING_COMMENT_END}`)
}

/**
 * Build the Recent Updates entry text.
 */
function buildRecentUpdatesEntry(update) {
    // Distill a one-liner from the summary (first sentence, capped at 100 chars)
    let summary = update.summary
    const firstSentence = summary.match(/^[^.!]+[.!]?/)
    if (firstSentence) summary = firstSentence[0].trim()
    if (summary.length > 100) summary = summary.substring(0, 97) + '...'
    return `- ${update.shortDate} — ${summary}`
}

/**
 * Build feature lines for a specific appId from an update's detailedChanges.
 * Filters to changes that mention the target app.
 */
function buildFeatureLines(update, appId) {
    const appMatchers = TARGET_MAP.filter(t => t.appId === appId).map(t => t.match)

    // Filter detailed changes relevant to this app
    const relevant = update.detailedChanges.filter(line => {
        const lower = line.toLowerCase()
        return appMatchers.some(m => lower.includes(m))
    })

    if (relevant.length === 0) {
        // No app-specific lines, use a generic entry from the summary
        const shortSummary = update.summary.substring(0, 80).trim()
        return [`- [x] ${update.updateType}: ${shortSummary}`]
    }

    // Convert "- **Opta LMX:** Integrated mlx-whisper..." → "- [x] Integrated mlx-whisper..."
    return relevant.map(line => {
        const match = line.match(/^- \*\*[^:]+:\*\*\s*(.+)$/)
        if (match) return `- [x] ${match[1].trim()}`
        return `- [x] ${line.replace(/^- /, '')}`
    })
}

/**
 * Append an update entry to a feature file.
 * Adds to "## Recent Updates" section (creates it if missing).
 * Appends feature checklist items under "## Recent Feature Additions" (creates if missing).
 */
function applyUpdateToFeatureFile(featureFilePath, update, appId) {
    let content = readFileSync(featureFilePath, 'utf-8')

    // Check idempotency
    if (isAlreadyApplied(content, update.slug)) {
        console.log(`  ↳ Already applied ${update.slug} to ${appId}.md — skipping`)
        return false
    }

    const trackingTag = `${TRACKING_COMMENT_START} ${update.slug} ${TRACKING_COMMENT_END}`
    const recentEntry = buildRecentUpdatesEntry(update)
    const featureLines = buildFeatureLines(update, appId)

    // 1. Add to Recent Updates section
    if (content.includes('## Recent Updates')) {
        // Insert after the "## Recent Updates" heading
        content = content.replace(
            /## Recent Updates\n/,
            `## Recent Updates\n\n${recentEntry}\n`
        )
    } else {
        // Append a new Recent Updates section
        content += `\n## Recent Updates\n\n${recentEntry}\n`
    }

    // 2. Add feature checklist items under a "## Auto-Synced Features" section
    const newFeatureBlock = featureLines.join('\n')
    if (content.includes('## Auto-Synced Features')) {
        // Append after existing section header
        content = content.replace(
            /## Auto-Synced Features\n/,
            `## Auto-Synced Features\n${newFeatureBlock}\n`
        )
    } else {
        content += `\n## Auto-Synced Features\n${newFeatureBlock}\n`
    }

    // 3. Append tracking tag (hidden comment) at the bottom
    content = content.trimEnd() + `\n\n${trackingTag}\n`

    writeFileSync(featureFilePath, content, 'utf-8')
    console.log(`  ↳ Applied ${update.slug} → ${appId}.md (+${featureLines.length} feature lines)`)
    return true
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('🔄 Opta Feature Registry Sync\n')

const updateFiles = readdirSync(UPDATES_DIR)
    .filter(f => /^\d{4}-.+\.md$/.test(f))
    .sort() // chronological order guaranteed by NNNN prefix

let totalChanges = 0

for (const filename of updateFiles) {
    const filePath = join(UPDATES_DIR, filename)
    console.log(`📄 Processing ${filename}`)

    const update = parseUpdateFile(filePath)
    const appIds = resolveAppIds(update.targets)

    if (appIds.length === 0) {
        console.log(`  ↳ No matching appIds for targets: ${update.targets.join(', ')} — skipping`)
        continue
    }

    console.log(`  ↳ Targets: ${appIds.join(', ')}`)

    for (const appId of appIds) {
        const featureFile = join(FEATURES_DIR, `${appId}.md`)
        if (!existsSync(featureFile)) {
            console.log(`  ↳ Feature file ${appId}.md not found — skipping`)
            continue
        }

        const changed = applyUpdateToFeatureFile(featureFile, update, appId)
        if (changed) totalChanges++
    }
}

console.log(`\n✅ Done. ${totalChanges} feature file(s) updated.`)
if (totalChanges === 0) {
    console.log('   (All updates were already applied — nothing to commit)')
}
