"use client";

import { OptaRing } from "./OptaRing";

export function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass-subtle border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OptaRing size={24} />
          <span className="text-sm font-bold tracking-[0.1em] text-moonlight">
            OPTA LOCAL
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <a
            href="https://init.optalocal.com"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Init
          </a>
          <a
            href="https://lmx.optalocal.com"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            LMX
          </a>
          <a
            href="https://help.optalocal.com/docs/cli"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            CLI
          </a>
          <a
            href="https://accounts.optalocal.com"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Accounts
          </a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://accounts.optalocal.com"
            className="hidden sm:inline-flex px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign In
          </a>
          <a
            href="https://init.optalocal.com"
            className="inline-flex px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-medium"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
