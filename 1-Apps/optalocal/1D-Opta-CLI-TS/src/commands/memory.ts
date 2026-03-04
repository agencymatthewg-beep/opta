import { basename } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { ensureMemoryScaffold, getProviderMemoryFileName } from '../context/memory.js';
import { normalizeProviderName } from '../utils/provider-normalization.js';

interface MemorySyncOptions {
  scope?: 'all' | 'provider' | 'main' | 'atpo' | 'model';
  provider?: string;
  model?: string;
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
  policy?: 'skip' | 'append' | 'replace';
}

interface MemorySyncResult {
  copied: Array<{ from: string; to: string }>;
  skipped: string[];
}

const PROVIDER_FILE_BY_PROVIDER: Record<string, string> = {
  anthropic: 'claude.md',
  gemini: 'gemini.md',
  openai: 'codex.md',
  opencode_zen: 'opencode-zen.md',
};

const POLICY_DEFAULT: 'skip' | 'append' | 'replace' = 'skip';

function normalizeProvider(provider = '') {
  return normalizeProviderName(provider, 'lmx');
}

function normalizeModel(name = '') {
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return normalized ? `${normalized}.md` : null;
}

function memoryDir(cwd: string): string {
  return join(cwd, '.opta', 'memory');
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

function defaultSourceCandidates(targetFileName: string, cwd: string, dir: string, providerFile: string): string[] {
  const mainPath = join(dir, 'main.md');
  const legacyPath = join(cwd, '.opta', 'memory.md');
  const claudePath = join(cwd, 'CLAUDE.md');

  if (targetFileName === 'main.md') {
    return [legacyPath, claudePath];
  }

  // atpo and provider/model docs prefer shared baseline; fallback to legacy/CLAUDE if needed.
  if (targetFileName === providerFile || targetFileName.endsWith('.md')) {
    return [mainPath, legacyPath, claudePath];
  }

  return [mainPath, legacyPath, claudePath];
}

function formatConflictStamp(source: string): string {
  return `\n\n## Memory Sync (${source})\nUpdated: ${new Date().toISOString()}\n`; 
}

function chooseSourceText(content: string): string {
  return content.trim();
}

export async function memorySync(opts: MemorySyncOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig();

  const activeProvider = normalizeProvider(opts.provider ?? config.provider.active);
  const providerFile = getProviderMemoryFileName(activeProvider);
  const dir = memoryDir(cwd);

  const scope = opts.scope ?? 'all';
  const modelFile = normalizeModel(opts.model ?? '');

  await ensureMemoryScaffold(cwd);

  const baseTargets = {
    main: [join(dir, 'main.md')],
    atpo: [join(dir, 'atpo.md')],
    provider: [join(dir, providerFile)],
    model: modelFile ? [join(dir, modelFile)] : [],
  };

  const allProviderFiles = Object.values(PROVIDER_FILE_BY_PROVIDER).map((file) => join(dir, file));

  let targets: string[] = [];
  if (scope === 'all') {
    targets = [...baseTargets.main, ...baseTargets.atpo, ...baseTargets.provider, ...allProviderFiles];
  } else if (scope === 'provider') {
    targets = baseTargets.provider;
  } else if (scope === 'main') {
    targets = baseTargets.main;
  } else if (scope === 'atpo') {
    targets = baseTargets.atpo;
  } else if (scope === 'model') {
    targets = baseTargets.model;
  }

  const dedup = Array.from(new Set(targets)).filter(Boolean);
  const result: MemorySyncResult = { copied: [], skipped: [] };
  const policy = opts.policy ?? POLICY_DEFAULT;
  const applyReplace = opts.force || policy === 'replace';

  for (const target of dedup) {
    const targetName = basename(target);
    const candidates = defaultSourceCandidates(targetName, cwd, dir, providerFile);
    let source: string | null = null;
    for (const candidate of candidates) {
      const text = await readIfExists(candidate);
      if (text?.trim()) {
        source = candidate;
        break;
      }
    }

    if (!source) {
      result.skipped.push(`No source found for ${targetName}`);
      continue;
    }

    const sourceText = chooseSourceText((await readIfExists(source)) || '');
    const destinationText = chooseSourceText((await readIfExists(target)) || '');

    if (!sourceText) {
      result.skipped.push(`Empty source for ${targetName}`);
      continue;
    }

    // First run / empty destination: always seed.
    if (!destinationText) {
      if (opts.dryRun) {
        result.copied.push({ from: source, to: `${target} (dry-run)` });
      } else {
        await writeFile(target, `${sourceText}\n`, 'utf-8');
        result.copied.push({ from: source, to: target });
      }
      continue;
    }

    if (destinationText.includes(sourceText)) {
      result.skipped.push(`Up-to-date: ${targetName}`);
      continue;
    }

    if (policy === 'skip' && !applyReplace) {
      result.skipped.push(`Skip (conflict): ${targetName}`);
      continue;
    }

    if (opts.dryRun) {
      result.copied.push({ from: source, to: `${target} (dry-run)` });
      continue;
    }

    if (applyReplace) {
      await writeFile(target, `${sourceText}\n`, 'utf-8');
      result.copied.push({ from: source, to: `${target} (replaced)` });
      continue;
    }

    // append strategy: preserve existing context and append source as a synchronized block
    const merged = [
      destinationText,
      formatConflictStamp(source),
      sourceText,
      '',
    ].join('\n').trim();

    await writeFile(target, `${merged}\n`, 'utf-8');
    result.copied.push({ from: source, to: `${target} (appended)` });
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          scope,
          provider: activeProvider,
          providerFile,
          copied: result.copied,
          skipped: result.skipped,
          dryRun: Boolean(opts.dryRun),
          forced: Boolean(opts.force),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(chalk.green(`Memory sync complete — scope=${scope}, provider=${activeProvider}`));
  if (result.copied.length > 0) {
    console.log(chalk.dim('Synced:'));
    for (const item of result.copied) {
      console.log(chalk.cyan(`  ${item.from} -> ${item.to}`));
    }
  } else {
    console.log(chalk.yellow('No files changed.'));
  }

  if (result.skipped.length > 0) {
    for (const item of result.skipped) {
      console.log(chalk.dim(`  ${item}`));
    }
  }
}
