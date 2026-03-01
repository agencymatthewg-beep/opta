import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserMode } from './types.js';
import { getDaemonDir } from '../platform/paths.js';

export interface PlaywrightMcpServerConfig {
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface PlaywrightMcpBootstrapOptions {
  command?: string;
  packageName?: string;
  mode?: BrowserMode;
  allowedHosts?: string[];
  blockedOrigins?: string[];
  env?: Record<string, string>;
  /** URL to navigate to automatically when the browser starts. */
  startUrl?: string;
  /** Directory for config files (defaults to getDaemonDir()). */
  configDir?: string;
  /** Whether to include chrome overlay in initScript (default true). */
  injectOverlay?: boolean;
  /** Override reduced-motion preference (default 'no-preference'). */
  reducedMotion?: 'no-preference' | 'reduce';
}

/** @playwright/mcp config file schema (subset we use). */
interface PlaywrightMcpConfigFile {
  browser?: {
    contextOptions?: {
      reducedMotion?: 'no-preference' | 'reduce';
      colorScheme?: 'dark' | 'light' | 'no-preference';
      viewport?: { width: number; height: number };
    };
    initScript?: string[];
  };
}

function normalizeList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

/**
 * Resolve the path to the compiled chrome-overlay.js file.
 *
 * After tsup build, chrome-overlay.js sits next to mcp-bootstrap.js in dist/.
 * In dev (tsx), the TypeScript source is alongside this file.
 */
function resolveOverlaySourcePath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // Prefer compiled .js (production), fall back to .ts (dev with tsx)
  return join(thisDir, 'chrome-overlay.js');
}

/**
 * Read the chrome overlay script source code.
 *
 * Tries the compiled .js first, then the .ts source (stripping type annotations).
 */
async function readOverlayScript(): Promise<string> {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Try compiled JS first (production build via tsup)
  try {
    const jsPath = join(thisDir, 'chrome-overlay.js');
    return await readFile(jsPath, 'utf-8');
  } catch {
    // Fall through to TS source
  }

  // Fall back to TypeScript source and strip type annotations
  const tsPath = join(thisDir, 'chrome-overlay.ts');
  const source = await readFile(tsPath, 'utf-8');
  return stripTypeAnnotations(source);
}

/**
 * Minimal TypeScript → JavaScript stripping for the chrome overlay IIFE.
 *
 * Handles the specific patterns used in chrome-overlay.ts:
 * - `type Foo = ...;` declarations
 * - `as SomeType` casts
 * - `: type` parameter annotations
 * - `((e: CustomEvent) => {` parameter types
 */
function stripTypeAnnotations(source: string): string {
  return source
    // Remove type alias lines
    .replace(/^\s*type\s+\w+\s*=.*?;\s*$/gm, '')
    // Remove `as SomeType` casts (handles `as WindowWithOpta`, `as EventListener`)
    .replace(/\s+as\s+\w+/g, '')
    // Remove parameter type annotations like `(x: number, y: number)`
    // but preserve the parameter names
    .replace(/(\w+)\s*:\s*(?:number|string|boolean|DOMRect|CustomEvent|EventListener)\b/g, '$1')
    // Remove function return type annotations
    .replace(/\)\s*:\s*void\s*\{/g, ') {');
}

/**
 * Ensure browser config files exist on disk and return the config file path.
 *
 * Creates `<configDir>/browser/` and writes:
 * - `chrome-overlay.js` — the Opta chrome overlay IIFE
 * - `playwright-mcp-config.json` — the @playwright/mcp config file
 */
export async function ensureBrowserConfigFiles(
  configDir: string,
  options?: {
    injectOverlay?: boolean;
    reducedMotion?: 'no-preference' | 'reduce';
  },
): Promise<string> {
  const browserDir = join(configDir, 'browser');
  await mkdir(browserDir, { recursive: true });

  const injectOverlay = options?.injectOverlay ?? true;
  const reducedMotion = options?.reducedMotion ?? 'no-preference';

  const overlayPath = join(browserDir, 'chrome-overlay.js');
  const configPath = join(browserDir, 'playwright-mcp-config.json');

  // Write the chrome overlay script to disk
  if (injectOverlay) {
    const overlaySource = await readOverlayScript();
    await writeFile(overlayPath, overlaySource, 'utf-8');
  }

  // Build the config object
  const config: PlaywrightMcpConfigFile = {
    browser: {
      contextOptions: {
        reducedMotion,
        colorScheme: 'dark',
      },
    },
  };

  if (injectOverlay) {
    config.browser!.initScript = [overlayPath];
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  return configPath;
}

/**
 * Build CLI flags for the old approach (no config file).
 * Used as fallback when config file generation fails.
 */
function buildLegacyArgs(options: PlaywrightMcpBootstrapOptions): string[] {
  const args: string[] = [];

  const allowedHosts = normalizeList(options.allowedHosts);
  if (allowedHosts.length > 0) {
    args.push('--allowed-hosts', allowedHosts.join(','));
  }

  const blockedOrigins = normalizeList(options.blockedOrigins);
  if (blockedOrigins.length > 0) {
    args.push('--blocked-origins', blockedOrigins.join(','));
  }

  const startUrl = options.startUrl?.trim();
  if (startUrl) {
    args.push('--start-url', startUrl);
  }

  return args;
}

/**
 * Create the MCP server spawn configuration for @playwright/mcp.
 *
 * Generates a JSON config file on disk with browser context options
 * (reducedMotion, colorScheme) and initScript (chrome overlay), then
 * passes `--config <path>` to the subprocess.
 *
 * Falls back to individual CLI flags if config file generation fails.
 */
export async function createPlaywrightMcpServerConfig(
  options: PlaywrightMcpBootstrapOptions = {},
): Promise<PlaywrightMcpServerConfig> {
  const mode = options.mode ?? 'isolated';
  const args: string[] = ['-y', options.packageName ?? '@playwright/mcp@latest'];

  if (mode === 'isolated') {
    args.push('--isolated');
  }

  // Try config-file approach first
  const configDir = options.configDir ?? getDaemonDir();
  let configGenerated = false;

  try {
    const configPath = await ensureBrowserConfigFiles(configDir, {
      injectOverlay: options.injectOverlay ?? true,
      reducedMotion: options.reducedMotion ?? 'no-preference',
    });
    args.push('--config', configPath);
    configGenerated = true;
  } catch (err) {
    // Config file generation failed — fall back to legacy CLI flags
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  browser config: falling back to CLI flags (${msg})`);
  }

  // If config generation failed, use legacy CLI arg approach
  if (!configGenerated) {
    args.push(...buildLegacyArgs(options));
  }

  return {
    transport: 'stdio',
    command: options.command ?? 'npx',
    args,
    env: { ...(options.env ?? {}) },
  };
}
