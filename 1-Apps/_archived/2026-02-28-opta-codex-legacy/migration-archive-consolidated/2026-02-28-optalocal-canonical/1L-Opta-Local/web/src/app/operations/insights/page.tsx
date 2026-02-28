'use client';

import { useMemo, useState } from 'react';

import { CodexActionLine } from '@/components/shared/CodexActionLine';
import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';
import {
  computeEffectivenessMetrics,
  type CapabilityExecutionRecord,
} from '@/lib/learning/effectiveness-metrics';

const SAMPLE_RECORDS: CapabilityExecutionRecord[] = [
  {
    capability: '/v1/responses',
    status: 'success',
    durationMs: 880,
    retryCount: 0,
  },
  {
    capability: '/v1/responses',
    status: 'failed',
    durationMs: 1020,
    retryCount: 1,
    failureSignature: 'timeout',
  },
  {
    capability: '/v1/responses',
    status: 'failed',
    durationMs: 970,
    retryCount: 1,
    failureSignature: 'timeout',
  },
  {
    capability: '/v1/skills/echo/execute',
    status: 'success',
    durationMs: 330,
    retryCount: 0,
  },
];

export default function OperationsInsightsPage() {
  const [rawInput, setRawInput] = useState(
    JSON.stringify(SAMPLE_RECORDS, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const parsedRecords = useMemo(() => {
    try {
      const parsed = JSON.parse(rawInput) as CapabilityExecutionRecord[];
      if (!Array.isArray(parsed)) {
        throw new Error('Input must be an array');
      }
      setParseError(null);
      return parsed;
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid JSON input');
      return [];
    }
  }, [rawInput]);

  const metrics = useMemo(
    () => computeEffectivenessMetrics(parsedRecords),
    [parsedRecords],
  );

  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Operations Insights"
        subtitle="Self-awareness metrics: success rate, retries, MTTR, recurring failures."
      >
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          Paste capability run records to evaluate what has been working and what has
          not.
        </p>
      </CodexDenseSurface>

      <CodexDenseSurface title="Input Records" subtitle="Capability execution log JSON.">
        <textarea
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          className="h-56 w-full rounded border border-opta-border bg-opta-surface/30 p-2 font-mono text-xs"
        />
        <CodexActionLine
          primaryLabel="Recompute Metrics"
          onPrimary={() => undefined}
          secondary={
            <span className="codex-kv-label">
              Records: {parsedRecords.length}
            </span>
          }
        />
        {parseError ? (
          <p style={{ color: 'var(--danger)', margin: 0 }}>{parseError}</p>
        ) : null}
      </CodexDenseSurface>

      <CodexDenseSurface title="Metrics" subtitle="Per-capability effectiveness report.">
        <pre data-testid="effectiveness-metrics-panel" className="max-h-80 overflow-auto rounded border border-opta-border bg-opta-surface/30 p-2 text-xs">
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </CodexDenseSurface>
    </main>
  );
}
