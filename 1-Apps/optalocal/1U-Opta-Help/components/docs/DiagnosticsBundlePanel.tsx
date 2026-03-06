"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, FileDown, LifeBuoy } from "lucide-react";
import { usePlatformPreference } from "@/components/docs/PlatformContext";

const macDiagnosticsCommand =
  'OUT=~/Desktop/opta-support-$(date +%Y%m%d-%H%M%S).txt; { echo "# Opta Support Bundle"; echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo; opta doctor; echo; opta daemon status; echo; opta daemon logs --lines 200; echo; opta config list; } > "$OUT" && echo "Saved $OUT"';

const windowsDiagnosticsCommand =
  '$ts=Get-Date -Format "yyyyMMdd-HHmmss"; $out="$env:USERPROFILE\\Desktop\\opta-support-$ts.txt"; "# Opta Support Bundle" | Set-Content -Path $out; "# Generated: $(Get-Date -Format o)" | Add-Content -Path $out; "" | Add-Content -Path $out; opta doctor | Add-Content -Path $out; "" | Add-Content -Path $out; opta daemon status | Add-Content -Path $out; "" | Add-Content -Path $out; opta daemon logs --lines 200 | Add-Content -Path $out; "" | Add-Content -Path $out; opta config list | Add-Content -Path $out; Write-Output "Saved $out"';

export function DiagnosticsBundlePanel() {
  const { platform } = usePlatformPreference();
  const [copied, setCopied] = useState(false);
  const command = platform === "windows" ? windowsDiagnosticsCommand : macDiagnosticsCommand;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="doc-embed-block rounded-xl px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Support Bundle
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Capture a complete diagnostics artifact for support triage.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-muted">
          <FileDown size={12} />
          {platform}
        </span>
      </div>

      <div className="mt-3 rounded-lg surface-embedded-code doc-embed-block px-3 py-2">
        <code className="text-[11px] leading-5 text-neon-cyan break-all">{command}</code>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy Bundle Command"}
        </button>

        <Link
          href="/docs/support/faq/"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <LifeBuoy size={12} />
          Support FAQ
        </Link>
      </div>
    </div>
  );
}
