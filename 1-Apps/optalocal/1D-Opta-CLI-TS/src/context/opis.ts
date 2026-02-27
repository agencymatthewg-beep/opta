import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

// --- Types ---

export interface OpisContext {
  summary: string; // Compressed text for system prompt
  hasOpis: boolean; // Whether OPIS scaffold was found
  docsDir: string; // Path to docs directory
  fallbackMemory?: string; // Legacy memory content if no OPIS
}

// --- Constants ---

/** Whitelist of recognized OPIS documentation files. */
const OPIS_FILES = [
  'APP.md',
  'ARCHITECTURE.md',
  'GUARDRAILS.md',
  'DECISIONS.md',
  'ECOSYSTEM.md',
  'KNOWLEDGE.md',
  'WORKFLOWS.md',
  'ROADMAP.md',
  'INDEX.md',
];

// --- YAML Frontmatter Parser ---

interface Frontmatter {
  title?: string;
  type?: string;
  status?: string;
  [key: string]: string | undefined;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the parsed key-value pairs and the body (content after frontmatter).
 */
function parseFrontmatter(content: string): { meta: Frontmatter; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: content };
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return { meta: {}, body: content };
  }

  const yamlBlock = trimmed.slice(3, endIndex).trim();
  const meta: Frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      meta[key] = value;
    }
  }

  const body = trimmed.slice(endIndex + 3).trimStart();
  return { meta, body };
}

// --- Helpers ---

/**
 * Check if a file exists at the given path.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read a file, returning null if it doesn't exist.
 */
async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    // Missing OPIS docs are expected in fallback paths.
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return null;
    }
    console.error(`Failed to read project doc ${path}:`, err);
    return null;
  }
}

/**
 * Extract the first non-heading, non-empty sentence from markdown body.
 */
function extractPurpose(body: string): string {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('---')) continue;
    // Return the first real content line
    return trimmed;
  }
  return '';
}

/**
 * Extract guardrail rules matching `- G-XX:` pattern from content.
 */
function extractGuardrails(content: string): string[] {
  const rules: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^-\s+(G-\d+:.*)$/);
    if (match?.[1]) {
      rules.push(match[1]);
    }
  }
  return rules;
}

/**
 * Extract decision headers matching `## D-XX:` pattern from content.
 * Returns the last 5.
 */
function extractRecentDecisions(content: string): string[] {
  const decisions: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^##\s+(D-\d+:.*)$/);
    if (match?.[1]) {
      decisions.push(match[1]);
    }
  }
  // Return last 5
  return decisions.slice(-5);
}

/**
 * Discover which OPIS files exist in the project (root and docs/).
 */
async function discoverOpisFiles(cwd: string): Promise<string[]> {
  const docsDir = join(cwd, 'docs');
  const found: string[] = [];

  for (const file of OPIS_FILES) {
    // APP.md lives at root
    if (file === 'APP.md') {
      if (await fileExists(join(cwd, file))) {
        found.push(file);
      }
    } else {
      // Other OPIS files live in docs/
      if (await fileExists(join(docsDir, file))) {
        found.push(file);
      }
    }
  }

  return found;
}

// --- Public API ---

/**
 * Read a specific OPIS project document.
 *
 * Search order: docs/{file} first, then ./{file} (root).
 * Returns file content or a helpful message if not found.
 */
export async function readProjectDoc(cwd: string, file: string): Promise<string> {
  // Try docs/ first
  const docsPath = join(cwd, 'docs', file);
  const docsContent = await safeReadFile(docsPath);
  if (docsContent !== null) return docsContent;

  // Try root
  const rootPath = join(cwd, file);
  const rootContent = await safeReadFile(rootPath);
  if (rootContent !== null) return rootContent;

  // Not found
  return `${file} not found. Run \`opta init\` to scaffold OPIS project docs.`;
}

/**
 * Load OPIS context from the project directory.
 *
 * Detection: looks for APP.md at project root.
 * Fallback chain: APP.md -> .opta/memory.md -> CLAUDE.md -> no context.
 */
export async function loadOpisContext(cwd: string): Promise<OpisContext> {
  const docsDir = join(cwd, 'docs');

  // Check for APP.md (OPIS indicator)
  const appMdPath = join(cwd, 'APP.md');
  const appMdContent = await safeReadFile(appMdPath);

  if (appMdContent === null) {
    // No OPIS scaffold -- try fallback chain
    return await loadFallbackContext(cwd, docsDir);
  }

  // Parse APP.md
  const { meta, body } = parseFrontmatter(appMdContent);
  const purpose = extractPurpose(body);

  // Build summary sections
  const sections: string[] = [];

  // Project identity
  const identityParts: string[] = [];
  if (meta.title) identityParts.push(meta.title);
  if (meta.type) identityParts.push(`(${meta.type})`);
  if (meta.status) identityParts.push(`[${meta.status}]`);
  if (purpose) identityParts.push(`- ${purpose}`);

  if (identityParts.length > 0) {
    sections.push(`Project identity: ${identityParts.join(' ')}`);
  } else {
    // No frontmatter, use first line of body as identity
    const firstLine = body.split('\n').find((l) => l.trim().length > 0)?.trim() || 'Unknown project';
    sections.push(`Project identity: ${firstLine}`);
  }

  // Guardrails
  const guardrailsContent = await safeReadFile(join(docsDir, 'GUARDRAILS.md'));
  if (guardrailsContent) {
    const rules = extractGuardrails(guardrailsContent);
    if (rules.length > 0) {
      sections.push(`Guardrails: ${rules.join('; ')}`);
    }
  }

  // Recent decisions
  const decisionsContent = await safeReadFile(join(docsDir, 'DECISIONS.md'));
  if (decisionsContent) {
    const decisions = extractRecentDecisions(decisionsContent);
    if (decisions.length > 0) {
      sections.push(`Recent decisions: ${decisions.join('; ')}`);
    }
  }

  // Available docs footer
  const availableDocs = await discoverOpisFiles(cwd);
  if (availableDocs.length > 0) {
    sections.push(`Available docs: ${availableDocs.join(', ')}`);
  }

  return {
    summary: sections.join('\n'),
    hasOpis: true,
    docsDir,
  };
}

/**
 * Load fallback context when no OPIS scaffold is found.
 * Chain: .opta/memory.md -> CLAUDE.md -> empty
 */
async function loadFallbackContext(cwd: string, docsDir: string): Promise<OpisContext> {
  // Try .opta/memory.md
  const memoryContent = await safeReadFile(join(cwd, '.opta', 'memory.md'));
  if (memoryContent) {
    return {
      summary: '',
      hasOpis: false,
      docsDir,
      fallbackMemory: memoryContent,
    };
  }

  // Try CLAUDE.md
  const claudeContent = await safeReadFile(join(cwd, 'CLAUDE.md'));
  if (claudeContent) {
    return {
      summary: '',
      hasOpis: false,
      docsDir,
      fallbackMemory: claudeContent,
    };
  }

  // No context available
  return {
    summary: '',
    hasOpis: false,
    docsDir,
  };
}
