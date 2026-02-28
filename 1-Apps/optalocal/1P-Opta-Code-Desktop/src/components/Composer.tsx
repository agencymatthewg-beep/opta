interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  isStreaming = false,
}: ComposerProps) {
  return (
    <footer className="composer-shell">
      <textarea
        className="composer-input"
        placeholder={
          disabled
            ? "Select or create a session to start..."
            : isStreaming
              ? "Agent is running — cancel to interrupt..."
              : "Ask Opta Code to run, investigate, or implement..."
        }
        value={value}
        disabled={disabled || isStreaming}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (!isStreaming) onSubmit();
          }
        }}
      />
      <div className="composer-actions">
        <span>
          {isStreaming ? "Agent running…" : "Cmd/Ctrl + Enter to submit"}
        </span>
        {isStreaming ? (
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
          >
            ✕ Cancel
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || !value.trim()}
            onClick={onSubmit}
          >
            Dispatch
          </button>
        )}
      </div>
    </footer>
  );
}
