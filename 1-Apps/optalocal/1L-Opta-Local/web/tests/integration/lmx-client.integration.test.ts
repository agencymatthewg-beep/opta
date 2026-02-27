import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { LMXClient } from '@/lib/lmx-client';
import { LMXError, type ChatMessage } from '@/types/lmx';

type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
) => Promise<void> | void;

const servers: Server[] = [];

const testMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Say hello',
    created_at: '2026-02-20T00:00:00.000Z',
  },
];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (server) => {
      if (!server.listening) return;
      server.close();
      await once(server, 'close');
    }),
  );
});

async function startServer(handler: RequestHandler): Promise<string> {
  const server = createServer(async (req, res) => {
    await handler(req, res);
  });
  servers.push(server);

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address');
  }

  return `http://127.0.0.1:${address.port}`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  return body;
}

async function collectStream(stream: AsyncGenerator<string>): Promise<string[]> {
  const values: string[] = [];
  for await (const value of stream) {
    values.push(value);
  }
  return values;
}

async function writeChunks(
  res: ServerResponse<IncomingMessage>,
  chunks: string[],
): Promise<void> {
  for (const chunk of chunks) {
    res.write(chunk);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe('LMXClient.streamChat integration', () => {
  it('parses multiple SSE data chunks and [DONE]', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/v1/chat/completions');
      expect(req.headers['x-admin-key']).toBe('test-admin-key');

      const payload = JSON.parse(await readBody(req)) as {
        model: string;
        stream: boolean;
      };
      expect(payload.model).toBe('test-model');
      expect(payload.stream).toBe(true);

      res.writeHead(200, { 'Content-Type': 'text/event-stream' });

      const first = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n';
      const second = 'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n';
      const done = 'data: [DONE]\n\n';

      await writeChunks(res, [
        first.slice(0, 12),
        first.slice(12) + second.slice(0, 15),
        second.slice(15),
        done,
      ]);
      res.end();
    });

    const client = new LMXClient(baseUrl, 'test-admin-key');
    const chunks = await collectStream(
      client.streamChat('test-model', testMessages),
    );

    expect(chunks).toEqual(['Hel', 'lo']);
    expect(chunks.join('')).toBe('Hello');
  });

  it('ignores malformed lines safely', async () => {
    const baseUrl = await startServer(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });

      await writeChunks(res, [
        ': keep-alive\n\n',
        'event: message\n\n',
        'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
        'data: {not-json}\n\n',
        'this line should be ignored\n',
        'data: {"choices":[{"delta":{"content":"B"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
      res.end();
    });

    const client = new LMXClient(baseUrl, '');
    const chunks = await collectStream(
      client.streamChat('test-model', testMessages),
    );

    expect(chunks).toEqual(['A', 'B']);
  });

  it('throws LMXError with status and body on non-2xx response', async () => {
    const baseUrl = await startServer(async (_req, res) => {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('LMX backend unavailable');
    });

    const client = new LMXClient(baseUrl, '');

    let thrown: unknown;
    try {
      await collectStream(client.streamChat('test-model', testMessages));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LMXError);
    const lmxError = thrown as LMXError;
    expect(lmxError.status).toBe(503);
    expect(lmxError.body).toBe('LMX backend unavailable');
  });
});
