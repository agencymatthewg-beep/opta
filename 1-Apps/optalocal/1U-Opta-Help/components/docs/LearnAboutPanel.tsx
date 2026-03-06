"use client";

import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { getLearnAboutLinks, getLearnGuideUrl } from "@/lib/learn-about";

const appBadgeTone: Record<string, string> = {
  lmx: "text-neon-purple bg-neon-purple/10",
  cli: "text-neon-green bg-neon-green/10",
  accounts: "text-neon-blue bg-neon-blue/10",
  code: "text-primary bg-primary/10",
  general: "text-text-secondary bg-white/10",
};

export function LearnAboutPanel() {
  const pathname = usePathname();
  const learnLinks = getLearnAboutLinks(pathname);

  if (learnLinks.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl doc-embed-block px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Learn About
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Deep workflow guides aligned to this documentation section.
          </p>
        </div>
        <BookOpen size={16} className="text-primary/80 mt-0.5 shrink-0" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {learnLinks.map((guide) => (
          <a
            key={guide.slug}
            href={getLearnGuideUrl(guide.slug)}
            target="_blank"
            rel="noreferrer"
            className="group rounded-lg doc-embed-block px-3 py-2 transition-all hover:bg-primary/[0.05]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">{guide.title}</p>
              <ArrowUpRight
                size={14}
                className="text-text-muted group-hover:text-primary transition-colors shrink-0"
              />
            </div>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">{guide.summary}</p>
            <span
              className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${appBadgeTone[guide.app] ?? appBadgeTone.general}`}
            >
              {guide.app}
            </span>
          </a>
        ))}
      </div>

      <a
        href="https://learn.optalocal.com"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        Browse all Opta Learn guides
        <ArrowUpRight size={12} />
      </a>
    </section>
  );
}
