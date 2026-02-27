import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT, ExitError } from '../../src/core/errors.js';

const mockLoadConfig = vi.fn();
const rerankDocumentsMock = vi.fn();

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
    rerankDocuments = rerankDocumentsMock;
  },
}));

describe('rerank command', () => {
  let logs: string[] = [];
  let errors: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    logs = [];
    errors = [];
    mockLoadConfig.mockResolvedValue({
      connection: { host: 'localhost', port: 1234, fallbackHosts: [], adminKey: undefined },
      model: { default: 'cfg-rerank-model' },
    });
    rerankDocumentsMock.mockResolvedValue({
      model: 'cfg-rerank-model',
      usage: { total_tokens: 9 },
      results: [
        { index: 1, relevance_score: 0.92, document: { text: 'doc two' } },
        { index: 0, relevance_score: 0.63, document: { text: 'doc one' } },
      ],
    });
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });
  });

  it('reranks documents with parsed options', async () => {
    const { rerank } = await import('../../src/commands/rerank.js');
    await rerank(['search', 'query'], {
      documents: 'doc one|doc two|doc three',
      topK: '2',
    });

    expect(rerankDocumentsMock).toHaveBeenCalledWith(
      {
        model: 'cfg-rerank-model',
        query: 'search query',
        documents: ['doc one', 'doc two', 'doc three'],
        topN: 2,
      },
      { timeoutMs: 30000, maxRetries: 0 },
    );
    expect(logs.join('\n')).toContain('Reranked 3 documents');
    expect(errors).toHaveLength(0);
  });

  it('supports --json output and explicit model override', async () => {
    const { rerank } = await import('../../src/commands/rerank.js');
    await rerank('search query', {
      documents: 'doc one|doc two',
      model: 'rerank-v2',
      json: true,
    });

    expect(rerankDocumentsMock).toHaveBeenCalledWith(
      {
        model: 'rerank-v2',
        query: 'search query',
        documents: ['doc one', 'doc two'],
        topN: undefined,
      },
      { timeoutMs: 30000, maxRetries: 0 },
    );
    expect(logs.join('\n')).toContain('"results"');
  });

  it('fails with misuse when documents are missing', async () => {
    const { rerank } = await import('../../src/commands/rerank.js');
    await expect(rerank('search query', {})).rejects.toMatchObject({ exitCode: EXIT.MISUSE });
  });

  it('fails with misuse when top-k is invalid', async () => {
    const { rerank } = await import('../../src/commands/rerank.js');
    await expect(
      rerank('search query', { documents: 'doc one|doc two', topK: '0' }),
    ).rejects.toBeInstanceOf(ExitError);
  });
});
