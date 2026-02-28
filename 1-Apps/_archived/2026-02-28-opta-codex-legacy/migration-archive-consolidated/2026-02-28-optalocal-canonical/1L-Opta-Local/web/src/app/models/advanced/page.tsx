'use client';

import { useCallback, useMemo, useState } from 'react';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type {
  EmbeddingsRequest,
  MessagesCreateRequest,
  RerankRequest,
  ResponsesCreateRequest,
} from '@/types/lmx';

type AdvancedOperation = 'responses' | 'messages' | 'embeddings' | 'rerank';

const DEFAULT_PAYLOADS: Record<AdvancedOperation, string> = {
  responses: JSON.stringify(
    {
      model: 'auto',
      input: 'Summarize the current system state in one sentence.',
    },
    null,
    2,
  ),
  messages: JSON.stringify(
    {
      model: 'auto',
      max_tokens: 128,
      messages: [{ role: 'user', content: 'What is the current status?' }],
    },
    null,
    2,
  ),
  embeddings: JSON.stringify(
    {
      model: 'text-embedding-3-small',
      input: ['hello world'],
    },
    null,
    2,
  ),
  rerank: JSON.stringify(
    {
      model: 'rerank-2',
      query: 'best option',
      documents: ['Option A', 'Option B'],
    },
    null,
    2,
  ),
};

export default function ModelsAdvancedPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [operation, setOperation] = useState<AdvancedOperation>('responses');
  const [payloadText, setPayloadText] = useState(DEFAULT_PAYLOADS.responses);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const [modelLookupId, setModelLookupId] = useState('');
  const [modelLookupResult, setModelLookupResult] = useState<unknown>(null);

  const operationTitle = useMemo(() => {
    switch (operation) {
      case 'responses':
        return '/v1/responses';
      case 'messages':
        return '/v1/messages';
      case 'embeddings':
        return '/v1/embeddings';
      case 'rerank':
        return '/v1/rerank';
    }
  }, [operation]);

  const switchOperation = useCallback((next: AdvancedOperation) => {
    setOperation(next);
    setPayloadText(DEFAULT_PAYLOADS[next]);
    setResult(null);
    setError(null);
  }, []);

  const runOperation = useCallback(async () => {
    if (!client) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(payloadText) as object;
      if (operation === 'responses') {
        const response = await client.createResponse(parsed as ResponsesCreateRequest);
        setResult(response);
      } else if (operation === 'messages') {
        const response = await client.createMessage(parsed as MessagesCreateRequest);
        setResult(response);
      } else if (operation === 'embeddings') {
        const response = await client.createEmbeddings(parsed as EmbeddingsRequest);
        setResult(response);
      } else {
        const response = await client.rerank(parsed as RerankRequest);
        setResult(response);
      }
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : 'Advanced operation failed',
      );
    } finally {
      setIsRunning(false);
    }
  }, [client, operation, payloadText]);

  const inspectModel = useCallback(async () => {
    if (!client || !modelLookupId.trim()) return;
    setError(null);
    try {
      const model = await client.getModelById(modelLookupId.trim());
      setModelLookupResult(model);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to inspect model',
      );
    }
  }, [client, modelLookupId]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Models Advanced</h1>
        <p className="text-sm text-text-secondary">
          Minimal advanced model operations for responses, messages, embeddings,
          rerank, and per-model inspection.
        </p>
      </header>

      <section className="mb-4 rounded-lg border border-opta-border bg-opta-surface/20 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">
          Inspect Model
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={modelLookupId}
            onChange={(event) => setModelLookupId(event.target.value)}
            placeholder="model-id"
            className="min-w-[220px] flex-1 rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-xs text-text-primary"
          />
          <button
            type="button"
            className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => void inspectModel()}
            disabled={!modelLookupId.trim() || !client}
          >
            Inspect
          </button>
        </div>
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary">
          {modelLookupResult
            ? JSON.stringify(modelLookupResult, null, 2)
            : 'No model loaded.'}
        </pre>
      </section>

      <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
        <h2 className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">
          Endpoint
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => switchOperation('responses')}
          >
            /v1/responses
          </button>
          <button
            type="button"
            className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => switchOperation('messages')}
          >
            /v1/messages
          </button>
          <button
            type="button"
            className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => switchOperation('embeddings')}
          >
            /v1/embeddings
          </button>
          <button
            type="button"
            className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => switchOperation('rerank')}
          >
            /v1/rerank
          </button>
        </div>

        <p className="mb-2 text-xs text-text-secondary">
          Active endpoint: <span className="font-mono">{operationTitle}</span>
        </p>
        <textarea
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          className="mb-3 h-40 w-full rounded border border-opta-border bg-opta-surface/30 p-2 font-mono text-xs text-text-primary"
        />
        <button
          type="button"
          className="rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          onClick={() => void runOperation()}
          disabled={isRunning || !client}
        >
          {isRunning ? 'Running...' : 'Run Operation'}
        </button>

        {error && (
          <p className="mt-2 rounded border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
            {error}
          </p>
        )}

        <pre className="mt-2 max-h-72 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs text-text-secondary">
          {result ? JSON.stringify(result, null, 2) : 'No result yet.'}
        </pre>
      </section>
    </main>
  );
}

