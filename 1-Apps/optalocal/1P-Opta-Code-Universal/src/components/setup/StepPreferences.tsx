import { useEffect, useState } from "react";
import { daemonClient } from "../../lib/daemonClient";
import type { Platform } from "../../hooks/usePlatform.js";
import {
  MonoLabel,
  SegControl,
  Toggle,
  type WizardFormSetter,
} from "./controls";
import { type WizardFormData, WIZARD_THEME } from "./shared";

import type { DaemonConnectionOptions } from "../../types";

export function StepPreferences({
  form,
  setForm,
  platform,
  connection,
}: {
  form: WizardFormData;
  setForm: WizardFormSetter;
  platform: Platform | null;
  connection?: DaemonConnectionOptions | null;
}) {
  const [profiled, setProfiled] = useState(false);

  useEffect(() => {
    let active = true;
    if (connection && !profiled) {
      daemonClient.runOperation(connection, "doctor", {}).then((res) => {
        if (!active) return;
        setProfiled(true);
        if (res.ok) {
          setForm((prev) => ({
            ...prev,
            autonomyLevel: prev.autonomyLevel === 2 ? 3 : prev.autonomyLevel
          }));
        }
      }).catch(() => {
        // fail silently
      });
    }
    return () => { active = false; };
  }, [connection, profiled, setForm]);

  const prefGroup = (children: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>{children}</div>
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
        Preferences
      </h2>
      <p
        style={{ fontSize: 12.5, color: WIZARD_THEME.text2, marginBottom: 20 }}
      >
        Tune Opta to your workflow
      </p>

      {profiled && (
        <div
          style={{
            fontSize: 11,
            color: WIZARD_THEME.ok,
            background: WIZARD_THEME.okGlow,
            border: `1px solid rgba(34, 197, 94, 0.3)`,
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 20,
            display: "inline-block",
          }}
        >
          ✓ Hardware Profiled: Safe Defaults Applied
        </div>
      )}

      {prefGroup(
        <>
          <MonoLabel>Config folder (CLI canonical)</MonoLabel>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11.5,
              background: "rgba(0,0,0,0.28)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8,
              color: WIZARD_THEME.text1,
              padding: "8px 11px",
            }}
          >
            {form.configDir}
          </div>
        </>,
      )}

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
            onChange={(nextValue) =>
              setForm((prev) => ({
                ...prev,
                autonomyLevel: Number(nextValue) as 1 | 2 | 3,
              }))
            }
            violet
          />
        </>,
      )}

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
            onChange={(nextValue) =>
              setForm((prev) => ({ ...prev, shell: nextValue }))
            }
          />
          {platform === "macos" && form.shell === "zsh" ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: WIZARD_THEME.text3,
              }}
            >
              Default shell since macOS Catalina
            </p>
          ) : null}
          {platform === "windows" && form.shell === "powershell" ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: WIZARD_THEME.text3,
              }}
            >
              Recommended for Windows
            </p>
          ) : null}
        </>,
      )}

      {prefGroup(
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 2,
                color: WIZARD_THEME.text1,
              }}
            >
              Enable TUI by default
            </div>
            <div style={{ fontSize: 11, color: WIZARD_THEME.text3 }}>
              Full-screen UI when running{" "}
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9.5,
                  background: "rgba(255,255,255,0.07)",
                  border: `1px solid ${WIZARD_THEME.border}`,
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
            onToggle={() =>
              setForm((prev) => ({ ...prev, tuiDefault: !prev.tuiDefault }))
            }
          />
        </div>,
      )}
    </div>
  );
}
