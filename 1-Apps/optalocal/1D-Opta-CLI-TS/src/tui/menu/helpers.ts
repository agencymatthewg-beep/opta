import type { GuidedFlowKind, StudioConnectivityState } from './types.js';

export function labelWithState(base: string, enabled: boolean): string {
  return `${base} (${enabled ? 'on' : 'off'})`;
}

export function connectivityLabel(state: StudioConnectivityState): string {
  if (state === 'reachable') return 'reachable';
  if (state === 'unreachable') return 'unreachable';
  if (state === 'local') return 'local-only';
  return 'checking';
}

export function autonomyLabel(level: number, mode: 'execution' | 'ceo'): string {
  return `L${level}/5 · profile ${mode}`;
}

export function autonomySlider(levelInput: number): string {
  const level = Math.min(5, Math.max(1, Math.floor(levelInput)));
  return `[${'■'.repeat(level)}${'□'.repeat(5 - level)}]`;
}

export function guidedFlowPrompt(kind: GuidedFlowKind): { title: string; placeholder: string; destructive: boolean } {
  if (kind === 'agent-status') {
    return { title: 'Agent run status', placeholder: 'Enter run id (e.g. run_abc123)', destructive: false };
  }
  if (kind === 'agent-start') {
    return { title: 'Start agent run', placeholder: 'Enter prompt text', destructive: false };
  }
  if (kind === 'agent-events') {
    return { title: 'Agent run events', placeholder: 'Enter run id (e.g. run_abc123)', destructive: false };
  }
  if (kind === 'agent-cancel') {
    return { title: 'Cancel agent run', placeholder: 'Enter run id to cancel', destructive: true };
  }
  if (kind === 'skill-show') {
    return { title: 'Skill detail', placeholder: 'Enter skill name/reference', destructive: false };
  }
  if (kind === 'skill-run') {
    return { title: 'Run skill', placeholder: 'Enter skill name (e.g. ai26-3c-productivity-writing-plans)', destructive: false };
  }
  if (kind === 'skill-mcp-call') {
    return { title: 'Call MCP tool', placeholder: 'Enter MCP tool name (e.g. linear.search_issues)', destructive: true };
  }
  if (kind === 'skill-openclaw') {
    return { title: 'Invoke OpenClaw tool', placeholder: 'Enter OpenClaw tool name', destructive: true };
  }
  if (kind === 'quantize-status') {
    return { title: 'Quantize job status', placeholder: 'Enter quantize job id', destructive: false };
  }
  if (kind === 'rag-query') {
    return { title: 'RAG query', placeholder: 'Enter: collection | query text', destructive: false };
  }
  if (kind === 'rag-ingest-file') {
    return { title: 'RAG ingest (file path)', placeholder: 'Enter: collection | /path/to/text-file', destructive: false };
  }
  if (kind === 'rag-context') {
    return { title: 'RAG context', placeholder: 'Enter: query text | collection1,collection2', destructive: false };
  }
  return { title: 'Delete RAG collection', placeholder: 'Enter collection name to delete', destructive: true };
}

export function quoteCliArg(value: string): string {
  return JSON.stringify(value);
}

export function parseGuidedPair(value: string): { first: string; second: string } | null {
  const delimiterIndex = value.indexOf('|');
  if (delimiterIndex < 0) return null;
  const first = value.slice(0, delimiterIndex).trim();
  const second = value.slice(delimiterIndex + 1).trim();
  if (!first || !second) return null;
  return { first, second };
}

export function buildGuidedCommand(kind: GuidedFlowKind, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (kind === 'agent-status') return `/agents status ${trimmed}`;
  if (kind === 'agent-start') return `/agents start --prompt ${quoteCliArg(trimmed)}`;
  if (kind === 'agent-events') return `/agents events ${trimmed}`;
  if (kind === 'agent-cancel') return `/agents cancel ${trimmed}`;
  if (kind === 'skill-show') return `/lmx-skills show ${trimmed}`;
  if (kind === 'skill-run') return `/lmx-skills run ${trimmed}`;
  if (kind === 'skill-mcp-call') return `/lmx-skills mcp-call ${trimmed}`;
  if (kind === 'skill-openclaw') return `/lmx-skills openclaw ${trimmed}`;
  if (kind === 'quantize-status') return `/quantize status ${trimmed}`;
  if (kind === 'rag-query') {
    const pair = parseGuidedPair(trimmed);
    if (!pair) return null;
    return `/rag query ${pair.first} ${quoteCliArg(pair.second)}`;
  }
  if (kind === 'rag-ingest-file') {
    const pair = parseGuidedPair(trimmed);
    if (!pair) return null;
    return `/rag ingest ${pair.first} --file ${quoteCliArg(pair.second)}`;
  }
  if (kind === 'rag-context') {
    const pair = parseGuidedPair(trimmed);
    if (!pair) return null;
    const collections = pair.second
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(',');
    if (!collections) return null;
    return `/rag context ${quoteCliArg(pair.first)} --collections ${collections}`;
  }
  if (kind === 'rag-delete') return `/rag delete ${trimmed}`;
  return null;
}
