import { useState } from "react";
import { daemonClient } from "../../lib/daemonClient";
import { isNativeDesktop } from "../../lib/runtime";
import { type WizardFormData, wizardInvoke, WIZARD_THEME } from "./shared";
import type { DaemonConnectionOptions } from "../../types";

interface BootstrapMetadata {
  host?: string;
  port?: number;
}

export function StepReady({
  form,
  onComplete,
}: {
  form: WizardFormData;
  onComplete: () => void;
}) {
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const nativeDesktop = isNativeDesktop();

  const autonomyLabel =
    form.autonomyLevel === 1
      ? "supervised"
      : form.autonomyLevel === 3
        ? "autonomous"
        : "balanced";
  const shellLabel = form.shell === "auto" ? "auto-detect" : form.shell;
  const connLabel =
    form.provider === "lmx"
      ? `${form.lmxHost}:${form.lmxPort}`
      : "api.anthropic.com";
  const providerLabel = form.provider === "lmx" ? "local-lmx" : "anthropic";

  async function launch() {
    if (launching || launched) return;
    setLaunching(true);
    setSaveError(null);

    try {
      const bootstrap = await wizardInvoke<BootstrapMetadata>(
        "bootstrap_daemon_connection",
        { startIfNeeded: true },
      );
      const host = bootstrap?.host?.trim();
      const port = Math.trunc(Number(bootstrap?.port));
      if (!host || !Number.isFinite(port) || port <= 0 || port > 65_535) {
        throw new Error("Daemon bootstrap returned an invalid connection.");
      }

      const token = await wizardInvoke<string>("get_connection_secret", {
        host,
        port,
      }).catch(() => "");

      const connection: DaemonConnectionOptions = {
        host,
        port,
        token: typeof token === "string" ? token : "",
      };

      const response = await daemonClient.runOperation(connection, "onboard.apply", {
        input: {
          provider: form.provider,
          lmxHost: form.lmxHost,
          lmxPort: form.lmxPort,
          anthropicApiKey: form.anthropicKey || undefined,
          autonomyLevel: form.autonomyLevel,
          tuiDefault: form.tuiDefault,
        },
      });
      if (!response.ok) {
        throw new Error(`[${response.error.code}] ${response.error.message}`);
      }
    } catch (error) {
      if (nativeDesktop) {
        setLaunching(false);
        setSaveError(
          error instanceof Error
            ? error.message
            : "Unable to apply onboarding config",
        );
        return;
      }
      // Browser/dev mode fallback.
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
        borderBottom: `1px solid ${WIZARD_THEME.border}`,
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: WIZARD_THEME.text3,
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
          color: color ?? WIZARD_THEME.text1,
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
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 52,
            height: 52,
            background: WIZARD_THEME.primaryDim,
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
        <h2
          style={{
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: 5,
            color: WIZARD_THEME.text1,
          }}
        >
          You&apos;re all set
        </h2>
        <p style={{ fontSize: 12.5, color: WIZARD_THEME.text2 }}>
          Config will be written to{" "}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: WIZARD_THEME.primaryBright,
            }}
          >
            {form.configDir}
          </span>
        </p>
      </div>

      <div
        style={{
          background: WIZARD_THEME.elevated,
          border: `1px solid ${WIZARD_THEME.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {srow("provider", providerLabel, WIZARD_THEME.primaryBright)}
        {srow("connection", connLabel, WIZARD_THEME.ok)}
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
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: WIZARD_THEME.text3,
              letterSpacing: "0.04em",
            }}
          >
            tui_default
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              fontWeight: 500,
              color: WIZARD_THEME.text1,
            }}
          >
            {form.tuiDefault ? "true" : "false"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 11,
          marginTop: 18,
        }}
      >
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
          {launched ? (
            "Onboarding applied - starting Opta"
          ) : launching ? (
            "Applying onboarding..."
          ) : (
            <>
              Launch Opta
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
        <a
          href="https://help.optalocal.com/docs/cli"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: WIZARD_THEME.text3,
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          Open documentation -&gt;
        </a>
        {saveError ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: WIZARD_THEME.fail,
              textAlign: "center",
            }}
          >
            Launch failed: {saveError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
