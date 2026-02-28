'use client';

import { useCallback, useState } from 'react';

import { CodexActionLine } from '@/components/shared/CodexActionLine';
import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';
import { CodexKeyValue } from '@/components/shared/CodexKeyValue';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type { ResponsesCreateResponse } from '@/types/lmx';

interface ChatTurn {
  prompt: string;
  response: string;
}

function flattenResponse(response: ResponsesCreateResponse): string {
  return response.output
    .flatMap((message) => message.content)
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export default function ChatPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [model, setModel] = useState('auto');
  const [prompt, setPrompt] = useState('Summarize current LMX system status.');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [lastResponse, setLastResponse] = useState<ResponsesCreateResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPrompt = useCallback(async () => {
    if (!client || !prompt.trim()) return;

    setIsRunning(true);
    setError(null);
    try {
      const response = await client.createResponse({
        model,
        input: prompt,
      });
      setLastResponse(response);
      setHistory((current) => [
        {
          prompt,
          response: flattenResponse(response) || '(empty response)',
        },
        ...current,
      ]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Chat failed');
    } finally {
      setIsRunning(false);
    }
  }, [client, model, prompt]);

  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Chat"
        subtitle="Precise prompt-response loop using /v1/responses."
      >
        <CodexKeyValue label="Endpoint" value="/v1/responses" mono />
        <div>
          <label className="codex-kv-label" htmlFor="chat-model">
            Model
          </label>
          <input
            id="chat-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="codex-kv-label" htmlFor="chat-prompt">
            Prompt
          </label>
          <textarea
            id="chat-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="h-28 w-full rounded border border-opta-border bg-opta-surface/30 p-2 text-sm"
          />
        </div>
        <CodexActionLine
          primaryLabel={isRunning ? 'Running...' : 'Run Prompt'}
          primaryDisabled={isRunning || !client || !prompt.trim()}
          onPrimary={() => void runPrompt()}
        />
        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      </CodexDenseSurface>

      <CodexDenseSurface title="Last Raw Response" subtitle="Copyable JSON payload">
        <pre className="max-h-72 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs">
          {lastResponse ? JSON.stringify(lastResponse, null, 2) : 'No response yet.'}
        </pre>
      </CodexDenseSurface>

      <CodexDenseSurface title="History" subtitle="Newest first">
        {history.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No turns yet.</p>
        ) : (
          history.map((turn, index) => (
            <article
              key={`${turn.prompt}-${index}`}
              className="rounded border border-opta-border bg-opta-surface/30 p-2"
            >
              <p className="codex-kv-label" style={{ marginTop: 0 }}>
                Prompt
              </p>
              <p style={{ marginTop: 0 }}>{turn.prompt}</p>
              <p className="codex-kv-label">Response</p>
              <p style={{ marginBottom: 0 }}>{turn.response}</p>
            </article>
          ))
        )}
      </CodexDenseSurface>
    </main>
  );
}
