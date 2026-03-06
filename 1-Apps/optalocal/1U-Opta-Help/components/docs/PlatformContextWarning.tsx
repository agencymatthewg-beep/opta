"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { usePlatformPreference } from "@/components/docs/PlatformContext";

export function PlatformContextWarning() {
  const pathname = usePathname();
  const { platform } = usePlatformPreference();

  if (platform !== "windows") return null;

  const inLmxSection = pathname === "/docs/lmx/" || pathname.startsWith("/docs/lmx/");
  if (!inLmxSection) return null;

  return (
    <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-500/12 to-amber-500/5 px-4 py-3 warning-embed-block">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 text-amber-300 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-200">
            This page targets the LMX host runtime (Apple Silicon macOS).
          </p>
          <p className="mt-1 text-xs text-amber-100/85">
            You are in Windows view. Commands on this page must run on the remote LMX host, not
            on your Windows workstation. Use LAN setup for workstation-side routing and control.
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <Link href="/docs/getting-started/lan-setup/" className="text-amber-200 hover:text-amber-100">
              Open LAN Setup
            </Link>
            <Link href="/docs/code-desktop/" className="text-amber-200 hover:text-amber-100">
              Open Opta Code Desktop docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
