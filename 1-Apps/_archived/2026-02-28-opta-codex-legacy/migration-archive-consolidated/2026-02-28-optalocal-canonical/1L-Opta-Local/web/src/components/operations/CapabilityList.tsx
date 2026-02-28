import { cn } from '@opta/ui';

interface CapabilityListProps {
  capabilities: string[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function CapabilityList({
  capabilities,
  selectedPath,
  onSelect,
}: CapabilityListProps) {
  if (capabilities.length === 0) {
    return (
      <div className="rounded-lg border border-opta-border bg-opta-surface/30 p-4 text-sm text-text-muted">
        No unmatched capabilities found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-opta-border bg-opta-surface/20">
      <div className="border-b border-opta-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
        LMX Not In Dashboard ({capabilities.length})
      </div>
      <div className="max-h-[70vh] overflow-auto p-2">
        {capabilities.map((path) => {
          const active = selectedPath === path;
          return (
            <button
              key={path}
              type="button"
              data-testid="operation-item"
              onClick={() => onSelect(path)}
              className={cn(
                'mb-1 w-full rounded-md border px-2 py-2 text-left text-xs font-mono',
                active
                  ? 'border-primary/50 bg-primary/10 text-text-primary'
                  : 'border-transparent bg-opta-surface/40 text-text-secondary hover:border-opta-border hover:text-text-primary',
              )}
            >
              {path}
            </button>
          );
        })}
      </div>
    </div>
  );
}

