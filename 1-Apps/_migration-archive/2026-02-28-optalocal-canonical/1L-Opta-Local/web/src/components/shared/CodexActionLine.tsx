import type { ReactNode } from 'react';

interface CodexActionLineProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondary?: ReactNode;
}

export function CodexActionLine({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondary,
}: CodexActionLineProps) {
  return (
    <div className="codex-action-line">
      <button
        type="button"
        className="codex-primary-btn"
        onClick={onPrimary}
        disabled={primaryDisabled}
      >
        {primaryLabel}
      </button>
      {secondary ? <div className="codex-secondary-actions">{secondary}</div> : null}
    </div>
  );
}

