import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { LMXClient } from '@/lib/lmx-client';
import type { AgentRunEvent } from '@/types/agents';
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

async function collectAgentEvents(
  stream: AsyncGenerator<AgentRunEvent>,
): Promise<AgentRunEvent[]> {
  const values: AgentRunEvent[] = [];
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

function writeJson(
  res: ServerResponse<IncomingMessage>,
  status: number,
  payload: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
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

describe('LMXClient extended endpoint integration', () => {
  it('calls /v1/responses with typed payload', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/v1/responses');

      const payload = JSON.parse(await readBody(req)) as {
        model: string;
        input: string;
      };
      expect(payload).toEqual({
        model: 'test-model',
        input: 'hello',
      });

      writeJson(res, 200, {
        id: 'resp-1',
        object: 'response',
        created_at: 123,
        model: 'test-model',
        output: [],
      });
    });

    const client = new LMXClient(baseUrl, '');
    const response = await client.createResponse({
      model: 'test-model',
      input: 'hello',
    });
    expect(response.id).toBe('resp-1');
  });

  it('calls /v1/messages with typed payload', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/v1/messages');

      const payload = JSON.parse(await readBody(req)) as {
        model: string;
        max_tokens: number;
      };
      expect(payload.model).toBe('claude-test');
      expect(payload.max_tokens).toBe(128);

      writeJson(res, 200, {
        id: 'msg-resp-1',
        type: 'message',
        role: 'assistant',
        model: 'claude-test',
        content: [{ type: 'text', text: 'ok' }],
      });
    });

    const client = new LMXClient(baseUrl, '');
    const response = await client.createMessage({
      model: 'claude-test',
      max_tokens: 128,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.type).toBe('message');
  });

  it('calls /v1/embeddings with typed payload', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/v1/embeddings');

      const payload = JSON.parse(await readBody(req)) as {
        model: string;
        input: string[];
      };
      expect(payload).toEqual({
        model: 'embed-test',
        input: ['one', 'two'],
      });

      writeJson(res, 200, {
        object: 'list',
        model: 'embed-test',
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
      });
    });

    const client = new LMXClient(baseUrl, '');
    const response = await client.createEmbeddings({
      model: 'embed-test',
      input: ['one', 'two'],
    });
    expect(response.data).toHaveLength(1);
  });

  it('calls /v1/rerank with typed payload', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/v1/rerank');

      const payload = JSON.parse(await readBody(req)) as {
        model: string;
        query: string;
      };
      expect(payload.model).toBe('rerank-test');
      expect(payload.query).toBe('best');

      writeJson(res, 200, {
        id: 'rerank-1',
        model: 'rerank-test',
        results: [{ index: 0, relevance_score: 0.99 }],
      });
    });

    const client = new LMXClient(baseUrl, '');
    const response = await client.rerank({
      model: 'rerank-test',
      query: 'best',
      documents: ['doc-1', 'doc-2'],
    });
    expect(response.results[0]?.relevance_score).toBe(0.99);
  });

  it('covers /v1/agents/runs lifecycle methods', async () => {
    const baseUrl = await startServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (req.method === 'POST' && url.pathname === '/v1/agents/runs') {
        const payload = JSON.parse(await readBody(req)) as {
          agent: string;
        };
        expect(payload.agent).toBe('agent-1');
        writeJson(res, 201, {
          object: 'agent.run',
          id: 'run-1',
          request: { roles: ['agent-1'] },
          status: 'queued',
          steps: [],
          created_at: 1700000000,
          updated_at: 1700000000,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/v1/agents/runs') {
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('status')).toBe('running');
        writeJson(res, 200, {
          object: 'list',
          data: [
            {
              object: 'agent.run',
              id: 'run-1',
              request: { roles: ['agent-1'] },
              status: 'running',
              steps: [],
              created_at: 1700000000,
              updated_at: 1700000001,
            },
          ],
          total: 1,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/v1/agents/runs/run-1') {
        writeJson(res, 200, {
          object: 'agent.run',
          id: 'run-1',
          request: { roles: ['agent-1'] },
          status: 'completed',
          steps: [],
          created_at: 1700000000,
          updated_at: 1700000002,
          output: { ok: true },
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname === '/v1/agents/runs/run-1/cancel'
      ) {
        writeJson(res, 200, {
          object: 'agent.run',
          id: 'run-1',
          request: { roles: ['agent-1'] },
          status: 'cancelled',
          steps: [],
          created_at: 1700000000,
          updated_at: 1700000003,
        });
        return;
      }

      if (
        req.method === 'GET' &&
        url.pathname === '/v1/agents/runs/run-1/events'
      ) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        await writeChunks(res, [
          'event: run.progress\n',
          'data: {"type":"run.progress","run_id":"run-1"}\n\n',
          'data: {"type":"run.completed","run_id":"run-1"}\n\n',
          'data: [DONE]\n\n',
        ]);
        res.end();
        return;
      }

      writeJson(res, 404, { error: 'not found' });
    });

    const client = new LMXClient(baseUrl, '');

    const created = await client.createAgentRun({
      agent: 'agent-1',
      input: { task: 'hello' },
    });
    expect(created.id).toBe('run-1');

    const list = await client.listAgentRuns({ limit: 5, status: 'running' });
    expect(list.data).toHaveLength(1);
    expect(list.total).toBe(1);

    const detail = await client.getAgentRun('run-1');
    expect(detail.status).toBe('completed');

    const cancelled = await client.cancelAgentRun('run-1');
    expect(cancelled.status).toBe('cancelled');

    const events = await collectAgentEvents(client.streamAgentRunEvents('run-1'));
    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('run.completed');
  });

  it('covers /v1/skills and MCP basics', async () => {
    const baseUrl = await startServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      if (req.method === 'GET' && url.pathname === '/v1/skills') {
        writeJson(res, 200, {
          object: 'list',
          data: [{ schema: '1.0', name: 'echo', namespace: 'default' }],
          total: 1,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/v1/skills/skill-1') {
        writeJson(res, 200, {
          id: 'skill-1',
          name: 'echo',
          description: 'Echoes input',
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname === '/v1/skills/skill-1/execute'
      ) {
        const payload = JSON.parse(await readBody(req)) as {
          arguments: { text: string };
        };
        expect(payload.arguments.text).toBe('hello');
        writeJson(res, 200, {
          skill: 'skill-1',
          ok: true,
          output: { text: 'hello' },
          duration_ms: 2,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/v1/skills/mcp/resources') {
        writeJson(res, 200, {
          ok: true,
          resources: [{ uri: 'file:///tmp/sample.txt' }],
        });
        return;
      }

      if (
        req.method === 'POST' &&
        url.pathname === '/mcp/resources/read'
      ) {
        const payload = JSON.parse(await readBody(req)) as { uri: string };
        expect(payload.uri).toBe('file:///tmp/sample.txt');
        writeJson(res, 200, {
          ok: true,
          contents: [{ uri: 'file:///tmp/sample.txt', text: 'Example prompt' }],
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/skills/mcp/call') {
        const payload = JSON.parse(await readBody(req)) as { name: string };
        expect(payload.name).toBe('echo');
        writeJson(res, 200, {
          skill_name: 'echo',
          kind: 'entrypoint',
          ok: true,
          output: { success: true },
          duration_ms: 1,
        });
        return;
      }

      writeJson(res, 404, { error: 'not found' });
    });

    const client = new LMXClient(baseUrl, '');

    const list = await client.listSkills();
    expect(list.data?.[0]?.name).toBe('echo');

    const skill = await client.getSkill('skill-1');
    expect(skill.name).toBe('echo');

    const execution = await client.executeSkill('skill-1', {
      arguments: { text: 'hello' },
    });
    expect(execution.ok).toBe(true);

    const resources = await client.skillsMcpList();
    expect(resources.resources[0]?.uri).toBe('file:///tmp/sample.txt');

    const read = await client.skillsMcpRead({
      uri: 'file:///tmp/sample.txt',
    });
    expect(read.contents?.[0]?.text).toBe('Example prompt');

    const call = await client.skillsMcpCall({
      name: 'echo',
      arguments: { value: 1 },
    });
    expect(call.ok).toBe(true);
  });

  it('calls /admin/memory', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('GET');
      expect(req.url).toBe('/admin/memory');
      writeJson(res, 200, {
        total_unified_memory_gb: 192,
        used_gb: 42,
        available_gb: 150,
        threshold_percent: 85,
        models: { 'model-a': { memory_gb: 12, loaded: true } },
      });
    });

    const client = new LMXClient(baseUrl, '');
    const memory = await client.getMemory();
    expect(memory.total_unified_memory_gb).toBe(192);
    expect(memory.models?.['model-a']?.memory_gb).toBe(12);
  });

  it('calls /admin/diagnostics', async () => {
    const baseUrl = await startServer(async (req, res) => {
      expect(req.method).toBe('GET');
      expect(req.url).toBe('/admin/diagnostics');
      writeJson(res, 200, {
        timestamp: 1700000000,
        system: { memory_percent: 30 },
        models: { loaded: 2 },
        inference: { requests_total: 10 },
        agents: { active_runs: 1 },
        recent_errors: [],
        health_verdict: {
          status: 'ok',
        },
      });
    });

    const client = new LMXClient(baseUrl, '');
    const diagnostics = await client.getDiagnostics();
    expect(diagnostics.health_verdict?.status).toBe('ok');
    expect(diagnostics.system?.memory_percent).toBe(30);
  });
});
