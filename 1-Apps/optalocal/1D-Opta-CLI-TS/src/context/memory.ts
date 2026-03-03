import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OptaConfig } from '../core/config.js';

export type MemoryScope = 'primary' | 'provider' | 'atpo' | 'legacy' | 'project';

export interface MemoryCandidate {
  path: string;
  label: string;
  scope: MemoryScope;
}

const OPTA_MEMORY_DIR = '.opta/memory';

const PROVIDER_FILE_BY_PROVIDER: Record<string, string> = {
  anthropic: 'claude.md',
  gemini: 'gemini.md',
  openai: 'codex.md',
  opencode_zen: 'opencode-zen.md',
};

/**
 * Map an active provider to its dedicated memory document name.
 */
export function getProviderMemoryFileName(provider: string): string {
  return PROVIDER_FILE_BY_PROVIDER[provider] ?? `${provider}.md`;
}

function memoryDir(cwd: string): string {
  return join(cwd, OPTA_MEMORY_DIR);
}

/**
 * Returns all memory files that can participate in prompt context.
 *
 * Priority is explicit:
 * 1. provider-specific file (claude/gemini/codex/etc.)
 * 2. model-specific override (optional)
 * 3. main.md (shared cross-model baseline)
 * 4. atpo.md (operating context)
 * 5. legacy .opta/memory.md
 * 6. CLAUDE.md project file
 */
export function buildMemoryCandidates(
  cwd: string,
  config: OptaConfig | null,
  activeModel = ''
): MemoryCandidate[] {
  const dir = memoryDir(cwd);
  const normalizedActiveProvider = (config?.provider?.active ?? 'lmx') as string;
  const providerFile = getProviderMemoryFileName(normalizedActiveProvider);

  const seen = new Set<string>();
  const candidate = (path: string, label: string, scope: MemoryScope): MemoryCandidate | null => {
    if (!path || seen.has(path)) return null;
    seen.add(path);
    return { path, label, scope };
  };

  const candidates: MemoryCandidate[] = [];

  const push = (p: MemoryCandidate | null) => {
    if (p) candidates.push(p);
  };

  // Provider-specific memory is now first-class and wins over legacy/shared context.
  push(candidate(join(dir, providerFile), providerFile, 'provider'));

  // Model-specific override when the user chooses a dedicated model document
  // naming convention (e.g., codex-gpt-5.md).
  if (activeModel.trim()) {
    const normalizedModel = activeModel.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    push(candidate(join(dir, `${normalizedModel}.md`), `${normalizedModel}.md`, 'provider'));
  }

  // Baseline memory always available across providers.
  push(candidate(join(dir, 'main.md'), 'main', 'primary'));

  // Dedicated ATPO context is separate from provider memory and only appended when present.
  push(candidate(join(dir, 'atpo.md'), 'atpo', 'atpo'));

  // Legacy fallback for installations created before scoped memory files.
  push(candidate(join(cwd, '.opta', 'memory.md'), 'legacy-memory.md', 'legacy'));
  push(candidate(join(cwd, 'CLAUDE.md'), 'CLAUDE.md', 'project'));

  return candidates;
}

/**
 * Load and combine all available memory files into a context block.
 */
export async function readSharedMemoryContext(
  cwd: string,
  config: OptaConfig | null,
  activeModel = ''
): Promise<string> {
  const candidates = buildMemoryCandidates(cwd, config, activeModel);
  const blocks: string[] = [];

  for (const { path, label, scope } of candidates) {
    const content = await safeReadFile(path);
    if (!content) continue;

    const sectionHeader =
      scope === 'provider'
        ? `## ${label.toUpperCase()} Context`
        : scope === 'atpo'
          ? '## ATPO Context'
          : '## Shared Context';

    blocks.push(`${sectionHeader}\n${content.trim()}\n`);
  }

  return blocks.join('\n');
}

/**
 * Resolve the canonical write target for save_memory.
 *
 * Preference is explicit scoped memory: provider-specific (or main for lmx),
 * then main/shared baseline, then legacy path.
 * If no scoped files exist, this creates a scoped target and a baseline main/atpo
 * scaffold so writes are immediately namespaced.
 */
export async function resolveWritableMemoryPath(cwd: string, config: OptaConfig | null): Promise<string> {
  const dir = memoryDir(cwd);
  const provider = (config?.provider?.active ?? 'lmx') as string;
  const providerFile = getProviderMemoryFileName(provider);

  const primaryCandidates = [provider === 'lmx' ? join(dir, 'main.md') : join(dir, providerFile), join(dir, 'main.md')];
  const legacyPath = join(cwd, '.opta', 'memory.md');

  for (const path of primaryCandidates) {
    try {
      await access(path);
      return path;
    } catch {
      // continue
    }
  }

  // First run / missing files: create scoped memory files and migrate legacy.
  await mkdir(dir, { recursive: true });

  const now = new Date().toISOString();
  const mainSeed = [
    '# Project Memory',
    '',
    `Provider: ${provider}`,
    `Created: ${now}`,
    '',
    '## Notes',
    '',
  ].join('\n');

  const providerSeed = [
    '# Provider Memory',
    '',
    `Provider: ${provider}`,
    `Provider profile: ${providerFile.replace('.md', '')}`,
    `Created: ${now}`,
    '',
    '## Notes',
    '',
  ].join('\n');

  const atpoSeed = [
    '# ATPO Memory',
    '',
    'Purpose: operating-memory overlay for higher-level workflows.',
    `Created: ${now}`,
    '',
    '## Notes',
    '',
  ].join('\n');

  const writeIfMissing = async (target: string, content: string): Promise<void> => {
    try {
      await access(target);
    } catch {
      await writeFile(target, content, 'utf-8');
    }
  };

  // If legacy file exists, keep it as compatibility and seed main with it when empty.
  let migratedFromLegacy = false;
  try {
    const existingLegacy = await readFile(legacyPath, 'utf-8');
    if (existingLegacy?.trim()) {
      const migrated = [mainSeed, '', '# Migration (legacy)', '', existingLegacy].join('\n');
      await writeFile(join(dir, 'main.md'), migrated, 'utf-8');
      migratedFromLegacy = true;
    }
  } catch {
    // ignore
  }

  await writeIfMissing(join(dir, 'main.md'), mainSeed);
  if (!migratedFromLegacy) {
    await writeIfMissing(join(dir, 'atpo.md'), atpoSeed);
  }
  if (provider !== 'lmx') {
    await writeIfMissing(join(dir, providerFile), providerSeed);
  }

  return provider === 'lmx' ? join(dir, 'main.md') : join(dir, providerFile);
}

/**
 * Create an optimized first-run memory scaffold.
 */
export async function ensureMemoryScaffold(cwd: string): Promise<string[]> {
  const dir = memoryDir(cwd);
  await mkdir(dir, { recursive: true });

  const targets = [
    'main.md',
    'atpo.md',
    'claude.md',
    'gemini.md',
    'codex.md',
    'opencode-zen.md',
  ];

  const existing: string[] = [];
  const now = new Date().toISOString();

  for (const file of targets) {
    const path = join(dir, file);
    try {
      await access(path);
      existing.push(`.opta/memory/${file}`);
    } catch {
      const seeded = [
        '# Model Memory',
        '',
        `Provider profile: ${file.replace('.md', '')}`,
        `Provider seed created: ${now}`,
        '',
      ].join('\n');
      await writeFile(path, seeded, 'utf-8');
      existing.push(`.opta/memory/${file}`);
    }
  }

  return existing;
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return null;
    }
    throw err;
  }
}
