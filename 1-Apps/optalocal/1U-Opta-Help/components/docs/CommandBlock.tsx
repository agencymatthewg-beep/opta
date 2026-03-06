"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import {
  useOptionalPlatformPreference,
  type OptaCliProfile,
  type OptaPlatform,
} from "@/components/docs/PlatformContext";

interface CommandBlockProps {
  command?: string;
  output?: string;
  description?: string;
  platformCommands?: Partial<Record<OptaPlatform, string>>;
  platformDescriptions?: Partial<Record<OptaPlatform, string>>;
  platformOutputs?: Partial<Record<OptaPlatform, string>>;
  versionCommands?: Partial<Record<OptaCliProfile, string>>;
  versionDescriptions?: Partial<Record<OptaCliProfile, string>>;
  versionOutputs?: Partial<Record<OptaCliProfile, string>>;
}

function getDefaultCommand(platformCommands?: Partial<Record<OptaPlatform, string>>) {
  if (!platformCommands) return "";
  if (platformCommands.macos) return platformCommands.macos;
  if (platformCommands.windows) return platformCommands.windows;
  return "";
}

export function CommandBlock({
  command,
  output,
  description,
  platformCommands,
  platformDescriptions,
  platformOutputs,
  versionCommands,
  versionDescriptions,
  versionOutputs,
}: CommandBlockProps) {
  const platformContext = useOptionalPlatformPreference();
  const selectedPlatform = platformContext?.platform ?? "macos";
  const selectedCliProfile = platformContext?.cliProfile ?? "latest";
  const [copied, setCopied] = useState(false);
  const resolvedCommand =
    versionCommands?.[selectedCliProfile] ??
    platformCommands?.[selectedPlatform] ??
    command ??
    getDefaultCommand(platformCommands);
  const resolvedDescription =
    versionDescriptions?.[selectedCliProfile] ??
    platformDescriptions?.[selectedPlatform] ??
    description;
  const resolvedOutput =
    versionOutputs?.[selectedCliProfile] ??
    platformOutputs?.[selectedPlatform] ??
    output;

  const handleCopy = async () => {
    if (!resolvedCommand) return;
    try {
      await navigator.clipboard.writeText(resolvedCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable in non-secure contexts */ }
  };

  return (
    <div className="rounded-lg doc-embed-block overflow-hidden mb-5">
      {resolvedDescription && (
        <div className="px-4 py-2.5 bg-transparent text-xs text-text-muted">
          {resolvedDescription}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3 surface-embedded-code bg-transparent group">
        <Terminal size={14} className="text-text-muted shrink-0" />
        <code className="flex-1 text-sm text-neon-cyan font-mono">{resolvedCommand}</code>
        {(platformCommands || versionCommands) && (
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md bg-white/5 text-text-muted">
            {platformCommands ? selectedPlatform : selectedCliProfile}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-secondary transition-all shrink-0"
          aria-label="Copy command"
        >
          {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} />}
        </button>
      </div>
      {resolvedOutput && (
        <pre className="px-4 py-3 surface-embedded-code bg-transparent text-xs text-text-muted font-mono overflow-x-auto">
          {resolvedOutput}
        </pre>
      )}
    </div>
  );
}
