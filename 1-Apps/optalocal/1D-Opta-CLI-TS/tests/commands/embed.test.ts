import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, ExitError } from '../../src/core/errors.js';

const mockLoadConfig = vi.fn();
const createEmbeddingsMock = vi.fn();

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../../src/lmx/client.js', () => ({
  LmxApiError: class LmxApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  LmxClient: class LmxClient {
    createEmbeddings = createEmbeddingsMock;
  },
}));

describe('embed command', () => {
  let logs: string[] = [];
  let errors: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    logs = [];
    errors = [];
    mockLoadConfig.mockResolvedValue({
      connection: { host: 'localhost', port: 1234, fallbackHosts: [], adminKey: undefined },
      model: { default: 'cfg-embedding-model' },
    });
    createEmbeddingsMock.mockResolvedValue({
      object: 'list',
      model: 'cfg-embedding-model',
      data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
      usage: { prompt_tokens: 3, total_tokens: 3 },
    });
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
  });

  it('creates embeddings with config default model', async () => {
    const { embed } = await import('../../src/commands/embed.js');
    await embed(['hello', 'world'], {});

    expect(createEmbeddingsMock).toHaveBeenCalledWith(
      { input: 'hello world', model: 'cfg-embedding-model' },
      { timeoutMs: 30000, maxRetries: 0 },
    );
    expect(logs.join('\n')).toContain('Embedded 1 input');
    expect(errors).toHaveLength(0);
  });

  it('supports --json output and explicit model override', async () => {
    const { embed } = await import('../../src/commands/embed.js');
    await embed('hello', { model: 'embed-v2', json: true });

    expect(createEmbeddingsMock).toHaveBeenCalledWith(
      { input: 'hello', model: 'embed-v2' },
      { timeoutMs: 30000, maxRetries: 0 },
    );
    expect(logs.join('\n')).toContain('"model": "cfg-embedding-model"');
  });

  it('fails with misuse when text is missing', async () => {
    const { embed } = await import('../../src/commands/embed.js');
    let thrown: unknown;
    try {
      await embed([], {});
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ExitError);
    expect(thrown).toMatchObject({ exitCode: EXIT.MISUSE });
  });
});
