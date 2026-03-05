"use client";

import { useMemo, useState } from "react";

type Platform = "macos" | "windows" | "linux" | "other";

const STEPS = [
  {
    id: "prereqs",
    title: "1. Verify prerequisites",
    body: "Ensure network access to your LMX host (Apple Silicon) or have OpenAI/Anthropic API keys ready for Cloud models. Confirm daemon port availability.",
  },
  {
    id: "install",
    title: "2. Install Opta Init manager",
    body: "Use bootstrap flow for default setup (macOS) or download manager artifacts for Windows/Linux environments.",
  },
  {
    id: "connect",
    title: "3. Connect stack components",
    body: "Register CLI daemon endpoint, verify authentication token recovery, and ensure Opta Code / Opta Local surfaces can reach local services.",
  },
  {
    id: "verify",
    title: "4. Verify health and release channel",
    body: "Run health checks, confirm session replay + metrics endpoints, and pick stable or beta release channel before rollout.",
  },
] as const;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "other";
}

export default function SetupWizardPage() {
  const [index, setIndex] = useState(0);
  const platform = useMemo(() => detectPlatform(), []);
  const step = STEPS[index];

  const platformLabel = platform === "macos"
    ? "macOS"
    : platform === "windows"
      ? "Windows"
      : platform === "linux"
        ? "Linux"
        : "Unknown";

  return (
    <main className="min-h-screen bg-void px-6 py-12 text-text-primary sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">Opta Init Setup Wizard</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Interactive Setup Wizard</h1>
        <p className="mt-3 text-text-secondary">
          Detected platform: <span className="font-semibold text-text-primary">{platformLabel}</span>
        </p>

        <div className="mt-8 obsidian rounded-xl border border-white/10 p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
              Step {index + 1} of {STEPS.length}
            </span>
            <span className="text-xs text-primary">{step.id}</span>
          </div>
          <h2 className="text-xl font-semibold">{step.title}</h2>
          <p className="mt-3 leading-relaxed text-text-secondary">{step.body}</p>

          {index === 1 && (
            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
              <p className="font-semibold text-primary">Recommended bootstrap command</p>
              <code className="mt-2 block overflow-x-auto whitespace-nowrap text-text-primary">
                {"curl -fsSL https://init.optalocal.com/init | bash  # macOS"}
                <br />
                {"powershell -NoProfile -ExecutionPolicy Bypass -Command \"iwr https://init.optalocal.com/desktop-updates/manager/beta/0.6.1/Opta-Init-Manager_x64-setup.nsis.zip -OutFile opta-init-installer.zip\""}
              </code>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIndex((v) => Math.max(0, v - 1))}
            disabled={index === 0}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((v) => Math.min(STEPS.length - 1, v + 1))}
            disabled={index === STEPS.length - 1}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <a href="/downloads" className="rounded-lg border border-primary/40 px-4 py-2 text-sm text-primary">
            Open Downloads
          </a>
          <a href="/api-reference" className="rounded-lg border border-primary/40 px-4 py-2 text-sm text-primary">
            API Reference
          </a>
        </div>
      </div>
    </main>
  );
}
