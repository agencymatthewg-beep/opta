import { readdir, mkdir, writeFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';
import chalk from 'chalk';
import { box, kv } from '../ui/box.js';

// --- Types ---

export interface InitOptions {
  yes?: boolean;
  force?: boolean;
}

interface ProjectDetection {
  type: string;
  marker: string;
}

// --- Constants ---

const PROJECT_MARKERS: Record<string, string> = {
  'package.json': 'node',
  'Cargo.toml': 'rust',
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'go.mod': 'go',
  'Package.swift': 'swift',
  'pom.xml': 'java',
  'build.gradle': 'java',
  'Gemfile': 'ruby',
  'mix.exs': 'elixir',
  'CMakeLists.txt': 'cpp',
};

/** OPIS docs that live in docs/ (not APP.md, which lives at root). */
const OPIS_DOCS = [
  'ARCHITECTURE.md',
  'GUARDRAILS.md',
  'DECISIONS.md',
  'ECOSYSTEM.md',
  'KNOWLEDGE.md',
  'WORKFLOWS.md',
  'ROADMAP.md',
  'INDEX.md',
] as const;

type OpisDocName = (typeof OPIS_DOCS)[number];

// --- Templates ---

function appMdTemplate(projectName: string, projectType: string, description: string): string {
  return `---
title: ${projectName}
type: ${projectType}
status: active
---

# ${projectName}

${description}

## Quick Start

<!-- How to install, build, and run -->

## Directory Structure

<!-- Key directories and their purpose -->
`;
}

const DOC_TEMPLATES: Record<OpisDocName, string> = {
  'ARCHITECTURE.md': `---
title: Architecture
type: opis
status: draft
---

# Architecture

## Overview

<!-- High-level architecture description -->

## Key Components

<!-- Component descriptions and relationships -->

## Data Flow

<!-- How data moves through the system -->
`,

  'GUARDRAILS.md': `---
title: Guardrails
type: opis
status: draft
---

# Guardrails

## Safety Rules

<!-- G-01: Description of safety rule -->

## Code Quality

<!-- G-02: Standards and constraints for code quality -->

## Boundaries

<!-- G-03: What the agent must never do -->
`,

  'DECISIONS.md': `---
title: Decisions
type: opis
status: draft
---

# Decisions

## D-01: Project Setup

<!-- Date, context, decision, and rationale -->

## D-02: Technology Choices

<!-- Date, context, decision, and rationale -->
`,

  'ECOSYSTEM.md': `---
title: Ecosystem
type: opis
status: draft
---

# Ecosystem

## Dependencies

<!-- Key dependencies and why they were chosen -->

## Integrations

<!-- External services and APIs -->

## Infrastructure

<!-- Deployment, CI/CD, hosting details -->
`,

  'KNOWLEDGE.md': `---
title: Knowledge
type: opis
status: draft
---

# Knowledge

## Domain Concepts

<!-- Key domain terms and definitions -->

## Conventions

<!-- Coding conventions, naming patterns, file organization -->

## Common Patterns

<!-- Recurring patterns used throughout the codebase -->
`,

  'WORKFLOWS.md': `---
title: Workflows
type: opis
status: draft
---

# Workflows

## Development

<!-- Day-to-day development workflow -->

## Testing

<!-- How to run and write tests -->

## Deployment

<!-- How to build and deploy -->
`,

  'ROADMAP.md': `---
title: Roadmap
type: opis
status: draft
---

# Roadmap

## Current Phase

<!-- What is being built now -->

## Next Up

<!-- What comes after the current phase -->

## Future

<!-- Long-term vision and goals -->
`,

  'INDEX.md': `---
title: Index
type: opis
status: draft
---

# OPIS Documentation Index

## Read Order

1. **APP.md** — Project identity and quick start
2. **ARCHITECTURE.md** — System design and components
3. **GUARDRAILS.md** — Safety rules and constraints
4. **DECISIONS.md** — Key decisions and rationale
5. **ECOSYSTEM.md** — Dependencies and integrations
6. **KNOWLEDGE.md** — Domain concepts and conventions
7. **WORKFLOWS.md** — Development and deployment processes
8. **ROADMAP.md** — Current and future plans
`,
};

// --- Helpers ---

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect project type by scanning for known marker files.
 */
export async function detectProjectType(cwd: string): Promise<ProjectDetection | null> {
  let directoryEntries: string[];
  try {
    directoryEntries = await readdir(cwd);
  } catch {
    return null;
  }

  for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
    if (directoryEntries.includes(marker)) {
      return { type, marker };
    }
  }

  return null;
}

// --- Main Command ---

export async function init(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const skipPrompts = options.yes === true;

  // Step 1: Check for existing APP.md
  const appMdPath = join(cwd, 'APP.md');
  const appMdExists = await fileExists(appMdPath);

  if (appMdExists && !options.force) {
    if (skipPrompts) {
      console.log(chalk.yellow('!') + ' APP.md already exists. Use --force to overwrite.');
      return;
    }

    const { confirm } = await import('@inquirer/prompts');
    const overwrite = await confirm({
      message: 'APP.md already exists. Overwrite?',
      default: false,
    });

    if (!overwrite) {
      console.log(chalk.dim('Skipped. Existing OPIS files unchanged.'));
      return;
    }
  }

  // Step 2: Detect project type
  const projectDetection = await detectProjectType(cwd);
  const detectedType = projectDetection?.type ?? 'unknown';

  // Step 3: Gather project info
  let projectName: string;
  let description: string;
  let selectedDocs: OpisDocName[];

  if (skipPrompts) {
    projectName = basename(cwd);
    description = `${projectName} project.`;
    selectedDocs = [...OPIS_DOCS];
  } else {
    const { input, checkbox } = await import('@inquirer/prompts');

    projectName = await input({
      message: 'Project name',
      default: basename(cwd),
    });

    description = await input({
      message: 'Short description (1-2 sentences)',
      default: `${projectName} project.`,
    });

    selectedDocs = await checkbox<OpisDocName>({
      message: 'Which OPIS docs to create?',
      choices: OPIS_DOCS.map((doc) => ({
        name: doc,
        value: doc,
        checked: true,
      })),
    });
  }

  if (projectDetection) {
    console.log(
      chalk.dim(`Detected project type: ${projectDetection.type} (from ${projectDetection.marker})`),
    );
  }

  // Step 4: Create files
  const createdFiles: string[] = [];

  // Write APP.md
  const appContent = appMdTemplate(projectName, detectedType, description);
  await writeFile(appMdPath, appContent, 'utf-8');
  createdFiles.push('APP.md');

  // Ensure docs/ directory exists
  if (selectedDocs.length > 0) {
    const docsDir = join(cwd, 'docs');
    await mkdir(docsDir, { recursive: true });

    for (const doc of selectedDocs) {
      const docPath = join(docsDir, doc);
      const template = DOC_TEMPLATES[doc];
      if (template) {
        await writeFile(docPath, template, 'utf-8');
        createdFiles.push(`docs/${doc}`);
      }
    }
  }

  // Step 5: Print summary
  console.log('');
  const summaryLines = createdFiles.map((f) => `  ${chalk.green('\u2713')} ${chalk.cyan(f)}`);
  console.log(
    box('OPIS Initialized', [
      kv('Project', projectName, 10),
      kv('Type', detectedType, 10),
      kv('Files', String(createdFiles.length), 10),
      '',
      ...summaryLines,
    ]),
  );
  console.log('');
  console.log(chalk.dim('Edit these files to give Opta context about your project.'));
  console.log(chalk.dim('Run `opta` to start a session with OPIS context loaded.'));
}
