"use client";

import { Laptop, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformPreference } from "@/components/docs/PlatformContext";

const platformOptions = [
  {
    value: "macos" as const,
    label: "macOS",
    hint: "Shell commands, launchd paths, and Apple runtime guidance",
    icon: Laptop,
  },
  {
    value: "windows" as const,
    label: "Windows",
    hint: "PowerShell/CMD commands, Scheduled Task flow, and Windows paths",
    icon: Monitor,
  },
];

const cliVersionOptions = [
  { value: "1.1.0", label: "Latest (1.1.0)", profile: "latest" as const },
  { value: "1.0.0", label: "1.0 LTS", profile: "v1_0" as const },
];

export function PlatformToggle() {
  const { platform, setPlatform, installedCliVersion, setInstalledCliVersion, cliProfile } =
    usePlatformPreference();
  const activeOption = platformOptions.find((option) => option.value === platform);

  return (
    <div className="doc-embed-block rounded-xl px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Platform View
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Documentation is adapted for{" "}
            <span className="text-text-primary font-medium">{activeOption?.label}</span>.
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-white/[0.02] doc-embed-block p-1">
          {platformOptions.map(({ value, label, icon: Icon }) => {
            const selected = platform === value;
            return (
              <button
                key={value}
                onClick={() => setPlatform(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all",
                  selected
                    ? "bg-primary/20 text-primary shadow-[0_0_0_1px_rgba(168,85,247,0.3)]"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                )}
                aria-pressed={selected}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-text-muted">{activeOption?.hint}</p>

      <div className="mt-4 pt-3">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-3" />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            CLI Version Context
          </p>
          <p className="text-sm text-text-secondary">
            Installed CLI:{" "}
            <span className="text-text-primary font-medium">{installedCliVersion}</span>{" "}
            <span className="text-text-muted">
              ({cliProfile === "v1_0" ? "1.0 compatibility profile" : "latest compatibility profile"})
            </span>
          </p>
          <div className="inline-flex rounded-lg bg-white/[0.02] doc-embed-block p-1">
            {cliVersionOptions.map(({ value, label, profile }) => {
              const selected = cliProfile === profile;
              return (
                <button
                  key={value}
                  onClick={() => setInstalledCliVersion(value)}
                  className={cn(
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-all",
                    selected
                      ? "bg-primary/20 text-primary shadow-[0_0_0_1px_rgba(168,85,247,0.3)]"
                      : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                  )}
                  aria-pressed={selected}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
