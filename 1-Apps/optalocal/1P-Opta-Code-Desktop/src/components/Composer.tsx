interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
}: ComposerProps) {
  return (
    <footer className="composer-shell">
      <textarea
        className="composer-input"
        placeholder={
          disabled
            ? "Select or create a session to start..."
            : "Ask Opta Code to run, investigate, or implement..."
        }
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="composer-actions">
        <span>Cmd/Ctrl + Enter to submit</span>
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
        >
          Dispatch
        </button>
      </div>
    </footer>
  );
}
