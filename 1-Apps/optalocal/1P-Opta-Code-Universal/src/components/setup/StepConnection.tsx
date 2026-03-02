import { useState } from "react";
import { isNativeDesktop } from "../../lib/runtime";
import { MonoLabel, TextInput, type WizardFormSetter } from "./controls";
import {
  type ConnectionTestResult,
  type LmxProbeResult,
  type WizardFormData,
  wizardInvoke,
  WIZARD_THEME,
} from "./shared";

type TestState = "idle" | "pinging" | "ok" | "fail";

export function StepConnection({
  form,
  setForm,
}: {
  form: WizardFormData;
  setForm: WizardFormSetter;
}) {
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [probeInfo, setProbeInfo] = useState<LmxProbeResult | null>(null);

  async function testConnection(e: React.MouseEvent) {
    e.stopPropagation();
    setTestState("pinging");
    setTestMsg("Connecting...");
    setProbeInfo(null);

    try {
      const result = await wizardInvoke<ConnectionTestResult>(
        "test_lmx_connection",
        { host: form.lmxHost, port: form.lmxPort },
      );
      if (result.ok) {
        setTestState("ok");
        setTestMsg(`OK ${result.message}`);
        wizardInvoke<LmxProbeResult>("probe_lmx_server", {
          host: form.lmxHost,
          port: form.lmxPort,
        })
          .then((probe) => {
            if (probe.reachable) setProbeInfo(probe);
          })
          .catch(() => {
            // Best-effort metadata probe.
          });
      } else {
        setTestState("fail");
        setTestMsg(`Error ${result.message}`);
      }
    } catch (error) {
      if (isNativeDesktop()) {
        setTestState("fail");
        setTestMsg(
          `Error ${error instanceof Error ? error.message : "connection failed"}`,
        );
        return;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      setTestState("ok");
      setTestMsg("OK Simulated (dev mode)");
    }
  }

  const dotColor =
    testState === "ok"
      ? WIZARD_THEME.ok
      : testState === "fail"
        ? WIZARD_THEME.fail
        : testState === "pinging"
          ? WIZARD_THEME.warn
          : WIZARD_THEME.text4;

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
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") onClick();
      }}
      style={{
        background: isSelected ? "rgba(139,92,246,0.06)" : WIZARD_THEME.elevated,
        border: `1.5px solid ${isSelected ? WIZARD_THEME.primary : WIZARD_THEME.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(139,92,246,0.18), inset 0 0 50px rgba(139,92,246,0.03)"
          : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: WIZARD_THEME.text1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            border: `1.5px solid ${isSelected ? WIZARD_THEME.primary : WIZARD_THEME.border}`,
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
              background: WIZARD_THEME.primary,
              opacity: isSelected ? 1 : 0,
              transform: isSelected ? "scale(1)" : "scale(0)",
              transition: "opacity 0.2s, transform 0.2s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: WIZARD_THEME.text3,
          marginBottom: isSelected ? 14 : 0,
        }}
      >
        {desc}
      </div>
      {isSelected ? <div onClick={(e) => e.stopPropagation()}>{detail}</div> : null}
    </div>
  );

  return (
    <div>
      <h2
        style={{
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: 3,
          color: WIZARD_THEME.text1,
        }}
      >
        Choose a provider
      </h2>
      <p style={{ fontSize: 12.5, color: WIZARD_THEME.text2, marginBottom: 20 }}>
        Where Opta sends your prompts
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {modeCard(
          form.provider === "lmx",
          () => setForm((prev) => ({ ...prev, provider: "lmx" })),
          <>
            Local LMX
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8.5,
                fontWeight: 500,
                color: WIZARD_THEME.primaryBright,
                background: WIZARD_THEME.primaryDim,
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
          "Mac Studio inference - private, near-zero latency",
          <div>
            <MonoLabel>Host : Port</MonoLabel>
            <p
              style={{
                marginTop: 0,
                marginBottom: 8,
                fontSize: 11,
                color: WIZARD_THEME.text3,
              }}
            >
              Auto-detected from daemon discovery when available.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TextInput
                value={`${form.lmxHost}:${form.lmxPort}`}
                onChange={(nextValue) => {
                  const [host, port] = nextValue.split(":");
                  setForm((prev) => ({
                    ...prev,
                    lmxHost: host ?? prev.lmxHost,
                    lmxPort: port
                      ? Number.parseInt(port, 10) || prev.lmxPort
                      : prev.lmxPort,
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
                  color: WIZARD_THEME.text2,
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
                    boxShadow:
                      testState === "ok"
                        ? `0 0 7px ${WIZARD_THEME.okGlow}`
                        : testState === "fail"
                          ? `0 0 7px ${WIZARD_THEME.failGlow}`
                          : "none",
                    animation:
                      testState === "pinging"
                        ? "opta-blink 0.7s ease-in-out infinite"
                        : "none",
                    transition: "all 0.3s",
                    flexShrink: 0,
                  }}
                />
                Test
              </button>
            </div>
            {testMsg ? (
              <div
                style={{
                  marginTop: 5,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color:
                    testState === "ok"
                      ? WIZARD_THEME.ok
                      : testState === "fail"
                        ? WIZARD_THEME.fail
                        : WIZARD_THEME.warn,
                  minHeight: 14,
                  transition: "color 0.2s",
                }}
              >
                {testMsg}
              </div>
            ) : null}

            {probeInfo ? (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {probeInfo.version ? (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: WIZARD_THEME.primaryBright,
                      background: WIZARD_THEME.primaryDim,
                      border: "1px solid rgba(139,92,246,0.22)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    v{probeInfo.version}
                  </span>
                ) : null}
                {probeInfo.model_count !== undefined ? (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: WIZARD_THEME.ok,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.18)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {probeInfo.model_count} model
                    {probeInfo.model_count !== 1 ? "s" : ""}
                  </span>
                ) : null}
                {probeInfo.status ? (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: WIZARD_THEME.text2,
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${WIZARD_THEME.border}`,
                      borderRadius: 5,
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {probeInfo.status}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>,
        )}

        {modeCard(
          form.provider === "anthropic",
          () => setForm((prev) => ({ ...prev, provider: "anthropic" })),
          "Cloud API",
          "Anthropic API - no Mac Studio required",
          <div>
            <MonoLabel>Anthropic API Key</MonoLabel>
            <div style={{ position: "relative" }}>
              <TextInput
                value={form.anthropicKey}
                onChange={(nextValue) =>
                  setForm((prev) => ({ ...prev, anthropicKey: nextValue }))
                }
                placeholder="sk-ant-api03-..."
                type={showKey ? "text" : "password"}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowKey((current) => !current)}
                style={{
                  position: "absolute",
                  right: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: WIZARD_THEME.text3,
                  display: "flex",
                  padding: 4,
                }}
              >
                {showKey ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
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
