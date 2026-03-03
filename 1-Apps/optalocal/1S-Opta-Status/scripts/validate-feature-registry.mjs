#!/usr/bin/env node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const APP_ROOT = path.resolve(__dirname, '..')
const FEATURES_DIR = path.join(APP_ROOT, 'docs', 'features')

const REQUIRED_APP_IDS = [
  'accounts',
  'cli',
  'code-desktop',
  'help',
  'init',
  'learn',
  'admin',
  'lmx',
  'local-web',
  'status',
]

const FORBIDDEN_ITEMS_BY_FILE = {
  'code-desktop.md': ['Multi-pane split view', 'Multi plane split view', 'Split View'],
  'cli.md': ['Multi-pane split view', 'Inline diff viewer for edits'],
}

function parseTaskLine(line) {
  const taskMatch = line.match(/^- \[([^\]])\]\s+(.+)$/)
  if (!taskMatch) return null
  return { marker: taskMatch[1], text: taskMatch[2].trim() }
}

function printTable(rows) {
  const header = ['File', 'Complete', 'Total', 'Percent']
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)))
  const toRow = (values) =>
    values
      .map((value, idx) => String(value).padEnd(widths[idx], ' '))
      .join('  ')
      .trimEnd()

  console.log(toRow(header))
  console.log(widths.map((n) => '-'.repeat(n)).join('  '))
  for (const row of rows) {
    console.log(toRow(row))
  }
}

async function main() {
  const errors = []
  const rows = []
  let grandTotal = 0
  let grandComplete = 0

  for (const appId of REQUIRED_APP_IDS) {
    const filename = `${appId}.md`
    const filePath = path.join(FEATURES_DIR, filename)

    let raw
    try {
      raw = await fs.readFile(filePath, 'utf-8')
    } catch {
      errors.push(`Missing required feature file: docs/features/${filename}`)
      continue
    }

    const lines = raw.split('\n')
    let total = 0
    let complete = 0

    for (let i = 0; i < lines.length; i += 1) {
      const parsed = parseTaskLine(lines[i])
      if (!parsed) continue

      total += 1

      if (parsed.marker === 'x') {
        complete += 1
      } else if (parsed.marker !== ' ') {
        errors.push(
          `Invalid task marker in docs/features/${filename}:${i + 1} -> "[${parsed.marker}]" (expected "[x]" or "[ ]")`,
        )
      }
    }

    if (total === 0) {
      errors.push(`No feature tasks found in docs/features/${filename}`)
    }

    const forbiddenItems = FORBIDDEN_ITEMS_BY_FILE[filename] ?? []
    for (const forbiddenItem of forbiddenItems) {
      const forbiddenIndex = lines.findIndex((line) =>
        line.toLowerCase().includes(forbiddenItem.toLowerCase()),
      )
      if (forbiddenIndex >= 0) {
        errors.push(
          `Deprecated feature item must remain removed in docs/features/${filename}:${forbiddenIndex + 1} -> "${forbiddenItem}"`,
        )
      }
    }

    const percent = total > 0 ? Math.round((complete / total) * 100) : 0
    rows.push([filename, complete, total, `${percent}%`])
    grandTotal += total
    grandComplete += complete
  }

  const extraFiles = (await fs.readdir(FEATURES_DIR))
    .filter((name) => name.endsWith('.md'))
    .filter((name) => !REQUIRED_APP_IDS.includes(name.replace(/\.md$/, '')))

  if (extraFiles.length > 0) {
    errors.push(
      `Unexpected feature files present: ${extraFiles.map((name) => `docs/features/${name}`).join(', ')}`,
    )
  }

  if (errors.length > 0) {
    console.error('\nFeature registry validation failed:\n')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  const globalPercent = grandTotal > 0 ? Math.round((grandComplete / grandTotal) * 100) : 0
  console.log('\nFeature registry validation passed.\n')
  printTable(rows)
  console.log(`\nGlobal: ${grandComplete}/${grandTotal} (${globalPercent}%)`)
}

await main()
