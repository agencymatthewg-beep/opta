import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserMode } from './types.js';
import { getDaemonDir } from '../platform/paths.js';
import { normalizeStringList } from '../utils/text.js';
import { debug } from '../core/debug.js';

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

/**
 * Read the chrome overlay script source code.
 *
 * Resolution order:
 *   1. Compiled .js co-located with this module (production build via tsup)
 *   2. TypeScript source in src/browser/ (dev mode, stripped of type annotations)
 *
 * The paths are relative to `import.meta.url` which resolves to either
 * `dist/browser/` (after tsup build) or `src/browser/` (when running via tsx).
 * Both layouts co-locate chrome-overlay alongside mcp-bootstrap.
 */
async function readOverlayScript(): Promise<string> {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Try compiled JS first (production build via tsup)
  const jsPath = join(thisDir, 'chrome-overlay.js');
  try {
    await access(jsPath);
    return await readFile(jsPath, 'utf-8');
  } catch {
    // Fall through to TS source
  }

  // Fall back to TypeScript source and strip type annotations
  const tsPath = join(thisDir, 'chrome-overlay.ts');
  try {
    await access(tsPath);
  } catch {
    throw new Error(
      `chrome-overlay not found at ${jsPath} or ${tsPath}. ` +
        'Run `npm run build` to generate the compiled overlay.',
    );
  }
  const source = await readFile(tsPath, 'utf-8');
  return stripTypeAnnotations(source);
}

/**
 * Minimal TypeScript → JavaScript stripping for the chrome overlay IIFE.
 *
 * IMPORTANT: This is tightly coupled to the specific TypeScript patterns used
 * in chrome-overlay.ts. If new TS features are added to the overlay (generics,
 * interface declarations, enum, etc.), this function MUST be updated or the
 * dev-mode fallback will produce invalid JS. The production path (compiled .js)
 * does not use this function.
 *
 * Handles these specific patterns:
 * - `type Foo = ...;` declarations
 * - `as SomeType` casts
 * - `: type` parameter annotations (number, string, boolean, DOMRect, CustomEvent, EventListener)
 * - `): void {` return type annotations
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
 * Build CLI flags for network policy and navigation options.
 *
 * These flags (--allowed-hosts, --blocked-origins, --start-url) are CLI-only
 * and are NOT part of the @playwright/mcp config file schema. They are always
 * appended as CLI args regardless of whether a config file is generated.
 */
function buildNetworkPolicyArgs(options: PlaywrightMcpBootstrapOptions): string[] {
  const args: string[] = [];

  const allowedHosts = normalizeStringList(options.allowedHosts);
  if (allowedHosts.length > 0) {
    args.push('--allowed-hosts', allowedHosts.join(','));
  }

  const blockedOrigins = normalizeStringList(options.blockedOrigins);
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
 * passes `--config <path>` to the subprocess alongside the standard
 * CLI flags for network policy and navigation.
 *
 * If config file generation fails (e.g. permission error), the function
 * logs a warning and continues with CLI flags only. The contextOptions
 * and initScript features will be unavailable in that case.
 */
export async function createPlaywrightMcpServerConfig(
  options: PlaywrightMcpBootstrapOptions = {},
): Promise<PlaywrightMcpServerConfig> {
  const mode = options.mode ?? 'isolated';
  const args: string[] = ['-y', options.packageName ?? '@playwright/mcp@latest'];

  if (mode === 'isolated') {
    args.push('--isolated');
  }

  // Try config-file approach for contextOptions + initScript
  const configDir = options.configDir ?? getDaemonDir();

  try {
    const configPath = await ensureBrowserConfigFiles(configDir, {
      injectOverlay: options.injectOverlay ?? true,
      reducedMotion: options.reducedMotion ?? 'no-preference',
    });
    args.push('--config', configPath);
  } catch (err) {
    // Config file generation failed — contextOptions/initScript unavailable
    const msg = err instanceof Error ? err.message : String(err);
    debug(`browser config: config file generation failed (${msg})`);
  }

  // Network policy and navigation flags are always CLI args
  args.push(...buildNetworkPolicyArgs(options));

  return {
    transport: 'stdio',
    command: options.command ?? 'npx',
    args,
    env: { ...(options.env ?? {}) },
  };
}
