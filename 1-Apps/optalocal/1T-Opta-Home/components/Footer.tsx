"use client";

import { OptaRing } from "./OptaRing";

export function Footer() {
  return (
    <footer className="relative py-16 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <OptaRing size={24} />
            <div>
              <div className="text-sm font-bold tracking-[0.1em] text-moonlight mb-1">
                OPTA LOCAL
              </div>
              <div className="text-xs text-text-muted">
                Intelligent operating system for autonomous workflows
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
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
              href="https://help.optalocal.com/docs/opta-code"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Code
            </a>
            <a
              href="https://accounts.optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Accounts
            </a>
            <a
              href="https://status.optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Status
            </a>
            <a
              href="https://help.optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Help
            </a>
            <a
              href="https://learn.optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Learn
            </a>
            <a
              href="https://optamize.biz"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              optamize.biz
            </a>
          </div>

          <div className="text-sm text-text-muted">
            © 2026 Opta Operations
          </div>
        </div>
      </div>
    </footer>
  );
}
