import { CapabilityRunCard } from '@/components/operations/CapabilityRunCard';
import { CopyableValue } from '@/components/shared/CopyableValue';

interface CapabilityPanelProps {
  endpointPath: string | null;
  baseUrl: string;
  adminKey: string;
}

function inferMethod(path: string): 'GET' | 'POST' | 'DELETE' {
  if (
    path.includes('/cancel') ||
    path.includes('/reload') ||
    path.includes('/load') ||
    path.includes('/unload') ||
    path.includes('/download') ||
    path.includes('/autotune') ||
    path.includes('/probe') ||
    path.includes('/quantize') ||
    path.includes('/messages') ||
    path.includes('/responses') ||
    path.includes('/embeddings') ||
    path.includes('/rerank') ||
    path.includes('/mcp/')
  ) {
    return 'POST';
  }
  if (path.match(/\/v1\/rag\/collections\/\{param\}$/)) {
    return 'DELETE';
  }
  return 'GET';
}

function inferPayload(path: string): string {
  if (path.includes('/models/load')) {
    return JSON.stringify(
      { model_path: 'mlx-community/Qwen3-8B-4bit', quantization: '4bit' },
      null,
      2,
    );
  }
  if (path.includes('/models/unload')) {
    return JSON.stringify({ model_id: 'mlx-community/Qwen3-8B-4bit' }, null, 2);
  }
  if (path === '/v1/responses') {
    return JSON.stringify(
      { model: 'auto', input: 'Hello from Operations' },
      null,
      2,
    );
  }
  if (path === '/v1/messages') {
    return JSON.stringify(
      {
        model: 'auto',
        max_tokens: 128,
        messages: [{ role: 'user', content: 'Hello from Operations' }],
      },
      null,
      2,
    );
  }
  if (path === '/v1/embeddings') {
    return JSON.stringify(
      { model: 'text-embedding-3-small', input: ['hello world'] },
      null,
      2,
    );
  }
  if (path === '/v1/rerank') {
    return JSON.stringify(
      {
        model: 'rerank-2',
        query: 'best option',
        documents: ['Option A', 'Option B'],
      },
      null,
      2,
    );
  }
  if (path === '/v1/agents/runs') {
    return JSON.stringify(
      { agent: 'default', input: { prompt: 'Summarize current status' } },
      null,
      2,
    );
  }
  if (path === '/v1/skills/mcp/call') {
    return JSON.stringify({ name: 'echo', arguments: { text: 'hello' } }, null, 2);
  }
  if (path === '/mcp/resources/read') {
    return JSON.stringify({ uri: 'file:///tmp/example.txt' }, null, 2);
  }
  return JSON.stringify({}, null, 2);
}

export function CapabilityPanel({
  endpointPath,
  baseUrl,
  adminKey,
}: CapabilityPanelProps) {
  if (!endpointPath) {
    return (
      <div className="rounded-lg border border-opta-border bg-opta-surface/20 p-4 text-sm text-text-muted">
        Select a capability to inspect and run.
      </div>
    );
  }

  const method = inferMethod(endpointPath);
  const payload = inferPayload(endpointPath);
  const endpointUrl = baseUrl ? `${baseUrl}${endpointPath}` : endpointPath;
  const retryCommand = `${method} ${endpointUrl}`;

  return (
    <div className="space-y-3">
      <CopyableValue label="Endpoint" value={endpointPath} mono />
      <CopyableValue label="Retry Template" value={retryCommand} mono />
      <p className="text-xs text-text-muted">
        Run now to execute this operation with the prepared payload.
      </p>
      <CapabilityRunCard
        endpointPath={endpointPath}
        method={method}
        baseUrl={baseUrl}
        adminKey={adminKey}
        defaultPayload={payload}
      />
    </div>
  );
}
