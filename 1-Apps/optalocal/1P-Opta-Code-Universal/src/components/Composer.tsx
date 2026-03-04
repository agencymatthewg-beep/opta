import { useState, useRef, useEffect } from "react";
import { Mic, Square, Activity } from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import type {
  SessionAutonomyMode,
  SessionOutputFormat,
  SessionSubmitMode,
  SessionTurnOverrides,
  TimelineItem,
} from "../types";

interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (overrides?: SessionTurnOverrides) => void;
  onCancel?: () => void;
  onDictate?: (audioBase64: string, autoSubmit?: boolean) => Promise<void>;
  disabled?: boolean;
  isStreaming?: boolean;
  mode: SessionSubmitMode;
  onModeChange: (mode: SessionSubmitMode) => void;
  timelineItems?: TimelineItem[];
  onTts?: (text: string) => Promise<string | undefined>;
}

const MODES: SessionSubmitMode[] = ["chat", "do", "plan", "review", "research"];

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

export function Composer({
  value,
  onChange,
  onSubmit,
  onCancel,
  onDictate,
  disabled,
  isStreaming = false,
  mode,
  onModeChange,
  timelineItems,
  onTts,
}: ComposerProps) {
  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBase64,
    setAudioBase64,
    error,
    playAudioBase64,
    continuousMode,
    setContinuousMode,
  } = useAudioRecorder();

  useEffect(() => {
    if (audioBase64 && onDictate) {
      const base64 = audioBase64;
      setAudioBase64(null);
      onDictate(base64, continuousMode).catch(console.error);
    }
  }, [audioBase64, onDictate, setAudioBase64, continuousMode]);

  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    let isMounted = true;
    if (continuousMode && prevStreamingRef.current && !isStreaming) {
      // Message finished streaming
      if (timelineItems && timelineItems.length > 0) {
        // Look for the last assistant response
        const assistantItems = timelineItems.filter((i) => i.kind === "assistant" && i.body);
        const lastItem = assistantItems[assistantItems.length - 1];
        if (lastItem && lastItem.body && onTts) {
          onTts(lastItem.body).then((base64) => {
            if (isMounted && base64) playAudioBase64(base64);
          });
        }
      }
    }
    prevStreamingRef.current = isStreaming;
    return () => {
      isMounted = false;
    };
  }, [isStreaming, continuousMode, timelineItems, onTts, playAudioBase64]);

  const [modelOverride, setModelOverride] = useState<string | undefined>(undefined);
  const [providerOverride, setProviderOverride] = useState<string | undefined>(undefined);
  const [autonomyModeOverride, setAutonomyModeOverride] = useState<SessionAutonomyMode | undefined>(undefined);
  const [autonomyLevelOverride, setAutonomyLevelOverride] = useState<number | undefined>(undefined);
  const [dangerousMode, setDangerousMode] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [noCommit, setNoCommit] = useState(false);
  const [noCheckpoints, setNoCheckpoints] = useState(false);
  const [formatOverride, setFormatOverride] = useState<SessionOutputFormat | undefined>(undefined);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // Close mode dropdown on outside click
  useEffect(() => {
    if (!showModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showModeMenu]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [value]);

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
    const hasAnyOverride = Object.values(overrides).some((v) => v !== undefined);
    return hasAnyOverride ? overrides : undefined;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isStreaming) onSubmit(buildOverrides());
    }
    // Close mode menu on escape
    if (e.key === "Escape" && showModeMenu) {
      setShowModeMenu(false);
    }
  };

  const handleSubmitClick = () => {
    if (!isStreaming) onSubmit(buildOverrides());
  };

  const hasActiveOverride = !!(modelOverride || providerOverride || autonomyModeOverride ||
    autonomyLevelOverride || dangerousMode || autoMode || noCommit || noCheckpoints || formatOverride);

  return (
    <footer className="r9-composer">
      {/* Main glass input box */}
      <div className={`r9-composer-box ${disabled ? "r9-composer-disabled" : ""}`}>
        {/* Top row: Mode badge + Advanced toggle */}
        <div className="r9-composer-topbar">
          {/* Mode badge — inline, matches redesign-9 */}
          <div className="r9-mode-badge-wrap" ref={modeMenuRef}>
            <button
              type="button"
              className="r9-mode-badge"
              onClick={() => setShowModeMenu((p) => !p)}
              title="Change execution mode"
              disabled={disabled}
            >
              <span className="r9-mode-dot" data-mode={mode} />
              <span className="r9-mode-label">
                Mode: <strong>{mode.charAt(0).toUpperCase() + mode.slice(1)}</strong>
              </span>
              <span className="r9-mode-caret">▾</span>
            </button>
            {showModeMenu && (
              <div className="r9-mode-menu">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`r9-mode-menu-item ${mode === m ? "r9-mode-menu-active" : ""}`}
                    onClick={() => { onModeChange(m); setShowModeMenu(false); }}
                  >
                    <span className="r9-mode-dot" data-mode={m} />
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`r9-advanced-toggle ${continuousMode ? "r9-advanced-active text-green-400" : ""}`}
              onClick={() => setContinuousMode(!continuousMode)}
              title="Toggle continuous voice mode (Walkie-Talkie)"
              disabled={disabled}
            >
              <Activity size={14} className="mr-1 inline" />
              Voice Mode
            </button>
            {/* Advanced overrides toggle */}
            <button
              type="button"
              className={`r9-advanced-toggle ${showAdvanced ? "r9-advanced-active" : ""} ${hasActiveOverride ? "r9-override-active" : ""}`}
              onClick={() => setShowAdvanced((p) => !p)}
              title="Override model, provider, autonomy"
              disabled={disabled}
            >
              {hasActiveOverride ? "● Overrides" : "Overrides"}
              <span className="r9-mode-caret">▾</span>
            </button>
          </div>
        </div>

        {/* Collapsed advanced panel */}
        {showAdvanced && (
          <div className="r9-advanced-panel">
            <div className="r9-adv-row">
              <select
                className="r9-adv-select"
                value={modelOverride ?? ""}
                onChange={(e) => setModelOverride(e.target.value || undefined)}
                title="Override model"
              >
                <option value="">Default Model</option>
                <option value="claude-3-5-sonnet">claude-3-5-sonnet (Cloud)</option>
                <option value="gpt-4o">gpt-4o (Cloud)</option>
              </select>
              <select
                className="r9-adv-select"
                value={providerOverride ?? ""}
                onChange={(e) => setProviderOverride(e.target.value || undefined)}
                title="Override provider"
              >
                <option value="">Default Provider</option>
                <option value="lmx">LMX (Local)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="openai">OpenAI / Codex / Minimax</option>
                <option value="opencode_zen">OpenCode Zen</option>
              </select>
              <select
                className="r9-adv-select"
                value={autonomyModeOverride ?? ""}
                onChange={(e) => setAutonomyModeOverride((e.target.value as SessionAutonomyMode | "") || undefined)}
                title="Override autonomy mode"
              >
                <option value="">Autonomy: Default</option>
                <option value="execution">Autonomy: Execution</option>
                <option value="ceo">Autonomy: CEO</option>
              </select>
              <select
                className="r9-adv-select"
                value={autonomyLevelOverride?.toString() ?? ""}
                onChange={(e) => { const v = e.target.value.trim(); setAutonomyLevelOverride(v ? Number(v) : undefined); }}
                title="Override autonomy level"
              >
                <option value="">Level: Default</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
              </select>
              <select
                className="r9-adv-select"
                value={formatOverride ?? ""}
                onChange={(e) => setFormatOverride((e.target.value as SessionOutputFormat | "") || undefined)}
                title="Override output format"
              >
                <option value="">Output: Adaptive</option>
                <option value="markdown">Output: Markdown</option>
                <option value="text">Output: Plain Text</option>
                <option value="json">Output: JSON</option>
              </select>
            </div>
            <div className="r9-adv-flags">
              {([
                [autoMode, setAutoMode, "Auto (skip edit approvals)"],
                [noCommit, setNoCommit, "No Commit"],
                [noCheckpoints, setNoCheckpoints, "No Checkpoints"],
                [dangerousMode, setDangerousMode, "⚡ L4 Autonomy"],
              ] as [boolean, (v: boolean) => void, string][]).map(([val, setter, label]) => (
                <button
                  key={label}
                  type="button"
                  className={`r9-adv-flag ${val ? "r9-adv-flag-active" : ""} ${label.startsWith("⚡") && val ? "r9-adv-flag-danger" : ""}`}
                  onClick={() => setter(!val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea + send button */}
        <div className="r9-composer-input-row">
          <textarea
            ref={textareaRef}
            className="r9-composer-textarea"
            placeholder={
              disabled
                ? "Select or create a session to start..."
                : isStreaming
                  ? "Agent is running — Cmd+Enter or cancel to interrupt..."
                  : placeholderByMode[mode]
            }
            value={value}
            disabled={disabled || isStreaming}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <div className="r9-composer-actions">
            {!isStreaming && (
              <button
                type="button"
                className={`r9-mic-btn ${isRecording ? "r9-mic-recording" : ""}`}
                disabled={disabled}
                onMouseDown={continuousMode ? startRecording : undefined}
                onMouseUp={continuousMode ? stopRecording : undefined}
                onMouseLeave={continuousMode ? stopRecording : undefined}
                onClick={!continuousMode ? (isRecording ? stopRecording : startRecording) : undefined}
                title={continuousMode ? "Hold to speak" : (isRecording ? "Stop recording" : "Dictate")}
              >
                {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
              </button>
            )}
            {isStreaming ? (
              <button
                type="button"
                className="r9-send-btn r9-send-cancel"
                onClick={onCancel}
                title="Cancel operation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="r9-send-btn"
                disabled={disabled || !value.trim()}
                onClick={handleSubmitClick}
                title={`${actionLabelByMode[mode]} (Cmd+Enter)`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
