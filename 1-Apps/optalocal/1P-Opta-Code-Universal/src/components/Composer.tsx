interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  mode: "chat" | "do";
  onModeChange: (mode: "chat" | "do") => void;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  isStreaming = false,
  mode,
  onModeChange,
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
              : mode === "do"
                ? "Describe a task for Opta to execute autonomously..."
                : "Ask Opta Code to investigate, explain, or implement..."
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
        <div className="mode-toggle" role="group" aria-label="Submission mode">
          <button
            type="button"
            className={`mode-btn ${mode === "chat" ? "active" : ""}`}
            onClick={() => onModeChange("chat")}
            disabled={isStreaming}
            title="Chat mode — conversational, requires tool approval"
          >
            Chat
          </button>
          <button
            type="button"
            className={`mode-btn mode-btn-do ${mode === "do" ? "active" : ""}`}
            onClick={() => onModeChange("do")}
            disabled={isStreaming}
            title="Do mode — agentic, auto-approves safe tools"
          >
            Do
          </button>
        </div>

        <span className="composer-hint">
          {isStreaming
            ? mode === "do"
              ? "Agent running autonomously…"
              : "Agent running…"
            : "Cmd/Ctrl + Enter"}
        </span>

        {isStreaming ? (
          <button type="button" className="btn-cancel" onClick={onCancel}>
            ✕ Cancel
          </button>
        ) : (
          <button
            type="button"
            className={mode === "do" ? "btn-dispatch-do" : ""}
            disabled={disabled || !value.trim()}
            onClick={onSubmit}
          >
            {mode === "do" ? "Run" : "Send"}
          </button>
        )}
      </div>
    </footer>
  );
}
