import { useCallback, useMemo } from 'react';

interface CodexKeyValueProps {
  label: string;
  value: string | number | boolean | null | undefined;
  mono?: boolean;
  copyable?: boolean;
  testId?: string;
}

export function CodexKeyValue({
  label,
  value,
  mono = false,
  copyable = true,
  testId,
}: CodexKeyValueProps) {
  const display = useMemo(() => {
    if (value == null) return '-';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }, [value]);

  const copyValue = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(display);
  }, [display]);

  return (
    <div className="codex-kv-row">
      <span className="codex-kv-label">{label}</span>
      <div className="codex-kv-value-wrap">
        <span
          data-testid={testId}
          className={`codex-kv-value ${mono ? 'codex-kv-mono' : ''}`.trim()}
        >
          {display}
        </span>
        {copyable ? (
          <button
            type="button"
            className="codex-copy-btn"
            onClick={() => void copyValue()}
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

