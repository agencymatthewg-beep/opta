import { useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { WIZARD_THEME } from "./shared";

export function StepDots({
  step,
  total,
}: {
  step: number;
  total: number;
}) {
  const items: ReactNode[] = [];
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
          background:
            isDone || isNow
              ? isNow
                ? WIZARD_THEME.primaryBright
                : WIZARD_THEME.primary
              : WIZARD_THEME.text4,
          border: `1px solid ${
            isDone || isNow
              ? isNow
                ? WIZARD_THEME.primaryBright
                : WIZARD_THEME.primary
              : WIZARD_THEME.border
          }`,
          boxShadow: isNow
            ? "0 0 10px rgba(167,139,250,0.45)"
            : isDone
              ? `0 0 7px ${WIZARD_THEME.primaryGlow}`
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
            background:
              i < step ? "rgba(139,92,246,0.35)" : WIZARD_THEME.border,
            margin: "0 5px",
            transition: "background 0.4s",
          }}
        />,
      );
    }
  }
  return <div style={{ display: "flex", alignItems: "center", flex: 1 }}>{items}</div>;
}

export type SegOption<T extends string> = { value: T; label: string };

export function SegControl<T extends string>({
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
        border: `1px solid ${WIZARD_THEME.border}`,
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
                  : WIZARD_THEME.raised
                : "none",
              border: isOn
                ? `1px solid ${
                    violet ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.1)"
                  }`
                : "none",
              color: isOn
                ? violet
                  ? WIZARD_THEME.primaryBright
                  : WIZARD_THEME.text1
                : WIZARD_THEME.text3,
              padding: "6px 8px",
              borderRadius: 7,
              cursor: "pointer",
              transition: "all 0.18s",
              whiteSpace: "nowrap",
              boxShadow:
                isOn && !violet ? "0 1px 3px rgba(0,0,0,0.35)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") onToggle();
      }}
      style={{
        width: 38,
        height: 21,
        background: on ? WIZARD_THEME.primary : "rgba(255,255,255,0.09)",
        border: `1px solid ${
          on ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"
        }`,
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

export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9.5,
        fontWeight: 500,
        color: WIZARD_THEME.text3,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

export function TextInput({
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
  style?: CSSProperties;
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
        border: `1px solid ${
          focused ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.09)"
        }`,
        borderRadius: 8,
        color: WIZARD_THEME.text1,
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

export type WizardFormSetter = Dispatch<SetStateAction<import("./shared").WizardFormData>>;
