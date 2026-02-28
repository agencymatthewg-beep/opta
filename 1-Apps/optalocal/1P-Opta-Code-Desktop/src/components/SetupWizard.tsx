import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Tauri invoke bridge — same pattern used by secureConnectionStore.ts
// ---------------------------------------------------------------------------
type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriBridge {
  core?: { invoke?: TauriInvoke };
}

function getTauriInvoke(): TauriInvoke | null {
  const bridge = (globalThis as { __TAURI__?: TauriBridge }).__TAURI__;
  const fn_ = bridge?.core?.invoke;
  return typeof fn_ === "function" ? fn_ : null;
}

async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri invoke not available");
  return invoke(command, args) as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WizardFormData {
  provider: "lmx" | "anthropic";
  lmxHost: string;
  lmxPort: number;
  anthropicKey: string;
  configDir: string;
  autonomyLevel: 1 | 2 | 3;
  shell: "auto" | "bash" | "zsh" | "powershell";
  tuiDefault: boolean;
}

interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

interface LmxProbeResult {
  reachable: boolean;
  version?: string;
  model_count?: number;
  status?: string;
}

export interface SetupWizardProps {
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens (mirrors opta-setup-wizard.html :root)
// ---------------------------------------------------------------------------
const T = {
  void: "#09090b",
  surface: "#0f0f11",
  elevated: "#18181b",
  raised: "#222226",
  border: "rgba(255,255,255,0.07)",
  borderSoft: "rgba(255,255,255,0.04)",
  primary: "#8b5cf6",
  primaryBright: "#a78bfa",
  primaryDim: "rgba(139,92,246,0.12)",
  primaryGlow: "rgba(139,92,246,0.22)",
  text1: "#f4f4f5",
  text2: "#a1a1aa",
  text3: "#52525b",
  text4: "#3f3f46",
  ok: "#22c55e",
  okGlow: "rgba(34,197,94,0.18)",
  fail: "#ef4444",
  failGlow: "rgba(239,68,68,0.18)",
  warn: "#f59e0b",
} as const;

// ---------------------------------------------------------------------------
// Inject keyframes once
// ---------------------------------------------------------------------------
const STYLE_ID = "opta-wizard-keyframes";
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes opta-rise {
      from { opacity: 0; transform: translateY(28px) scale(0.975); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes opta-blink {
      0%,100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.4; transform: scale(0.65); }
    }
    @keyframes opta-slide-in-right {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes opta-slide-in-left {
      from { opacity: 0; transform: translateX(-40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Step indicator dots
function StepDots({ step, total }: { step: number; total: number }) {
  const items: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const isDone = i < step;
    const isNow = i === step;
    items.push(
      <div
        key={`dot-${i}`}
        style={{
          width: isNow ? 22 : 7,
          height: 7,
          borderRadius: isNow ? 3.5 : "50%",
          background: isDone || isNow
            ? isNow ? T.primaryBright : T.primary
            : T.text4,
          border: `1px solid ${isDone || isNow ? (isNow ? T.primaryBright : T.primary) : T.border}`,
          boxShadow: isNow
            ? "0 0 10px rgba(167,139,250,0.45)"
            : isDone
              ? `0 0 7px ${T.primaryGlow}`
              : "none",
          transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)",
          flexShrink: 0,
        }}
      />,
    );
    if (i < total - 1) {
      items.push(
        <div
          key={`line-${i}`}
          style={{
            height: 1,
            flex: 1,
            background: i < step ? "rgba(139,92,246,0.35)" : T.border,
            margin: "0 5px",
            transition: "background 0.4s",
          }}
        />,
      );
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
      {items}
    </div>
  );
}

// Segmented control
type SegOption<T extends string> = { value: T; label: string };

function SegControl<T extends string>({
  options,
  value,
  onChange,
  violet,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  violet?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(0,0,0,0.22)",
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const isOn = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 11.5,
              fontWeight: 500,
              flex: 1,
              background: isOn
                ? violet
                  ? "rgba(139,92,246,0.14)"
                  : T.raised
                : "none",
              border: isOn
                ? `1px solid ${violet ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.1)"}`
                : "none",
              color: isOn
                ? violet
                  ? T.primaryBright
                  : T.text1
                : T.text3,
              padding: "6px 8px",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.18s",
              whiteSpace: "nowrap",
              boxShadow: isOn && !violet ? "0 1px 3px rgba(0,0,0,0.35)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Toggle switch
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onToggle(); }}
      style={{
        width: 38,
        height: 21,
        background: on ? T.primary : "rgba(255,255,255,0.09)",
        border: `1px solid ${on ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 11,
        position: "relative",
        cursor: "pointer",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
        boxShadow: on ? "0 0 10px rgba(139,92,246,0.3)" : "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 15,
          height: 15,
          background: "#fff",
          borderRadius: "50%",
          position: "absolute",
          top: 2,
          left: 2,
          transform: on ? "translateX(17px)" : "none",
          transition: "transform 0.22s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
}

// Mono label
function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9.5,
        fontWeight: 500,
        color: T.text3,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// Text input
function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  style: extraStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11.5,
        background: "rgba(0,0,0,0.28)",
        border: `1px solid ${focused ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.09)"}`,
        borderRadius: 8,
        color: T.text1,
        padding: "8px 11px",
        width: "100%",
        outline: "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.1)" : "none",
        ...extraStyle,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------
function StepWelcome() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 28 }}>
        <span
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            background: "linear-gradient(130deg, #fff 0%, #c4b5fd 60%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          OPTA
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: T.primaryBright,
            background: T.primaryDim,
            border: "1px solid rgba(139,92,246,0.22)",
            borderRadius: 5,
            padding: "3px 8px",
            letterSpacing: "0.07em",
          }}
        >
          CLI v0.5
        </span>
      </div>

      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.22,
          marginBottom: 12,
          color: T.text1,
        }}
      >
        Your local AI<br />coding assistant
      </h1>

      <p
        style={{
          fontSize: 13.5,
          color: T.text2,
          lineHeight: 1.65,
          maxWidth: 370,
        }}
      >
        Routes prompts through your own Mac Studio inference server — zero cloud
        latency, fully private. Takes about 90 seconds to configure.
      </p>

      <ul
        style={{
          marginTop: 26,
          display: "flex",
          flexDirection: "column",
          gap: 9,
          listStyle: "none",
          padding: 0,
        }}
      >
        {[
          "Agent tools — read, write, edit, search, run commands",
          "Persistent daemon with WebSocket streaming",
          "Full-screen TUI with session search & history",
        ].map((text) => (
          <li
            key={text}
            style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 12.5, color: T.text2 }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: T.primary,
                flexShrink: 0,
                boxShadow: `0 0 5px ${T.primary}`,
              }}
            />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Connection
// ---------------------------------------------------------------------------
type TestState = "idle" | "pinging" | "ok" | "fail";

function StepConnection({
  form,
  setForm,
}: {
  form: WizardFormData;
  setForm: React.Dispatch<React.SetStateAction<WizardFormData>>;
}) {
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [probeInfo, setProbeInfo] = useState<LmxProbeResult | null>(null);

  async function testConnection(e: React.MouseEvent) {
    e.stopPropagation();
    setTestState("pinging");
    setTestMsg("Connecting\u2026");
    setProbeInfo(null);

    try {
      const result = await tauriInvoke<ConnectionTestResult>(
        "test_lmx_connection",
        { host: form.lmxHost, port: form.lmxPort },
      );
      if (result.ok) {
        setTestState("ok");
        setTestMsg(`\u2713 ${result.message}`);
        // Auto-probe for server metadata after a successful TCP connection
        tauriInvoke<LmxProbeResult>("probe_lmx_server", {
          host: form.lmxHost,
          port: form.lmxPort,
        })
          .then((probe) => { if (probe.reachable) setProbeInfo(probe); })
          .catch(() => { /* probe is best-effort */ });
      } else {
        setTestState("fail");
        setTestMsg(`\u2717 ${result.message}`);
      }
    } catch {
      // Tauri not available (browser dev mode) — simulate
      await new Promise<void>((r) => setTimeout(r, 800));
      setTestState("ok");
      setTestMsg("\u2713 Simulated (dev mode)");
    }
  }

  const dotColor =
    testState === "ok" ? T.ok
    : testState === "fail" ? T.fail
    : testState === "pinging" ? T.warn
    : T.text4;

  const modeCard = (
    isSelected: boolean,
    onClick: () => void,
    title: React.ReactNode,
    desc: string,
    detail: React.ReactNode,
  ) => (
    <div
      onClick={onClick}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onClick(); }}
      style={{
        background: isSelected ? "rgba(139,92,246,0.06)" : T.elevated,
        border: `1.5px solid ${isSelected ? T.primary : T.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(139,92,246,0.18), inset 0 0 50px rgba(139,92,246,0.03)"
          : "none",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", color: T.text1 }}>
          {title}
        </div>
        {/* Radio */}
        <div
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            border: `1.5px solid ${isSelected ? T.primary : T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "border-color 0.2s",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: T.primary,
              opacity: isSelected ? 1 : 0,
              transform: isSelected ? "scale(1)" : "scale(0)",
              transition: "opacity 0.2s, transform 0.2s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.text3, marginBottom: isSelected ? 14 : 0 }}>{desc}</div>
      {isSelected && <div onClick={(e) => e.stopPropagation()}>{detail}</div>}
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 3, color: T.text1 }}>
        Choose a provider
      </h2>
      <p style={{ fontSize: 12.5, color: T.text2, marginBottom: 20 }}>
        Where Opta sends your prompts
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {/* LMX card */}
        {modeCard(
          form.provider === "lmx",
          () => setForm((f) => ({ ...f, provider: "lmx" })),
          <>
            Local LMX
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8.5,
                fontWeight: 500,
                color: T.primaryBright,
                background: T.primaryDim,
                border: "1px solid rgba(139,92,246,0.28)",
                borderRadius: 4,
                padding: "2px 7px",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
              }}
            >
              Recommended
            </span>
          </>,
          "Mac Studio inference — private, near-zero latency",
          <div>
            <MonoLabel>Host : Port</MonoLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TextInput
                value={`${form.lmxHost}:${form.lmxPort}`}
                onChange={(v) => {
                  const [h, p] = v.split(":");
                  setForm((f) => ({
                    ...f,
                    lmxHost: h ?? f.lmxHost,
                    lmxPort: p ? (Number.parseInt(p, 10) || f.lmxPort) : f.lmxPort,
                  }));
                }}
              />
              <button
                type="button"
                onClick={testConnection}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: T.text2,
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7,
                  padding: "7px 13px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.18s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dotColor,
                    boxShadow: testState === "ok"
                      ? `0 0 7px ${T.okGlow}`
                      : testState === "fail"
                        ? `0 0 7px ${T.failGlow}`
                        : "none",
                    animation: testState === "pinging" ? "opta-blink 0.7s ease-in-out infinite" : "none",
                    transition: "all 0.3s",
                    flexShrink: 0,
                  }}
                />
                Test
              </button>
            </div>
            {testMsg && (
              <div
                style={{
                  marginTop: 5,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: testState === "ok" ? T.ok : testState === "fail" ? T.fail : T.warn,
                  minHeight: 14,
                  transition: "color 0.2s",
                }}
              >
                {testMsg}
              </div>
            )}
            {/* LMX server metadata — shown after a successful probe */}
            {probeInfo && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {probeInfo.version && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: T.primaryBright,
                      background: T.primaryDim,
                      border: "1px solid rgba(139,92,246,0.22)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    v{probeInfo.version}
                  </span>
                )}
                {probeInfo.model_count !== undefined && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: T.ok,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.18)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {probeInfo.model_count} model{probeInfo.model_count !== 1 ? "s" : ""}
                  </span>
                )}
                {probeInfo.status && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: T.text2,
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {probeInfo.status}
                  </span>
                )}
              </div>
            )}
          </div>,
        )}

        {/* Cloud API card */}
        {modeCard(
          form.provider === "anthropic",
          () => setForm((f) => ({ ...f, provider: "anthropic" })),
          "Cloud API",
          "Anthropic API — no Mac Studio required",
          <div>
            <MonoLabel>Anthropic API Key</MonoLabel>
            <div style={{ position: "relative" }}>
              <TextInput
                value={form.anthropicKey}
                onChange={(v) => setForm((f) => ({ ...f, anthropicKey: v }))}
                placeholder="sk-ant-api03-\u2026"
                type={showKey ? "text" : "password"}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowKey((v) => !v)}
                style={{
                  position: "absolute",
                  right: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.text3,
                  display: "flex",
                  padding: 4,
                }}
              >
                {showKey ? (
                  /* eye-closed */
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  /* eye-open */
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>,
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Preferences
// ---------------------------------------------------------------------------
function StepPreferences({
  form,
  setForm,
}: {
  form: WizardFormData;
  setForm: React.Dispatch<React.SetStateAction<WizardFormData>>;
}) {
  const configDirRowRef = useRef<HTMLDivElement>(null);

  const prefGroup = (children: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>{children}</div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 3, color: T.text1 }}>
        Preferences
      </h2>
      <p style={{ fontSize: 12.5, color: T.text2, marginBottom: 20 }}>
        Tune Opta to your workflow
      </p>

      {/* Config dir */}
      {prefGroup(
        <>
          <MonoLabel>Config folder</MonoLabel>
          <div ref={configDirRowRef} style={{ display: "flex", gap: 7 }}>
            <TextInput
              value={form.configDir}
              onChange={(v) => setForm((f) => ({ ...f, configDir: v }))}
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const chosen = await tauriInvoke<string | null>("pick_folder");
                  if (chosen) {
                    setForm((f) => ({ ...f, configDir: chosen }));
                    return;
                  }
                } catch {
                  // Tauri not available or dialog cancelled — fall through to focus
                }
                const input = configDirRowRef.current?.querySelector<HTMLInputElement>("input");
                if (input) { input.focus(); input.select(); }
              }}
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 11.5,
                fontWeight: 600,
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: T.text2,
                borderRadius: 8,
                padding: "0 13px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.18s",
                flexShrink: 0,
              }}
            >
              Browse
            </button>
          </div>
        </>,
      )}

      {/* Autonomy level */}
      {prefGroup(
        <>
          <MonoLabel>Autonomy level</MonoLabel>
          <SegControl<"1" | "2" | "3">
            options={[
              { value: "1", label: "Supervised" },
              { value: "2", label: "Balanced" },
              { value: "3", label: "Autonomous" },
            ]}
            value={String(form.autonomyLevel) as "1" | "2" | "3"}
            onChange={(v) =>
              setForm((f) => ({ ...f, autonomyLevel: Number(v) as 1 | 2 | 3 }))
            }
            violet
          />
        </>,
      )}

      {/* Shell */}
      {prefGroup(
        <>
          <MonoLabel>Shell</MonoLabel>
          <SegControl<"auto" | "bash" | "zsh" | "powershell">
            options={[
              { value: "auto", label: "Auto-detect" },
              { value: "bash", label: "bash" },
              { value: "zsh", label: "zsh" },
              { value: "powershell", label: "PowerShell" },
            ]}
            value={form.shell}
            onChange={(v) => setForm((f) => ({ ...f, shell: v }))}
          />
        </>,
      )}

      {/* TUI toggle */}
      {prefGroup(
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, color: T.text1 }}>
              Enable TUI by default
            </div>
            <div style={{ fontSize: 11, color: T.text3 }}>
              Full-screen UI when running{" "}
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9.5,
                  background: "rgba(255,255,255,0.07)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  padding: "1px 5px",
                }}
              >
                opta chat
              </span>
            </div>
          </div>
          <Toggle
            on={form.tuiDefault}
            onToggle={() => setForm((f) => ({ ...f, tuiDefault: !f.tuiDefault }))}
          />
        </div>,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Ready (summary + launch)
// ---------------------------------------------------------------------------
function StepReady({
  form,
  onComplete,
}: {
  form: WizardFormData;
  onComplete: () => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const autonomyLabel = form.autonomyLevel === 1 ? "supervised" : form.autonomyLevel === 3 ? "autonomous" : "balanced";
  const shellLabel = form.shell === "auto" ? "auto-detect" : form.shell;
  const connLabel =
    form.provider === "lmx"
      ? `${form.lmxHost}:${form.lmxPort}`
      : "api.anthropic.com";
  const providerLabel = form.provider === "lmx" ? "local-lmx" : "anthropic";

  async function launch() {
    if (launching || launched) return;
    setLaunching(true);

    try {
      await tauriInvoke("save_setup_config", {
        provider: form.provider,
        lmxHost: form.lmxHost,
        lmxPort: form.lmxPort,
        anthropicKey: form.anthropicKey,
        configDir: form.configDir,
        autonomyLevel: form.autonomyLevel,
        shell: form.shell,
        tuiDefault: form.tuiDefault,
      });
    } catch {
      // Tauri not available (browser dev mode) — proceed anyway
    }

    setLaunched(true);
    setTimeout(() => onComplete(), 800);
  }

  const srow = (key: string, value: string, color?: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 15px",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: T.text3,
          letterSpacing: "0.04em",
        }}
      >
        {key}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10.5,
          fontWeight: 500,
          color: color ?? T.text1,
          textAlign: "right",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div>
      {/* Icon + heading */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 52,
            height: 52,
            background: T.primaryDim,
            border: "1px solid rgba(139,92,246,0.22)",
            borderRadius: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            boxShadow: "0 0 30px rgba(139,92,246,0.12)",
            fontSize: 22,
          }}
        >
          ⚡
        </div>
        <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 5, color: T.text1 }}>
          You&apos;re all set
        </h2>
        <p style={{ fontSize: 12.5, color: T.text2 }}>
          Config will be written to{" "}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: T.primaryBright,
            }}
          >
            {form.configDir}
          </span>
        </p>
      </div>

      {/* Summary table */}
      <div
        style={{
          background: T.elevated,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {srow("provider", providerLabel, T.primaryBright)}
        {srow("connection", connLabel, T.ok)}
        {srow("config_dir", form.configDir)}
        {srow("autonomy", autonomyLabel)}
        {srow("shell", shellLabel)}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 15px",
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.text3, letterSpacing: "0.04em" }}>
            tui_default
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 500, color: T.text1 }}>
            {form.tuiDefault ? "true" : "false"}
          </span>
        </div>
      </div>

      {/* Launch button */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, marginTop: 18 }}>
        <button
          type="button"
          disabled={launching}
          onClick={launch}
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 14.5,
            fontWeight: 700,
            background: launched
              ? "linear-gradient(140deg, #16a34a, #15803d)"
              : "linear-gradient(140deg, #9d70f8 0%, #8b5cf6 45%, #6d28d9 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "13px 36px",
            cursor: launching ? "default" : "pointer",
            width: "100%",
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            boxShadow: launched
              ? "0 0 40px rgba(22,163,74,0.3)"
              : "0 0 35px rgba(139,92,246,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
            transition: "box-shadow 0.2s, transform 0.15s, background 0.4s",
            opacity: launching && !launched ? 0.75 : 1,
          }}
        >
          {launched
            ? "\u2713 Config saved \u2014 starting Opta"
            : launching
              ? "Writing config\u2026"
              : <>
                  Launch Opta
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
          }
        </button>
        <a
          href="https://docs.optalocal.com/cli"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: T.text3,
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          Open documentation →
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SetupWizard component
// ---------------------------------------------------------------------------
const TOTAL_STEPS = 4;
// Indexed by current step — the label shown on the "Next" button at each step.
const NEXT_LABELS = ["Get Started", "Next", "Review Setup", ""];

const DEFAULT_FORM: WizardFormData = {
  provider: "lmx",
  lmxHost: "192.168.188.11",
  lmxPort: 1234,
  anthropicKey: "",
  configDir: "~/.config/opta",
  autonomyLevel: 2,
  shell: "auto",
  tuiDefault: false,
};

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormData>(DEFAULT_FORM);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animKey, setAnimKey] = useState(0);

  // Inject keyframes on first render
  const injectedRef = useRef(false);
  useEffect(() => {
    if (!injectedRef.current) {
      injectKeyframes();
      injectedRef.current = true;
    }
  }, []);

  // Resolve platform-accurate config directory from the Tauri backend.
  // Gracefully ignores errors — the form default is a reasonable fallback.
  useEffect(() => {
    tauriInvoke<string>("get_config_dir")
      .then((dir) => setForm((f) => ({ ...f, configDir: dir })))
      .catch(() => { /* non-Tauri env or first boot — keep default */ });
  }, []);

  function goTo(target: number, dir: "right" | "left") {
    setSlideDir(dir);
    setAnimKey((k) => k + 1);
    setStep(target);
  }

  function next() {
    if (step < TOTAL_STEPS - 1) goTo(step + 1, "right");
  }

  function prev() {
    if (step > 0) goTo(step - 1, "left");
  }

  const stepContent = [
    <StepWelcome key="welcome" />,
    <StepConnection key="connection" form={form} setForm={setForm} />,
    <StepPreferences key="preferences" form={form} setForm={setForm} />,
    <StepReady key="ready" form={form} onComplete={onComplete} />,
  ];

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    /* Full-screen overlay */
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: T.void,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 20,
        zIndex: 9999,
        fontFamily: "'Bricolage Grotesque', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Aurora background */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 70% 55% at 15% 85%, rgba(139,92,246,0.07) 0%, transparent 65%),
            radial-gradient(ellipse 55% 45% at 85% 15%, rgba(59,130,246,0.04) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(139,92,246,0.025) 0%, transparent 70%)
          `,
        }}
      />

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: T.surface,
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 22,
          boxShadow: `
            0 0 0 1px ${T.borderSoft},
            0 30px 70px rgba(0,0,0,0.65),
            0 0 120px rgba(139,92,246,0.05),
            inset 0 1px 0 rgba(255,255,255,0.04)
          `,
          animation: "opta-rise 0.55s cubic-bezier(0.16,1,0.3,1) both",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Step indicator bar */}
        <div
          style={{
            padding: "26px 30px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <StepDots step={step} total={TOTAL_STEPS} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9.5,
              color: T.text3,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginLeft: 14,
            }}
          >
            {String(step + 1).padStart(2, "0")} / 0{TOTAL_STEPS}
          </span>
        </div>

        {/* Step content */}
        <div
          style={{
            position: "relative",
            minHeight: 390,
            overflow: "hidden",
          }}
        >
          <div
            key={animKey}
            style={{
              padding: "30px 30px 0",
              animation: `${slideDir === "right" ? "opta-slide-in-right" : "opta-slide-in-left"} 0.35s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            {stepContent[step]}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "20px 30px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${T.border}`,
          }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={prev}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 13.5,
              fontWeight: 600,
              background: "transparent",
              color: T.text2,
              padding: "10px 14px",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              transition: "all 0.18s",
              letterSpacing: "-0.01em",
              opacity: step === 0 ? 0 : 1,
              pointerEvents: step === 0 ? "none" : "auto",
            }}
          >
            \u2190 Back
          </button>

          {/* Next button (hidden on last step) */}
          {!isLastStep && (
            <button
              type="button"
              onClick={next}
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 13.5,
                fontWeight: 600,
                background: T.primary,
                color: "#fff",
                padding: "10px 22px",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                transition: "all 0.18s",
                letterSpacing: "-0.01em",
                boxShadow: `0 0 20px ${T.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
            >
              {NEXT_LABELS[step]}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
