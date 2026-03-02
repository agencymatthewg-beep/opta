import { invokeNative } from "../../lib/runtime";

export interface WizardFormData {
  provider: "lmx" | "anthropic";
  lmxHost: string;
  lmxPort: number;
  anthropicKey: string;
  configDir: string;
  autonomyLevel: 1 | 2 | 3;
  shell: "auto" | "bash" | "zsh" | "powershell";
  tuiDefault: boolean;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface LmxProbeResult {
  reachable: boolean;
  version?: string;
  model_count?: number;
  status?: string;
}

export async function wizardInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invokeNative<T>(command, args);
}

export const WIZARD_THEME = {
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

export const DEFAULT_FORM: WizardFormData = {
  provider: "lmx",
  lmxHost: "127.0.0.1",
  lmxPort: 1234,
  anthropicKey: "",
  configDir: "~/.config/opta",
  autonomyLevel: 2,
  shell: "auto",
  tuiDefault: false,
};
