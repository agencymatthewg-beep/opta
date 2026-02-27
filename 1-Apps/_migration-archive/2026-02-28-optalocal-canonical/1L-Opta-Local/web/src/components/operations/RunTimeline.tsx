import type { OrchestratedRun } from '@/lib/orchestrator/run-orchestrator';

interface RunTimelineProps {
  run: OrchestratedRun;
}

export function RunTimeline({ run }: RunTimelineProps) {
  return (
    <section className="rounded border border-opta-border bg-opta-surface/20 p-3">
      <h3 className="mb-1 text-xs uppercase tracking-[0.12em] text-text-muted">
        Run Timeline
      </h3>
      <p className="mb-2 text-xs text-text-secondary">
        <span className="font-mono">{run.id}</span> · {run.capability}
      </p>

      {run.transitions.length === 0 ? (
        <p className="text-xs text-text-muted">No transitions recorded.</p>
      ) : (
        <ol className="space-y-1">
          {run.transitions.map((transition, index) => (
            <li
              key={`${transition.from}-${transition.to}-${transition.at}-${index}`}
              className="rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-xs"
            >
              <span className="font-mono">{transition.from}</span>
              {' -> '}
              <span className="font-mono">{transition.to}</span>
              {' at '}
              <span>{new Date(transition.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

