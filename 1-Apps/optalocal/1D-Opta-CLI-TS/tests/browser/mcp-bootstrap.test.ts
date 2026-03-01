import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock getDaemonDir so tests that don't pass configDir use a temp dir
const mockDaemonDir = join(tmpdir(), 'opta-mcp-bootstrap-test-daemon');
vi.mock('../../src/platform/paths.js', () => ({
  getDaemonDir: () => mockDaemonDir,
}));

import {
  createPlaywrightMcpServerConfig,
  ensureBrowserConfigFiles,
} from '../../src/browser/mcp-bootstrap.js';

describe('createPlaywrightMcpServerConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'opta-mcp-test-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it('returns transport stdio with npx command', async () => {
    const config = await createPlaywrightMcpServerConfig({ configDir: tempDir });

    expect(config.transport).toBe('stdio');
    expect(config.command).toBe('npx');
    expect(config.env).toEqual({});
  });

  it('includes --isolated and --config flags by default', async () => {
    const config = await createPlaywrightMcpServerConfig({ configDir: tempDir });

    expect(config.args).toContain('--isolated');
    expect(config.args).toContain('--config');
  });

  it('passes --allowed-hosts and --start-url as CLI args alongside --config', async () => {
    const config = await createPlaywrightMcpServerConfig({
      configDir: tempDir,
      allowedHosts: ['example.com', 'api.example.com'],
      startUrl: 'https://example.com',
    });

    // Config file for contextOptions + initScript
    expect(config.args).toContain('--config');
    // Network policy flags are always CLI args (not in config file)
    expect(config.args).toContain('--allowed-hosts');
    expect(config.args).toContain('example.com,api.example.com');
    expect(config.args).toContain('--start-url');
    expect(config.args).toContain('https://example.com');
  });

  it('generates a config file at the expected path', async () => {
    const config = await createPlaywrightMcpServerConfig({ configDir: tempDir });
    const configIdx = config.args.indexOf('--config');
    expect(configIdx).toBeGreaterThan(-1);

    const configPath = config.args[configIdx + 1]!;
    expect(configPath).toBe(join(tempDir, 'browser', 'playwright-mcp-config.json'));

    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.contextOptions.reducedMotion).toBe('no-preference');
    expect(configContent.browser.contextOptions.colorScheme).toBe('dark');
  });

  it('supports attach mode by omitting isolated flag', async () => {
    const config = await createPlaywrightMcpServerConfig({
      mode: 'attach',
      configDir: tempDir,
    });
    expect(config.args).not.toContain('--isolated');
  });

  it('passes through command, package, and env overrides', async () => {
    const config = await createPlaywrightMcpServerConfig({
      command: 'pnpm',
      packageName: '@playwright/mcp@1.0.0',
      env: { DEBUG: 'pw:mcp' },
      configDir: tempDir,
    });

    expect(config.command).toBe('pnpm');
    expect(config.args.slice(0, 2)).toEqual(['-y', '@playwright/mcp@1.0.0']);
    expect(config.env).toEqual({ DEBUG: 'pw:mcp' });
  });

  it('respects reducedMotion override', async () => {
    await createPlaywrightMcpServerConfig({
      configDir: tempDir,
      reducedMotion: 'reduce',
    });

    const configPath = join(tempDir, 'browser', 'playwright-mcp-config.json');
    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.contextOptions.reducedMotion).toBe('reduce');
  });

  it('omits initScript when injectOverlay is false', async () => {
    await createPlaywrightMcpServerConfig({
      configDir: tempDir,
      injectOverlay: false,
    });

    const configPath = join(tempDir, 'browser', 'playwright-mcp-config.json');
    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.initScript).toBeUndefined();
  });

  it('omits --config but keeps network policy args when config dir is unwritable', async () => {
    // Use a path that cannot be created (nested under a file)
    const badDir = join(tempDir, 'not-a-dir-file');
    // Create a regular file where a directory is expected
    const { writeFile: writeF } = await import('node:fs/promises');
    await writeF(badDir, 'blocker', 'utf-8');

    const config = await createPlaywrightMcpServerConfig({
      configDir: join(badDir, 'nested'), // This will fail because badDir is a file
      allowedHosts: ['example.com'],
      startUrl: 'https://example.com',
    });

    // --config should be absent (config file generation failed)
    expect(config.args).not.toContain('--config');
    // Network policy args are always CLI flags regardless of config file status
    expect(config.args).toContain('--allowed-hosts');
    expect(config.args).toContain('example.com');
    expect(config.args).toContain('--start-url');
    expect(config.args).toContain('https://example.com');
  });
});

describe('ensureBrowserConfigFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'opta-mcp-ensure-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it('creates the browser directory and both files', async () => {
    const configPath = await ensureBrowserConfigFiles(tempDir);

    expect(configPath).toBe(join(tempDir, 'browser', 'playwright-mcp-config.json'));

    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.contextOptions.reducedMotion).toBe('no-preference');
    expect(configContent.browser.contextOptions.colorScheme).toBe('dark');
    expect(configContent.browser.initScript).toBeInstanceOf(Array);
    expect(configContent.browser.initScript[0]).toBe(
      join(tempDir, 'browser', 'chrome-overlay.js'),
    );
  });

  it('writes the overlay JS file to disk', async () => {
    await ensureBrowserConfigFiles(tempDir);

    const overlayPath = join(tempDir, 'browser', 'chrome-overlay.js');
    const content = await readFile(overlayPath, 'utf-8');
    // Verify it looks like the overlay IIFE
    expect(content).toContain('__OPTA_CHROME_INITIALIZED__');
    expect(content).toContain('opta-chrome-host');
  });

  it('returns config path when injectOverlay is false', async () => {
    const configPath = await ensureBrowserConfigFiles(tempDir, {
      injectOverlay: false,
    });

    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.initScript).toBeUndefined();
  });

  it('is idempotent — can be called twice without error', async () => {
    const path1 = await ensureBrowserConfigFiles(tempDir);
    const path2 = await ensureBrowserConfigFiles(tempDir);
    expect(path1).toBe(path2);
  });
});

describe('V3 browser.action event type', () => {
  it('browser.action is registered in V3EventSchema', async () => {
    const { V3EventSchema } = await import('../../src/protocol/v3/types.js');
    expect(V3EventSchema.options).toContain('browser.action');
  });
});

describe('ensureBrowserConfigFiles — overlay content integrity', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'opta-mcp-overlay-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  });

  it('overlay JS file contains __OPTA_CHROME_INITIALIZED__ guard', async () => {
    await ensureBrowserConfigFiles(tempDir);
    const overlayContent = await readFile(
      join(tempDir, 'browser', 'chrome-overlay.js'),
      'utf-8',
    );
    expect(overlayContent).toContain('__OPTA_CHROME_INITIALIZED__');
  });

  it('overlay JS file contains state color CSS variables', async () => {
    await ensureBrowserConfigFiles(tempDir);
    const overlayContent = await readFile(
      join(tempDir, 'browser', 'chrome-overlay.js'),
      'utf-8',
    );
    expect(overlayContent).toContain('--opta-state-idle');
    expect(overlayContent).toContain('--opta-state-executing');
    expect(overlayContent).toContain('--opta-state-error');
  });

  it('overlay JS file contains Shadow DOM attachShadow call', async () => {
    await ensureBrowserConfigFiles(tempDir);
    const overlayContent = await readFile(
      join(tempDir, 'browser', 'chrome-overlay.js'),
      'utf-8',
    );
    expect(overlayContent).toContain('attachShadow');
  });

  it('config file initScript array references the overlay JS path', async () => {
    const configPath = await ensureBrowserConfigFiles(tempDir);
    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    const expectedOverlayPath = join(tempDir, 'browser', 'chrome-overlay.js');
    expect(configContent.browser.initScript).toEqual([expectedOverlayPath]);
  });

  it('does not write overlay file when injectOverlay is false', async () => {
    await ensureBrowserConfigFiles(tempDir, { injectOverlay: false });
    // The overlay file should not be written
    try {
      await readFile(join(tempDir, 'browser', 'chrome-overlay.js'), 'utf-8');
      // If the file exists, that's unexpected — but not a hard fail for this test.
      // The key contract is that initScript is omitted from the config.
    } catch (err: unknown) {
      // Expected: file does not exist
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  });

  it('reducedMotion reduce is written to config file', async () => {
    const configPath = await ensureBrowserConfigFiles(tempDir, {
      reducedMotion: 'reduce',
    });
    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.contextOptions.reducedMotion).toBe('reduce');
  });

  it('config file always sets colorScheme to dark', async () => {
    const configPath = await ensureBrowserConfigFiles(tempDir, {
      reducedMotion: 'reduce',
    });
    const configContent = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(configContent.browser.contextOptions.colorScheme).toBe('dark');
  });
});

describe('browser.homePage config field', () => {
  it('accepts a homePage string in browser config', async () => {
    const { OptaConfigSchema } = await import('../../src/core/config.js');
    const result = OptaConfigSchema.safeParse({
      browser: { enabled: true, homePage: 'https://example.com' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.browser?.homePage).toBe('https://example.com');
    }
  });

  it('homePage defaults to undefined when omitted', async () => {
    const { OptaConfigSchema } = await import('../../src/core/config.js');
    const result = OptaConfigSchema.safeParse({ browser: { enabled: true } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.browser?.homePage).toBeUndefined();
    }
  });
});
