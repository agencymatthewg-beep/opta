import { useState } from "react";
import type {
  SessionAutonomyMode,
  SessionOutputFormat,
  SessionSubmitMode,
  SessionTurnOverrides,
} from "../types";

interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (overrides?: SessionTurnOverrides) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  mode: SessionSubmitMode;
  onModeChange: (mode: SessionSubmitMode) => void;
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
  const [modelOverride, setModelOverride] = useState<string | undefined>(
    undefined,
  );
  const [providerOverride, setProviderOverride] = useState<string | undefined>(
    undefined,
  );
  const [autonomyModeOverride, setAutonomyModeOverride] = useState<
    SessionAutonomyMode | undefined
  >(undefined);
  const [autonomyLevelOverride, setAutonomyLevelOverride] = useState<
    number | undefined
  >(undefined);
  const [dangerousMode, setDangerousMode] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [noCommit, setNoCommit] = useState(false);
  const [noCheckpoints, setNoCheckpoints] = useState(false);
  const [formatOverride, setFormatOverride] = useState<
    SessionOutputFormat | undefined
  >(undefined);
  const [showModeSelect, setShowModeSelect] = useState(false);

  const placeholderByMode: Record<SessionSubmitMode, string> = {
    chat: "Ask Opta Code to investigate, explain, or implement...",
    do: "Describe a task for Opta to execute autonomously...",
    plan: "Describe the objective and constraints for a plan...",
    review: "Paste code/diff context and request a structured review...",
    research: "Ask for research synthesis with sources and evidence...",
  };

  const actionLabelByMode: Record<SessionSubmitMode, string> = {
    chat: "Send",
    do: "Run",
    plan: "Plan",
    review: "Review",
    research: "Research",
  };

  const buildOverrides = (): SessionTurnOverrides | undefined => {
    const overrides: SessionTurnOverrides = {
      model: modelOverride,
      provider: providerOverride,
      dangerous: dangerousMode ? true : undefined,
      auto: autoMode ? true : undefined,
      noCommit: noCommit ? true : undefined,
      noCheckpoints: noCheckpoints ? true : undefined,
      format: formatOverride,
      autonomyMode: autonomyModeOverride,
      autonomyLevel: autonomyLevelOverride,
    };

    const hasAnyOverride = Object.values(overrides).some(
      (value) => value !== undefined,
    );
    return hasAnyOverride ? overrides : undefined;
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!isStreaming) {
        onSubmit(buildOverrides());
      }
    }
  };

  const handleSubmitClick = () => {
    if (!isStreaming) {
      onSubmit(buildOverrides());
    }
  };

  return (
    <footer className="composer-shell composer-stack">
      <div className="settings-bar">
        <div
          className="pill-dropdown"
          onClick={() => setShowModeSelect(!showModeSelect)}
          title="Change execution mode"
        >
          Mode:{" "}
          <span
            style={{ color: "var(--text-pri)", textTransform: "capitalize" }}
          >
            {mode}
          </span>{" "}
          ▾
          {showModeSelect && (
            <div className="pill-menu-popup">
              {["chat", "do", "plan", "review", "research"].map((m) => (
                <div
                  key={m}
                  className={`pill-menu-item ${mode === m ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeChange(m as SessionSubmitMode);
                    setShowModeSelect(false);
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`pill-dropdown ${modelOverride ? "active" : ""}`}>
          <select
            value={modelOverride ?? ""}
            onChange={(e) => setModelOverride(e.target.value || undefined)}
            className="pill-select"
            title="Override the default model for this turn"
          >
            <option value="">Default Model</option>
            <option value="claude-3-5-sonnet">claude-3-5-sonnet (Cloud)</option>
            <option value="gpt-4o">gpt-4o (Cloud)</option>
          </select>
        </div>

        <div className={`pill-dropdown ${providerOverride ? "active" : ""}`}>
          <select
            value={providerOverride ?? ""}
            onChange={(e) => setProviderOverride(e.target.value || undefined)}
            className="pill-select"
            title="Override provider for this turn"
          >
            <option value="">Default Provider</option>
            <option value="lmx">LMX (Local)</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option disabled>── Custom ──</option>
            <option value="kimi">Kimi (Moonshot)</option>
            <option value="minimax">Minimax</option>
            <option value="deepseek">DeepSeek</option>
            <option value="litellm">LiteLLM Proxy (75+ Models)</option>
          </select>
        </div>

        <div
          className={`pill-dropdown ${autonomyModeOverride ? "active" : ""}`}
        >
          <select
            value={autonomyModeOverride ?? ""}
            onChange={(e) =>
              setAutonomyModeOverride(
                (e.target.value as SessionAutonomyMode | "") || undefined,
              )
            }
            className="pill-select"
            title="Override autonomy mode for this turn"
          >
            <option value="">Autonomy: Default</option>
            <option value="execution">Autonomy: Execution</option>
            <option value="ceo">Autonomy: CEO</option>
          </select>
        </div>

        <div
          className={`pill-dropdown ${autonomyLevelOverride ? "active" : ""}`}
        >
          <select
            value={autonomyLevelOverride?.toString() ?? ""}
            onChange={(e) => {
              const next = e.target.value.trim();
              setAutonomyLevelOverride(next ? Number(next) : undefined);
            }}
            className="pill-select"
            title="Override autonomy level (1-5) for this turn"
          >
            <option value="">Level: Default</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>
        </div>

        <div className={`pill-dropdown ${formatOverride ? "active" : ""}`}>
          <select
            value={formatOverride ?? ""}
            onChange={(e) =>
              setFormatOverride(
                (e.target.value as SessionOutputFormat | "") || undefined,
              )
            }
            className="pill-select"
            title="Adapt response format for this turn"
          >
            <option value="">Output: Adaptive</option>
            <option value="markdown">Output: Markdown</option>
            <option value="text">Output: Plain Text</option>
            <option value="json">Output: JSON</option>
          </select>
        </div>

        <div
          className={`pill-dropdown ${autoMode ? "active" : ""}`}
          onClick={() => setAutoMode(!autoMode)}
          title="Auto mode: skip manual edit approvals for this turn"
        >
          Auto
        </div>

        <div
          className={`pill-dropdown ${noCommit ? "active" : ""}`}
          onClick={() => setNoCommit(!noCommit)}
          title="Disable auto-commit for this turn"
        >
          No Commit
        </div>

        <div
          className={`pill-dropdown ${noCheckpoints ? "active" : ""}`}
          onClick={() => setNoCheckpoints(!noCheckpoints)}
          title="Disable checkpoints for this turn"
        >
          No Checkpoints
        </div>

        <div
          className={`pill-dropdown ${dangerousMode ? "danger" : ""}`}
          onClick={() => setDangerousMode(!dangerousMode)}
          title="L4 Autonomy: Bypass tool permission prompts"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          L4 Autonomy
        </div>
      </div>

      <div className="composer-bar">
        <textarea
          className="composer-input"
          placeholder={
            disabled
              ? "Select or create a session to start..."
              : isStreaming
                ? "Agent is running — cancel to interrupt..."
                : placeholderByMode[mode]
          }
          value={value}
          disabled={disabled || isStreaming}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        {isStreaming ? (
          <button
            type="button"
            className="send-btn btn-cancel"
            onClick={onCancel}
            title="Cancel operation"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            disabled={disabled || !value.trim()}
            onClick={handleSubmitClick}
            title={`${actionLabelByMode[mode]} (Cmd+Enter)`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        )}
      </div>
    </footer>
  );
}
