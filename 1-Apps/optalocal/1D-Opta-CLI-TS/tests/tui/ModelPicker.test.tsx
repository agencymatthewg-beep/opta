import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ModelPicker } from '../../src/tui/ModelPicker.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mockFetchInventory() {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith('/admin/models/available')) {
      return {
        ok: true,
        json: async () => ([
          { repo_id: 'inferencerlabs/GLM-5-MLX-4.8bit', local_path: '/tmp/glm', size_bytes: 448_900_000_000 },
        ]),
      };
    }
    if (url.endsWith('/admin/models')) {
      return {
        ok: true,
        json: async () => ({
          loaded: [
            {
              id: 'mlx-community/MiniMax-M2.5-4bit',
              loaded: true,
              memory_gb: 118.2,
              loaded_at: 1_711_111_111,
              use_batching: true,
              request_count: 10,
              last_used_at: 1_711_111_112,
              context_length: 197000,
            },
          ],
          count: 1,
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ data: [] }),
    };
  }));
}

describe('ModelPicker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns selection metadata for on-disk models', async () => {
    mockFetchInventory();
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <ModelPicker
        currentModel="mlx-community/MiniMax-M2.5-4bit"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    for (let i = 0; i < 20; i++) {
      if (lastFrame().includes('GLM-5-MLX-4.8bit')) break;
      await flush();
    }

    stdin.write('\u001B[B'); // down arrow
    await flush();
    stdin.write('\r'); // enter
    await flush();

    expect(onSelect).toHaveBeenCalledWith({
      id: 'inferencerlabs/GLM-5-MLX-4.8bit',
      source: 'disk',
      loaded: false,
    });
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('closes without re-selecting when current loaded model is chosen', async () => {
    mockFetchInventory();
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <ModelPicker
        currentModel="mlx-community/MiniMax-M2.5-4bit"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    for (let i = 0; i < 20; i++) {
      if (lastFrame().includes('MiniMax-M2.5-4bit')) break;
      await flush();
    }

    stdin.write('\r'); // enter on current model
    await flush();

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('shows a friendly timeout error when inventory calls time out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }),
    );

    const { lastFrame, unmount } = render(
      <ModelPicker
        currentModel="mlx-community/MiniMax-M2.5-4bit"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    for (let i = 0; i < 30; i++) {
      if (lastFrame().includes('Failed to load models:')) break;
      await flush();
    }

    const frame = lastFrame();
    expect(frame).toContain('Failed to load models: connection to 127.0.0.1:1234 timed out while loading model inventory');
    unmount();
  });
});
