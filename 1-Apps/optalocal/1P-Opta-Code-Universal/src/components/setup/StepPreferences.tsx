import { useRef } from "react";
import type { Platform } from "../../hooks/usePlatform.js";
import { isNativeDesktop } from "../../lib/runtime";
import {
  MonoLabel,
  SegControl,
  TextInput,
  Toggle,
  type WizardFormSetter,
} from "./controls";
import { type WizardFormData, wizardInvoke, WIZARD_THEME } from "./shared";

export function StepPreferences({
  form,
  setForm,
  platform,
}: {
  form: WizardFormData;
  setForm: WizardFormSetter;
  platform: Platform | null;
}) {
  const configDirRowRef = useRef<HTMLDivElement>(null);
  const nativeDesktop = isNativeDesktop();

  const focusConfigInput = () => {
    const input = configDirRowRef.current?.querySelector<HTMLInputElement>("input");
    if (input) {
      input.focus();
      input.select();
    }
  };

  const openBrowserFolderPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory =
      true;
    input.onchange = () => {
      const firstFile = input.files?.[0];
      const relativePath = firstFile?.webkitRelativePath;
      const folderName = relativePath?.split("/")[0];
      if (folderName) {
        setForm((prev) => ({ ...prev, configDir: `~/${folderName}` }));
        return;
      }
      focusConfigInput();
    };
    input.click();
  };

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
      <p style={{ fontSize: 12.5, color: WIZARD_THEME.text2, marginBottom: 20 }}>
        Tune Opta to your workflow
      </p>

      {prefGroup(
        <>
          <MonoLabel>Config folder</MonoLabel>
          <div ref={configDirRowRef} style={{ display: "flex", gap: 7 }}>
            <TextInput
              value={form.configDir}
              onChange={(nextValue) =>
                setForm((prev) => ({ ...prev, configDir: nextValue }))
              }
            />
            <button
              type="button"
              onClick={async () => {
                if (nativeDesktop) {
                  try {
                    const chosen = await wizardInvoke<string | null>(
                      "pick_folder",
                    );
                    if (chosen) {
                      setForm((prev) => ({ ...prev, configDir: chosen }));
                      return;
                    }
                  } catch {
                    // Native picker unavailable - fall through.
                  }
                }
                if (!nativeDesktop) {
                  openBrowserFolderPicker();
                  return;
                }
                focusConfigInput();
              }}
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 11.5,
                fontWeight: 600,
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: WIZARD_THEME.text2,
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
            <p style={{ margin: "6px 0 0", fontSize: 11, color: WIZARD_THEME.text3 }}>
              Default shell since macOS Catalina
            </p>
          ) : null}
          {platform === "windows" && form.shell === "powershell" ? (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: WIZARD_THEME.text3 }}>
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
