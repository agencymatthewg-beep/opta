import { useCallback } from 'react';

interface CopyableValueProps {
  label: string;
  value: string;
  mono?: boolean;
  testId?: string;
  copyLabel?: string;
}

export function CopyableValue({
  label,
  value,
  mono = false,
  testId,
  copyLabel = 'Copy',
}: CopyableValueProps) {
  const copy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
  }, [value]);

  return (
    <div className="rounded border border-opta-border bg-opta-surface/30 p-2">
      <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          data-testid={testId}
          className={`${mono ? 'font-mono' : ''} min-w-0 flex-1 break-all text-xs text-text-primary`.trim()}
        >
          {value}
        </span>
        <button
          type="button"
          className="rounded border border-opta-border px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
          onClick={() => void copy()}
        >
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
