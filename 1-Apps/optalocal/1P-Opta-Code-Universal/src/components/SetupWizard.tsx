import { useEffect, useRef, useState } from "react";
import { usePlatform } from "../hooks/usePlatform.js";
import { StepConnection } from "./setup/StepConnection";
import { StepPreferences } from "./setup/StepPreferences";
import { StepReady } from "./setup/StepReady";
import { StepWelcome } from "./setup/StepWelcome";
import { StepDots } from "./setup/controls";
import { DEFAULT_FORM, wizardInvoke, WIZARD_THEME } from "./setup/shared";

export interface SetupWizardProps {
  onComplete: () => void;
}

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

const TOTAL_STEPS = 4;
const NEXT_LABELS = ["Get Started", "Next", "Review Setup", ""];

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animKey, setAnimKey] = useState(0);
  const platform = usePlatform();

  const injectedRef = useRef(false);
  useEffect(() => {
    if (!injectedRef.current) {
      injectKeyframes();
      injectedRef.current = true;
    }
  }, []);

  useEffect(() => {
    wizardInvoke<string>("get_config_dir")
      .then((dir) => setForm((prev) => ({ ...prev, configDir: dir })))
      .catch(() => {
        // Non-Tauri env fallback.
      });
  }, []);

  useEffect(() => {
    if (!platform) return;
    setForm((prev) => ({
      ...prev,
      shell:
        platform === "windows"
          ? "powershell"
          : platform === "macos"
            ? "zsh"
            : "auto",
    }));
  }, [platform]);

  function goTo(target: number, dir: "right" | "left") {
    setSlideDir(dir);
    setAnimKey((current) => current + 1);
    setStep(target);
  }

  function next() {
    if (step < TOTAL_STEPS - 1) goTo(step + 1, "right");
  }

  function prev() {
    if (step > 0) goTo(step - 1, "left");
  }

  const stepContent = [
    <StepWelcome key="welcome" platform={platform} />,
    <StepConnection key="connection" form={form} setForm={setForm} />,
    <StepPreferences
      key="preferences"
      form={form}
      setForm={setForm}
      platform={platform}
    />,
    <StepReady key="ready" form={form} onComplete={onComplete} />,
  ];

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: WIZARD_THEME.void,
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

      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: WIZARD_THEME.surface,
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 22,
          boxShadow: `
            0 0 0 1px ${WIZARD_THEME.borderSoft},
            0 30px 70px rgba(0,0,0,0.65),
            0 0 120px rgba(139,92,246,0.05),
            inset 0 1px 0 rgba(255,255,255,0.04)
          `,
          animation: "opta-rise 0.55s cubic-bezier(0.16,1,0.3,1) both",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
              color: WIZARD_THEME.text3,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginLeft: 14,
            }}
          >
            {String(step + 1).padStart(2, "0")} / 0{TOTAL_STEPS}
          </span>
        </div>

        <div style={{ position: "relative", minHeight: 390, overflow: "hidden" }}>
          <div
            key={animKey}
            style={{
              padding: "30px 30px 0",
              animation: `${
                slideDir === "right"
                  ? "opta-slide-in-right"
                  : "opta-slide-in-left"
              } 0.35s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            {stepContent[step]}
          </div>
        </div>

        <div
          style={{
            padding: "20px 30px 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${WIZARD_THEME.border}`,
          }}
        >
          <button
            type="button"
            onClick={prev}
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 13.5,
              fontWeight: 600,
              background: "transparent",
              color: WIZARD_THEME.text2,
              padding: "10px 14px",
              border: `1px solid ${WIZARD_THEME.border}`,
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
            &larr; Back
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={next}
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 13.5,
                fontWeight: 600,
                background: WIZARD_THEME.primary,
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
                boxShadow: `0 0 20px ${WIZARD_THEME.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
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
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
