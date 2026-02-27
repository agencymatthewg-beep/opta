import { describe, expect, it, vi } from 'vitest';
import {
  computeAdaptivePollDelayMs,
  computeLoadRequestTimeoutMs,
  ensureModelLoaded,
  findMatchingModelId,
  isPlaceholderModelId,
  modelIdsEqual,
  normalizeConfiguredModelId,
  normalizeModelIdKey,
  waitForModelLoaded,
  waitForModelUnloaded,
} from '../../src/lmx/model-lifecycle.js';
import { LmxApiError, type LmxClient } from '../../src/lmx/client.js';

describe('lmx model lifecycle helpers', () => {
  it('treats placeholder model values as unusable defaults', () => {
    expect(isPlaceholderModelId('off')).toBe(true);
    expect(isPlaceholderModelId(' NONE ')).toBe(true);
    expect(isPlaceholderModelId('')).toBe(true);
    expect(isPlaceholderModelId('inferencerlabs/GLM-5-MLX-4.8bit')).toBe(false);
  });

  it('normalizes configured model values by stripping placeholders', () => {
    expect(normalizeConfiguredModelId(' off ')).toBe('');
    expect(normalizeConfiguredModelId('inferencerlabs/GLM-5-MLX-4.8bit')).toBe(
      'inferencerlabs/GLM-5-MLX-4.8bit',
    );
  });

  it('normalizes and compares model IDs across punctuation/case', () => {
    expect(normalizeModelIdKey('InferencerLabs/GLM-5-MLX-4.8bit')).toBe('inferencerlabsglm5mlx48bit');
    expect(modelIdsEqual('inferencerlabs/GLM-5-MLX-4.8bit', 'InferencerLabs GLM 5 MLX 4.8bit')).toBe(true);
  });

  it('finds matching IDs by normalized form', () => {
    const match = findMatchingModelId('kimi k2.5 3b mlx', [
      'mlx-community/MiniMax-M2.5-4bit',
      'Kimi/Kimi-K2.5-3B-MLX',
    ]);
    expect(match).toBe('Kimi/Kimi-K2.5-3B-MLX');
  });

  it('waits until model appears as loaded', async () => {
    const client = {
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [] })
        .mockResolvedValueOnce({ models: [] })
        .mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
    } as unknown as LmxClient;

    const loaded = await waitForModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 200,
    });

    expect(loaded).toBe('inferencerlabs/GLM-5-MLX-4.8bit');
  });

  it('waits until model disappears from loaded list', async () => {
    const client = {
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [{ model_id: 'kimi/Kimi-K2.5-3B-MLX' }] })
        .mockResolvedValueOnce({ models: [{ model_id: 'kimi/Kimi-K2.5-3B-MLX' }] })
        .mockResolvedValue({ models: [] }),
    } as unknown as LmxClient;

    await expect(
      waitForModelUnloaded(client, 'kimi/Kimi-K2.5-3B-MLX', { pollMs: 1, timeoutMs: 200 }),
    ).resolves.toBeUndefined();
  });

  it('loads then waits for readiness before returning', async () => {
    const client = {
      loadModel: vi.fn().mockResolvedValue({ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }),
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [] })
        .mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
    } as unknown as LmxClient;

    const ready = await ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 2000,
    });

    expect(client.loadModel).toHaveBeenCalledWith('inferencerlabs/GLM-5-MLX-4.8bit', {
      timeoutMs: 2000,
      maxRetries: 0,
    });
    expect(ready).toBe('inferencerlabs/GLM-5-MLX-4.8bit');
  });

  it('continues readiness polling when load request times out client-side', async () => {
    const client = {
      loadModel: vi.fn().mockRejectedValue(
        new LmxApiError(0, 'connection_error', 'request timed out after 15s'),
      ),
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [] })
        .mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
    } as unknown as LmxClient;

    const ready = await ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 2000,
    });

    expect(client.loadModel).toHaveBeenCalledWith('inferencerlabs/GLM-5-MLX-4.8bit', {
      timeoutMs: 2000,
      maxRetries: 0,
    });
    expect(ready).toBe('inferencerlabs/GLM-5-MLX-4.8bit');
  });

  it('confirms pending download and waits for download completion before readiness polling', async () => {
    const client = {
      loadModel: vi.fn().mockResolvedValue({
        model_id: 'inferencerlabs/GLM-5-MLX-4.8bit',
        status: 'download_required',
        confirmation_token: 'token-123',
      }),
      confirmLoad: vi.fn().mockResolvedValue({
        model_id: 'inferencerlabs/GLM-5-MLX-4.8bit',
        status: 'downloading',
        download_id: 'dl-1',
      }),
      downloadProgress: vi
        .fn()
        .mockResolvedValueOnce({ status: 'downloading' })
        .mockResolvedValueOnce({ status: 'completed' }),
      models: vi.fn().mockResolvedValue({
        models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }],
      }),
    } as unknown as LmxClient;

    const ready = await ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 2000,
    });

    expect(client.confirmLoad).toHaveBeenCalledWith('token-123', { timeoutMs: 2000, maxRetries: 0 });
    expect(client.downloadProgress).toHaveBeenCalledWith('dl-1');
    expect(ready).toBe('inferencerlabs/GLM-5-MLX-4.8bit');
  });

  it('fails fast when background download reports failed status', async () => {
    const client = {
      loadModel: vi.fn().mockResolvedValue({
        model_id: 'inferencerlabs/GLM-5-MLX-4.8bit',
        status: 'downloading',
        download_id: 'dl-1',
      }),
      downloadProgress: vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'no disk',
      }),
      models: vi.fn().mockResolvedValue({ models: [] }),
    } as unknown as LmxClient;

    await expect(
      ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
        pollMs: 1,
        timeoutMs: 2000,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Download failed'),
    });
  });

  it('uses a slightly longer request timeout for very long load budgets', async () => {
    const client = {
      loadModel: vi.fn().mockResolvedValue({ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }),
      models: vi.fn().mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
    } as unknown as LmxClient;

    await ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 300_000,
    });

    expect(client.loadModel).toHaveBeenCalledWith('inferencerlabs/GLM-5-MLX-4.8bit', {
      timeoutMs: 15000,
      maxRetries: 0,
    });
  });

  it('keeps load request timeout equal to short budgets', () => {
    expect(computeLoadRequestTimeoutMs(2_000)).toBe(2_000);
  });

  it('backs off polling delays and tightens again near deadline', () => {
    const base = computeAdaptivePollDelayMs({
      attempt: 1,
      basePollMs: 200,
      timeoutMs: 30_000,
      elapsedMs: 0,
    });
    const backedOff = computeAdaptivePollDelayMs({
      attempt: 6,
      basePollMs: 200,
      timeoutMs: 30_000,
      elapsedMs: 5_000,
    });
    const nearDeadline = computeAdaptivePollDelayMs({
      attempt: 6,
      basePollMs: 200,
      timeoutMs: 30_000,
      elapsedMs: 28_000,
    });

    expect(backedOff).toBeGreaterThan(base);
    expect(nearDeadline).toBeLessThan(backedOff);
    expect(nearDeadline).toBeGreaterThanOrEqual(200);
  });

  it('emits progress updates while waiting for model readiness', async () => {
    const onProgress = vi.fn();
    const client = {
      loadModel: vi.fn().mockResolvedValue({ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }),
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [] })
        .mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
    } as unknown as LmxClient;

    const ready = await ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
      pollMs: 1,
      timeoutMs: 2000,
      onProgress,
    });

    expect(ready).toBe('inferencerlabs/GLM-5-MLX-4.8bit');
    expect(onProgress).toHaveBeenCalled();
    const statuses = onProgress.mock.calls.map(([arg]) => arg.status);
    expect(statuses).toContain('waiting');
    expect(statuses).toContain('ready');
  });

  it('emits waiting progress while load request is still in-flight', async () => {
    vi.useFakeTimers();
    try {
      const onProgress = vi.fn();
      let resolveLoad: (() => void) | undefined;

      const client = {
        loadModel: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            resolveLoad = () => resolve({ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' });
          }),
        ),
        models: vi.fn().mockResolvedValue({ models: [{ model_id: 'inferencerlabs/GLM-5-MLX-4.8bit' }] }),
      } as unknown as LmxClient;

      const readyPromise = ensureModelLoaded(client, 'inferencerlabs/GLM-5-MLX-4.8bit', {
        pollMs: 1,
        timeoutMs: 2000,
        onProgress,
      });

      await vi.advanceTimersByTimeAsync(1200);
      expect(onProgress).toHaveBeenCalled();
      const dispatchWaitingCalls = onProgress.mock.calls
        .map(([arg]) => arg)
        .filter((progress) => progress.attempt === 0 && progress.status === 'waiting');
      expect(dispatchWaitingCalls.length).toBeGreaterThan(0);

      resolveLoad?.();
      await readyPromise;
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits unload progress updates while waiting for removal', async () => {
    const onProgress = vi.fn();
    const client = {
      models: vi
        .fn()
        .mockResolvedValueOnce({ models: [{ model_id: 'kimi/Kimi-K2.5-3B-MLX' }] })
        .mockResolvedValue({ models: [] }),
    } as unknown as LmxClient;

    await waitForModelUnloaded(client, 'kimi/Kimi-K2.5-3B-MLX', {
      pollMs: 1,
      timeoutMs: 200,
      onProgress,
    });

    const statuses = onProgress.mock.calls.map(([arg]) => arg.status);
    expect(statuses).toContain('waiting');
    expect(statuses).toContain('ready');
  });
});
