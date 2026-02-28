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
});
