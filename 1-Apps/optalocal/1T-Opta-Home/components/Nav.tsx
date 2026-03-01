"use client";

import { OptaRing } from "./OptaRing";

export function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass-subtle border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <OptaRing size={24} />
          <span className="text-sm font-bold tracking-[0.1em] text-moonlight">
            OPTA LOCAL
          </span>
        </div>

        {/* Core app links */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <a
            href="https://lmx.optalocal.com"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            LMX
          </a>
          <span className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            CLI
          </span>
          <span className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            Code
          </span>
          <span className="w-px h-4 bg-white/10" />
          <a
            href="https://accounts.optalocal.com"
            className="text-text-muted hover:text-text-secondary transition-colors text-xs"
          >
            Accounts
          </a>
          <a
            href="https://status.optalocal.com"
            className="text-text-muted hover:text-text-secondary transition-colors text-xs"
          >
            Status
          </a>
          <a
            href="https://help.optalocal.com"
            className="text-text-muted hover:text-text-secondary transition-colors text-xs"
          >
            Help
          </a>
        </div>

        {/* CTA */}
        <a
          href="https://init.optalocal.com"
          className="inline-flex px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-medium"
        >
          Get Started
        </a>
      </div>
    </nav>
  );
}
