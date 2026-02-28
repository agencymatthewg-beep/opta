import { useMemo, useState } from 'react';
import { Button } from '@opta/ui';
import { CopyableValue } from '@/components/shared/CopyableValue';

interface CapabilityRunCardProps {
  endpointPath: string;
  method: 'GET' | 'POST' | 'DELETE';
  baseUrl: string;
  adminKey: string;
  defaultPayload: string;
}

type RunResponse =
  | { kind: 'json'; data: unknown }
  | { kind: 'text'; data: string };

export function CapabilityRunCard({
  endpointPath,
  method,
  baseUrl,
  adminKey,
  defaultPayload,
}: CapabilityRunCardProps) {
  const [payload, setPayload] = useState(defaultPayload);
  const [isRunning, setIsRunning] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResponse, setRunResponse] = useState<RunResponse | null>(null);

  const canSendBody = method === 'POST';
  const fullUrl = useMemo(() => {
    if (!baseUrl) return endpointPath;
    return `${baseUrl}${endpointPath}`;
  }, [baseUrl, endpointPath]);
  const retryTemplate = `${method} ${fullUrl}`;
  const responseId = useMemo(() => {
    if (runResponse?.kind !== 'json') return null;
    if (typeof runResponse.data !== 'object' || runResponse.data == null) return null;
    const candidate = runResponse.data as Record<string, unknown>;
    const idLike = candidate.id ?? candidate.run_id ?? candidate.session_id;
    return typeof idLike === 'string' ? idLike : null;
  }, [runResponse]);

  async function copyText(value: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
  }

  async function handleRun() {
    setIsRunning(true);
    setRunError(null);
    setRunResponse(null);
    setStatusCode(null);

    try {
      if (!baseUrl) {
        throw new Error('No active LMX connection. Configure Settings first.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (adminKey) headers['X-Admin-Key'] = adminKey;

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: canSendBody ? payload : undefined,
      });

      setStatusCode(response.status);
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const json = (await response.json()) as unknown;
        setRunResponse({ kind: 'json', data: json });
      } else {
        const text = await response.text();
        setRunResponse({ kind: 'text', data: text });
      }
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : 'Request failed unexpectedly',
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-opta-border bg-opta-surface/20 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-opta-border bg-opta-surface/40 px-2 py-1 text-[11px] font-semibold text-text-primary">
          {method}
        </span>
        <code className="rounded-md bg-opta-surface/40 px-2 py-1 text-[11px] text-text-secondary">
          {endpointPath}
        </code>
      </div>

      <div className="mb-3">
        <CopyableValue
          label="Endpoint URL"
          value={fullUrl}
          mono
          testId="endpoint-url"
          copyLabel="Copy Endpoint"
        />
      </div>

      <div className="mb-2 text-xs text-text-muted">Request Payload</div>
      <textarea
        data-testid="payload-input"
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        className="mb-3 h-36 w-full rounded-md border border-opta-border bg-opta-surface/40 p-2 font-mono text-xs text-text-primary"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => void copyText(payload)}>
          Copy Payload
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void copyText(retryTemplate)}>
          Copy Retry Command
        </Button>
        <Button
          data-testid="run-button"
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleRun()}
          disabled={isRunning}
        >
          {isRunning ? 'Running…' : 'Run now'}
        </Button>
      </div>

      {statusCode != null && (
        <div className="mb-2 text-xs text-text-muted">HTTP {statusCode}</div>
      )}

      {responseId ? (
        <div className="mb-2">
          <CopyableValue label="Response ID" value={responseId} mono />
        </div>
      ) : null}

      {runError && (
        <div className="mb-2 rounded-md border border-neon-red/40 bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {runError}
        </div>
      )}

      <div className="text-xs text-text-muted">Response</div>
      <pre
        data-testid="response-panel"
        className="mt-1 max-h-80 overflow-auto rounded-md border border-opta-border bg-opta-surface/40 p-2 text-xs text-text-secondary"
      >
        {runResponse == null
          ? 'No response yet.'
          : runResponse.kind === 'json'
            ? JSON.stringify(runResponse.data, null, 2)
            : runResponse.data}
      </pre>
    </section>
  );
}
