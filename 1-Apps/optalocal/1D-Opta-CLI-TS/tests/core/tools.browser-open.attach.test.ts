import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('browser_open attach config fallback', () => {
  it('uses browser.attach.wsEndpoint when attach mode is selected via config', async () => {
    vi.resetModules();

    const runtimeConfig = structuredClone(DEFAULT_CONFIG);
    runtimeConfig.browser.enabled = true;
    runtimeConfig.browser.mode = 'isolated';
    runtimeConfig.browser.attach.enabled = true;
    runtimeConfig.browser.attach.wsEndpoint = 'ws://127.0.0.1:9222/devtools/browser/mock';

    vi.doMock('../../src/core/config.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
        '../../src/core/config.js',
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => runtimeConfig),
      };
    });

    const { executeTool } = await import('../../src/core/tools/executors.js');
    const raw = await executeTool('browser_open', JSON.stringify({ session_id: 'sess-open-attach' }));
    if (raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw) as {
        message?: string;
      };
      expect(parsed.message ?? '').not.toContain('Attach mode requires ws_endpoint');
    } else {
      expect(raw).not.toContain('Attach mode requires ws_endpoint');
    }
  });

  it('returns a clear error when attach mode is selected without any ws endpoint', async () => {
    vi.resetModules();

    const runtimeConfig = structuredClone(DEFAULT_CONFIG);
    runtimeConfig.browser.enabled = true;
    runtimeConfig.browser.mode = 'attach';
    runtimeConfig.browser.attach.enabled = true;
    runtimeConfig.browser.attach.wsEndpoint = '';

    vi.doMock('../../src/core/config.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
        '../../src/core/config.js',
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => runtimeConfig),
      };
    });

    const { executeTool } = await import('../../src/core/tools/executors.js');
    const raw = await executeTool('browser_open', JSON.stringify({ session_id: 'sess-open-attach-missing' }));
    const parsed = JSON.parse(raw) as {
      ok: boolean;
      code?: string;
      message?: string;
    };

    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('OPEN_SESSION_FAILED');
    expect(parsed.message).toContain('Attach mode requires ws_endpoint');
  });
});
