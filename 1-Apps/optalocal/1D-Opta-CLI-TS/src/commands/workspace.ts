/**
 * Opta Workspace commands.
 *
 * The Opta Workspace is the canonical two-tier filesystem shared by all Optalocal apps:
 *   Tier 1: ~/.config/opta/   — machine config + runtime state
 *   Tier 2: ~/Documents/Opta Workspace/ — visible user workspace (iCloud-eligible)
 *
 * These commands let users navigate and scaffold the workspace from the CLI,
 * mirroring what the Init wizard creates on first run.
 */

import { mkdir, writeFile, access, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, basename } from 'node:path';
import chalk from 'chalk';
import { getWorkspaceRoot } from '../platform/paths.js';
import { box, kv } from '../ui/box.js';

const execFileAsync = promisify(execFile);

// ── Templates ────────────────────────────────────────────────────────────────

function goalTemplate(projectName: string): string {
  const today = new Date().toISOString().split('T')[0]!;
  return `---
type: project-goal
project: ${projectName}
ai-read-when:
  - always
last-updated: ${today}
---
# Goal: ${projectName}

## What I'm Building

<!-- One paragraph — the product, feature, or outcome -->

## Why

<!-- Motivation — user need, business goal, learning objective -->

## Success Criteria

- [ ] ...

## Current Phase

<!-- e.g. Planning, MVP, Hardening, Production -->

## Key Constraints

- Technology: [e.g. TypeScript, Rust, Python]
- Deadline: [optional]
- Must not: [things to avoid]
`;
}

function projectIndexTemplate(projectName: string): string {
  const today = new Date().toISOString().split('T')[0]!;
  return `---
type: project-index
project: ${projectName}
ai-read-when:
  - starting any task in this project
  - need project context
last-updated: ${today}
---
# ${projectName}

See [GOAL.md](GOAL.md) for what this project is building and why.

## Sections

| Folder | Purpose |
|--------|---------|
| Plans | Design docs and technical specifications |
| Research | Background research and references |
| Temp | Scratch space (not indexed by AI) |
`;
}

function plansIndexTemplate(projectName: string): string {
  return `---
type: section-index
project: ${projectName}
---
# Plans

Design documents and technical specifications for ${projectName}.
`;
}

function researchIndexTemplate(projectName: string): string {
  return `---
type: section-index
project: ${projectName}
---
# Research

Background research and reference material for ${projectName}.
`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureFile(filePath: string, content: string, created: string[], existed: string[]): Promise<void> {
  if (await fileExists(filePath)) {
    existed.push(basename(filePath));
  } else {
    await writeFile(filePath, content, 'utf-8');
    created.push(basename(filePath));
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

export interface WorkspaceNewOptions {
  open?: boolean;
}

/**
 * Open the Opta Workspace folder in the system file browser.
 */
export async function workspaceOpen(): Promise<void> {
  const workspaceRoot = await getWorkspaceRoot();

  let cmd: string;
  let args: string[];
  if (process.platform === 'darwin') {
    cmd = 'open';
    args = [workspaceRoot];
  } else if (process.platform === 'win32') {
    cmd = 'explorer';
    args = [workspaceRoot];
  } else {
    cmd = 'xdg-open';
    args = [workspaceRoot];
  }

  try {
    await execFileAsync(cmd, args);
    console.log(chalk.dim(`Opened: ${workspaceRoot}`));
  } catch {
    console.log(chalk.cyan(workspaceRoot));
    console.log(chalk.dim('Copy the path above to open your workspace.'));
  }
}

/**
 * List projects in the Opta Workspace.
 */
export async function workspaceList(): Promise<void> {
  const workspaceRoot = await getWorkspaceRoot();
  const projectsDir = join(workspaceRoot, 'Projects');

  let projectNames: string[];
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    projectNames = entries
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch {
    projectNames = [];
  }

  console.log('');
  if (projectNames.length === 0) {
    console.log(chalk.dim('No projects yet.'));
    console.log(chalk.dim('Run: opta workspace new <project-name>'));
    return;
  }

  console.log(
    box('Opta Projects', [
      kv('Location', projectsDir, 12),
      '',
      ...projectNames.map((name) => `  ${chalk.cyan('\u25c6')} ${name}`),
    ]),
  );
  console.log('');
}

/**
 * Scaffold a new project in ~/Documents/Opta Workspace/Projects/<name>/.
 *
 * Creates:
 *   INDEX.md   — context ladder with YAML frontmatter
 *   GOAL.md    — project goal template (fill this in)
 *   Plans/     — design docs dir
 *   Research/  — references dir
 *   Temp/      — scratch space (not RAG-indexed)
 */
export async function workspaceNew(projectName: string, options: WorkspaceNewOptions = {}): Promise<void> {
  if (!projectName || !projectName.trim()) {
    console.error(chalk.red('Error: project name is required'));
    console.error(chalk.dim('Usage: opta workspace new <project-name>'));
    process.exit(1);
  }

  const slug = projectName.trim().replace(/\s+/g, '-');
  const workspaceRoot = await getWorkspaceRoot();
  const projectDir = join(workspaceRoot, 'Projects', slug);

  const created: string[] = [];
  const existed: string[] = [];

  // Create directory tree
  await mkdir(join(projectDir, 'Plans'), { recursive: true });
  await mkdir(join(projectDir, 'Research'), { recursive: true });
  await mkdir(join(projectDir, 'Temp'), { recursive: true });

  // Create root files
  await ensureFile(join(projectDir, 'INDEX.md'), projectIndexTemplate(slug), created, existed);
  await ensureFile(join(projectDir, 'GOAL.md'), goalTemplate(slug), created, existed);

  // Create section indexes
  await ensureFile(join(projectDir, 'Plans', 'INDEX.md'), plansIndexTemplate(slug), created, existed);
  await ensureFile(join(projectDir, 'Research', 'INDEX.md'), researchIndexTemplate(slug), created, existed);

  // Preserve Temp/ dir for git (not indexed by RAG)
  const gitkeep = join(projectDir, 'Temp', '.gitkeep');
  if (!(await fileExists(gitkeep))) {
    await writeFile(gitkeep, '', 'utf-8');
  }

  console.log('');
  console.log(
    box(`New Project: ${slug}`, [
      kv('Location', projectDir, 12),
      kv('Created', `${created.length} files`, 12),
      '',
      ...created.map((f) => `  ${chalk.green('\u2713')} ${f}`),
      ...(existed.length > 0 ? [chalk.dim(`  ${existed.length} file(s) already existed`)] : []),
    ]),
  );
  console.log('');
  console.log(chalk.dim("Next: open GOAL.md and describe what you're building."));
  console.log(chalk.dim(`Then: cd "${projectDir}" && opta chat`));

  if (options.open) {
    try {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
      await execFileAsync(openCmd, [projectDir]);
    } catch {
      // Non-fatal — just skip the open
    }
  }
}
