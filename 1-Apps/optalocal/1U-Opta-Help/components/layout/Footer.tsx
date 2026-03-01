import { OptaRing } from "@/components/shared/OptaRing";

export function Footer() {
  return (
    <footer className="relative py-16 px-6 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <OptaRing size={24} />
            <div>
              <div className="text-sm font-bold tracking-[0.1em] text-moonlight mb-1">
                OPTA HELP
              </div>
              <div className="text-xs text-text-muted">
                Documentation for the Opta Local stack
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <a
              href="https://optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Home
            </a>
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
              href="https://status.optalocal.com"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Status
            </a>
            <a
              href="https://optamize.biz"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              optamize.biz
            </a>
          </div>

          <div className="text-sm text-text-muted">
            &copy; 2026 Opta Operations
          </div>
        </div>
      </div>
    </footer>
  );
}
