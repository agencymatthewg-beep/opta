import { describe, expect, it, vi } from 'vitest';
import { DaemonHttpClient } from './http-client.js';

function jsonOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('DaemonHttpClient operations APIs', () => {
  const connection = {
    host: 'daemon.local',
    port: 4317,
    token: 'secret-token',
  };

  it('requests the operation catalog from /v3/operations', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonOk({ operations: [] }));
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    await client.listOperations();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected fetch to be called');
    const [url, init] = call;
    const requestInit = init ?? {};
    expect(url).toBe('http://daemon.local:4317/v3/operations');
    expect(requestInit.method).toBeUndefined();

    const headers = new Headers(requestInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
  });

  it('posts payload to /v3/operations/:id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonOk({ ok: true, result: { queued: 1 } }));
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);
    const payload = {
      sessionId: 'sess-123',
      includeLogs: true,
    };

    await client.runOperation('env.inspect/system', payload);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected fetch to be called');
    const [url, init] = call;
    const requestInit = init ?? {};
    expect(url).toBe('http://daemon.local:4317/v3/operations/env.inspect%2Fsystem');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toBe(JSON.stringify(payload));

    const headers = new Headers(requestInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('sends an empty object when payload is omitted', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonOk({ ok: true }));
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    await client.runOperation('doctor');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected fetch to be called');
    const [url, init] = call;
    const requestInit = init ?? {};
    expect(url).toBe('http://daemon.local:4317/v3/operations/doctor');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.body).toBe('{}');
  });

  it('keeps existing method behavior for health endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonOk({ status: 'ok' }));
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    await client.health();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected fetch to be called');
    const [url] = call;
    expect(url).toBe('http://daemon.local:4317/v3/health');
  });

  it('normalizes cancel responses when daemon returns detailed fields', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonOk({ ok: true, cancelledQueued: 2, cancelledActive: true })
    );
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    const result = await client.cancel('sess-123', { writerId: 'writer-1' });

    expect(result).toEqual({
      ok: true,
      cancelled: 3,
      cancelledQueued: 2,
      cancelledActive: true,
    });
  });

  it('normalizes available models from repo_id to model_id for compatibility', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonOk([{ repo_id: 'demo/model', size_bytes: 1234 }])
    );
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    const result = await client.lmxAvailable();

    expect(result).toEqual([
      {
        model_id: 'demo/model',
        repo_id: 'demo/model',
        size_bytes: 1234,
        quantization: undefined,
        modified_at: undefined,
        local_path: undefined,
        downloaded_at: undefined,
      },
    ]);
  });

  it('requests active downloads from /v3/lmx/models/downloads with includeInactive query', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonOk({
        downloads: [],
        count: 0,
        includeInactive: true,
      })
    );
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    const result = await client.lmxDownloads(true);

    expect(result).toEqual({
      downloads: [],
      count: 0,
      includeInactive: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected fetch to be called');
    const [url] = call;
    expect(url).toBe('http://daemon.local:4317/v3/lmx/models/downloads?includeInactive=true');
  });

  it('preserves camelCase progress keys and snake_case aliases for compatibility', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonOk({
        downloadId: 'dl_123',
        repoId: 'demo/model',
        status: 'downloading',
        progressPercent: 42,
        downloadedBytes: 420,
        totalBytes: 1000,
        filesCompleted: 4,
        filesTotal: 10,
        download_id: 'dl_123',
        repo_id: 'demo/model',
        progress_percent: 42,
        downloaded_bytes: 420,
        total_bytes: 1000,
        files_completed: 4,
        files_total: 10,
      })
    );
    const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

    const result = await client.lmxDownloadProgress('dl_123');

    expect(result).toMatchObject({
      downloadId: 'dl_123',
      repoId: 'demo/model',
      progressPercent: 42,
      download_id: 'dl_123',
      repo_id: 'demo/model',
      progress_percent: 42,
    });
  });

  it('aborts long-running requests at the timeout window', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          if (!signal) return;
          if (signal.aborted) {
            reject(new Error('aborted'));
            return;
          }
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      });
      const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

      const pending = expect(client.health()).rejects.toThrow(
        'Daemon request timed out (8000ms): /v3/health'
      );
      await vi.advanceTimersByTimeAsync(8_000);
      await pending;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses extended timeout budget for LMX model mutations', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          if (!signal) return;
          if (signal.aborted) {
            reject(new Error('aborted'));
            return;
          }
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
      });
      const client = new DaemonHttpClient(connection, fetchImpl as unknown as typeof fetch);

      const pending = expect(client.lmxLoad('demo/model')).rejects.toThrow(
        'Daemon request timed out (120000ms): /v3/lmx/models/load'
      );
      await vi.advanceTimersByTimeAsync(120_000);
      await pending;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
