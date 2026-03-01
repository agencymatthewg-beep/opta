import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_STATUSES = new Set(['active', 'review', 'completed', 'archived']);
const STATUS_ORDER = ['active', 'review', 'completed', 'archived'];
const WRITE_MODE = process.argv.includes('--write');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const appsRoot = path.resolve(repoRoot, '..', '..');
const hasWorkspaceRoot = path.basename(appsRoot) === '1-Apps';

const EXTRA_SCOPE_FILES = [
  '.planning/ROADMAP.md',
  '.planning/phases/01-tui-markdown/01-01-PLAN.md',
  '.planning/phases/02-tui-input/02-01-PLAN.md',
  'docs/FEATURE-PLAN.md',
  'docs/ROADMAP.md',
  'OPTIMIZATION-PLAN.md',
];

const EXCLUDED_SCOPE_FILES = new Set([
  'docs/plans/2026-02-28-plan-state-matrix.md',
  'docs/plans/plan-state-action-queue.md',
  'docs/plans/plan-state-registry.md',
  'docs/plans/plan-state-top20.md',
]);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

function parseFrontmatterStatus(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!frontmatterMatch) return null;
  const statusMatch = frontmatterMatch[1].match(/^status:\s*(.+)$/m);
  return statusMatch ? statusMatch[1].trim().toLowerCase() : null;
}

function countCheckboxes(content) {
  const open = (content.match(/^\s*-\s\[ \]/gm) || []).length;
  const done = (content.match(/^\s*-\s\[[xX]\]/gm) || []).length;
  return { open, done };
}

function isUnresolved(status) {
  return status === 'active' || status === 'review';
}

function statusLabel(status) {
  return status.toUpperCase();
}

function prefixedPath(relPath) {
  return `1-Apps/optalocal/1D-Opta-CLI-TS/${relPath}`;
}

function classifyReason(entry) {
  if (entry.status === 'active') return `open checkboxes: ${entry.open}`;
  if (entry.status === 'review') return `manual review required; open checkboxes: ${entry.open}`;
  if (entry.status === 'completed') return `completed checklist (done: ${entry.done})`;
  return 'no open checklist items';
}

function buildScopeFileList() {
  const docsPlansDir = path.join(repoRoot, 'docs', 'plans');
  const docsPlansFiles = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const rel = path.relative(repoRoot, absPath).replace(/\\/g, '/');
      if (EXCLUDED_SCOPE_FILES.has(rel)) continue;
      docsPlansFiles.push(rel);
    }
  }

  walk(docsPlansDir);

  return [...new Set([...docsPlansFiles, ...EXTRA_SCOPE_FILES])].sort((a, b) => a.localeCompare(b));
}

function buildEntries(scopeFiles) {
  const errors = [];
  const entries = [];

  for (const relPath of scopeFiles) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      errors.push(`Missing scoped file: ${relPath}`);
      continue;
    }

    const content = readText(absPath);
    const status = parseFrontmatterStatus(content);
    const { open, done } = countCheckboxes(content);

    if (!status) {
      errors.push(`Missing frontmatter status: ${relPath}`);
      continue;
    }
    if (!VALID_STATUSES.has(status)) {
      errors.push(`Invalid status "${status}" in ${relPath}`);
      continue;
    }
    if (isUnresolved(status) && open === 0) {
      errors.push(`Stale ${status.toUpperCase()} entry (no open checkboxes): ${relPath}`);
      continue;
    }

    entries.push({
      relPath,
      prefixed: prefixedPath(relPath),
      status,
      open,
      done,
    });
  }

  return { entries, errors };
}

function groupByStatus(entries) {
  const grouped = new Map(STATUS_ORDER.map((status) => [status, []]));
  for (const entry of entries) grouped.get(entry.status).push(entry);
  for (const status of STATUS_ORDER) {
    grouped.get(status).sort((a, b) => a.relPath.localeCompare(b.relPath));
  }
  return grouped;
}

function buildRegistryDoc(entries) {
  const grouped = groupByStatus(entries);
  const lines = [];

  lines.push('# Plan State Registry (Opta Code Canonical)');
  lines.push('');
  lines.push('Canonical source of truth: frontmatter `status` in scoped 1D plan documents.');
  lines.push('');
  lines.push('## Summary');
  for (const status of STATUS_ORDER) {
    lines.push(`- ${statusLabel(status)}: ${grouped.get(status).length}`);
  }
  lines.push('');
  lines.push('## Entries');
  for (const status of STATUS_ORDER) {
    for (const entry of grouped.get(status)) {
      lines.push(
        `- [${statusLabel(status)}] \`${entry.prefixed}\` (open: ${entry.open}, done: ${entry.done})`,
      );
    }
  }

  return lines.join('\n') + '\n';
}

function buildQueueDoc(entries) {
  const grouped = groupByStatus(entries);
  const lines = [];

  lines.push('# Plan State Action Queue');
  lines.push('');
  lines.push(
    'Generated from canonical frontmatter statuses for `1-Apps/optalocal/1D-Opta-CLI-TS` scoped plan files.',
  );
  lines.push('');

  for (const status of STATUS_ORDER) {
    const sectionTitle = statusLabel(status);
    lines.push(`## ${sectionTitle}`);
    const sectionEntries = grouped.get(status);
    if (sectionEntries.length === 0) {
      lines.push('- _None_');
      lines.push('');
      continue;
    }
    for (const entry of sectionEntries) {
      const checkbox = isUnresolved(status) ? ' ' : 'x';
      lines.push(
        `- [${checkbox}] \`${entry.prefixed}\` (${statusLabel(status)}) — ${classifyReason(entry)}`,
      );
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function buildTop20Doc(entries) {
  const unresolved = entries
    .filter((entry) => isUnresolved(entry.status))
    .sort((a, b) => b.open - a.open || a.relPath.localeCompare(b.relPath))
    .slice(0, 20);

  const lines = [];
  lines.push('# Plan State Top 20 (Unresolved) by Domain');
  lines.push('');
  lines.push('## optalocal');

  if (unresolved.length === 0) {
    lines.push('- _No unresolved ACTIVE/REVIEW entries._');
  } else {
    for (const entry of unresolved) {
      lines.push(`- [${statusLabel(entry.status)}] \`${entry.prefixed}\` (open: ${entry.open})`);
    }
  }

  return lines.join('\n') + '\n';
}

function buildMatrixDoc(entries) {
  const grouped = groupByStatus(entries);
  const staleCount = entries.filter((entry) => isUnresolved(entry.status) && entry.open === 0).length;
  const lines = [];

  lines.push('---');
  lines.push('status: active');
  lines.push('owner: cli-maintainers');
  lines.push('scope: 1D-Opta-CLI-TS plan files only');
  lines.push('canonical_source: frontmatter status');
  lines.push('---');
  lines.push('');
  lines.push('# Opta CLI Plan State Matrix (Canonical)');
  lines.push('');
  lines.push('Single source summary for plan-state reconciliation in `1D-Opta-CLI-TS`.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total scoped plan files: ${entries.length}`);
  lines.push(`- ACTIVE: ${grouped.get('active').length}`);
  lines.push(`- REVIEW: ${grouped.get('review').length}`);
  lines.push(`- COMPLETED: ${grouped.get('completed').length}`);
  lines.push(`- ARCHIVED: ${grouped.get('archived').length}`);
  lines.push('- Frontmatter vs registry mismatches: 0');
  lines.push('- Frontmatter vs queue mismatches: 0');
  lines.push(`- Stale ACTIVE/REVIEW entries: ${staleCount}`);
  lines.push('');
  lines.push('## Reconciliation Rules');
  lines.push('');
  lines.push('- `status` frontmatter is canonical.');
  lines.push('- `ACTIVE` or `REVIEW` must have at least one open checkbox.');
  lines.push('- `COMPLETED` has no open checkboxes and at least one done checkbox.');
  lines.push('- `ARCHIVED` has no open checkboxes and no pending work.');
  lines.push('');

  for (const status of STATUS_ORDER) {
    const entriesForStatus = grouped.get(status);
    lines.push(`## ${statusLabel(status)} (${entriesForStatus.length})`);
    lines.push('');
    if (entriesForStatus.length === 0) {
      lines.push('- _None_');
      lines.push('');
      continue;
    }
    lines.push('| Plan | Open | Done |');
    lines.push('|---|---:|---:|');
    for (const entry of entriesForStatus) {
      lines.push(`| ${entry.relPath} | ${entry.open} | ${entry.done} |`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function ensureMatchesOrWrite(targetPath, expectedContent, mismatches) {
  if (WRITE_MODE) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, expectedContent, 'utf8');
    return;
  }

  if (!fs.existsSync(targetPath)) {
    mismatches.push(`Missing generated file: ${path.relative(repoRoot, targetPath)}`);
    return;
  }

  const actual = normalize(readText(targetPath));
  const expected = normalize(expectedContent);
  if (actual !== expected) {
    mismatches.push(`Out-of-sync file: ${path.relative(repoRoot, targetPath)}`);
  }
}

function main() {
  const scopeFiles = buildScopeFileList();
  const { entries, errors } = buildEntries(scopeFiles);

  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }

  const registryDoc = buildRegistryDoc(entries);
  const queueDoc = buildQueueDoc(entries);
  const top20Doc = buildTop20Doc(entries);
  const matrixDoc = buildMatrixDoc(entries);

  const outputs = new Map([
    [path.join(repoRoot, 'docs/plans/plan-state-registry.md'), registryDoc],
    [path.join(repoRoot, 'docs/plans/plan-state-action-queue.md'), queueDoc],
    [path.join(repoRoot, 'docs/plans/plan-state-top20.md'), top20Doc],
    [path.join(repoRoot, 'docs/plans/2026-02-28-plan-state-matrix.md'), matrixDoc],
  ]);

  if (hasWorkspaceRoot) {
    outputs.set(path.join(appsRoot, 'PLAN-STATE-REGISTRY-CANONICAL.md'), registryDoc);
    outputs.set(path.join(appsRoot, 'PLAN-STATE-ACTION-QUEUE.md'), queueDoc);
    outputs.set(path.join(appsRoot, 'PLAN-STATE-TOP20-BY-DOMAIN.md'), top20Doc);
  }

  const mismatches = [];
  for (const [targetPath, content] of outputs.entries()) {
    ensureMatchesOrWrite(targetPath, content, mismatches);
  }

  if (!WRITE_MODE && mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(`ERROR: ${mismatch}`);
    console.error('Run `npm run plan-state:sync` to regenerate canonical plan-state artifacts.');
    process.exit(1);
  }

  const grouped = groupByStatus(entries);
  console.log(
    `Plan-state ${WRITE_MODE ? 'sync' : 'check'} OK: ACTIVE=${grouped.get('active').length}, REVIEW=${grouped.get('review').length}, COMPLETED=${grouped.get('completed').length}, ARCHIVED=${grouped.get('archived').length}`,
  );
}

main();
