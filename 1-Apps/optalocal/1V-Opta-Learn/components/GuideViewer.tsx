'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Search, ChevronLeft, Info } from 'lucide-react';
import type { Guide } from '@/content/guides';
import { appColors } from '@/content/guides';

export function GuideViewer({ guide }: { guide: Guide }) {
  const isVisualFirst = guide.template === 'visual-interactive-journey';
  const getSectionPhase = (heading: string) => {
    const match = heading.match(/^\[([^\]]+)\]/);
    return match ? match[1].toLowerCase() : 'overview';
  };

  const getSectionLabel = (heading: string) => heading.replace(/^\[[^\]]+\]\s*/, '');
  useEffect(() => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.toc-link');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.remove('active');
            if (link.getAttribute('data-target') === entry.target.id) {
              link.classList.add('active');
            }
          });
        }
      });
    }, { rootMargin: '-100px 0px -60% 0px', threshold: 0 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Format title to ensure "Opta" is styled
  const renderTitle = (title: string) => {
    return title;
  };

  // Helper to pre-process body text and wrap plain "Opta" mentions if not already wrapped
  const processBody = (body: string) => {
    // This is a naive replacement just for plain text mentions to ensure consistent branding.
    // In production, the HTML strings will already contain <span class="text-opta"> via Gemini generation.
    let processed = body;
    if (!processed.includes('<span class="text-opta">')) {
      processed = processed.replace(/\bOpta\b/g, '<span class="text-opta">Opta</span>');
    }
    return processed;
  };

  return (
    <div className="min-h-screen bg-void flex flex-col font-sora bg-dot-subtle">
      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 glass-strong px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 font-mono text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <span className="text-opta font-semibold lowercase">Opta</span> local
            </Link>
            <span>/</span>
            <Link href="/" className="hover:text-white transition-colors">learn</Link>
            <span>/</span>
            <span style={{ color: appColors[guide.app] }}>{guide.app}</span>
          </div>
        </div>

        {/* Placeholder Search in Header matching new design */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search guides..."
            className="w-full bg-[rgba(12,12,18,0.8)] border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div className="w-[150px] hidden md:block" />
      </header>

      <div className="flex flex-1 pt-[72px]">
        {/* TOC Sidebar */}
        <aside className="w-72 fixed h-[calc(100vh-72px)] p-8 hidden lg:flex flex-col gap-10 overflow-y-auto z-40 bg-[#07070d]/65 backdrop-blur-2xl">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Guide Navigation</span>
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              {renderTitle(guide.title)}
            </h2>
          </div>

          <nav className="flex flex-col gap-3 text-sm font-medium">
            <a href="#overview" className="toc-link active pl-4" data-target="overview">1. Overview</a>
            {guide.sections.map((section, idx) => {
              const id = `section-${idx}`;
              return (
                <a key={id} href={`#${id}`} className="toc-link pl-4 hover:text-white transition-colors" data-target={id}>
                  {idx + 2}. {section.heading}
                </a>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-white/10">
            <Link href="/" className="text-text-muted hover:text-white transition-colors flex items-center gap-2 text-sm">
              <ChevronLeft className="w-4 h-4" /> Back to all guides
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 p-8 md:p-12 lg:p-24 max-w-5xl flex flex-col gap-20 relative">

          <section id="overview" className="flex flex-col gap-6 pt-8">
            <div className="inline-flex items-center gap-2 w-max px-3 py-1 rounded-full bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.18em] text-text-secondary">
              <span className="status-live">Guide Blueprint</span>
            </div>
            <div
              className="inline-flex items-center gap-2 w-max px-3 py-1 text-xs font-mono border rounded uppercase tracking-wider"
              style={{
                borderColor: `${appColors[guide.app]}40`,
                color: appColors[guide.app],
                backgroundColor: `${appColors[guide.app]}10`
              }}
            >
              {guide.category.replace('-', ' ')} Guide
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-moonlight mb-6">
              {renderTitle(guide.title)}
            </h1>

            <p className="text-xl text-text-secondary leading-relaxed">
              {guide.summary}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="guide-chip">Setup</span>
              <span className="guide-chip">Configuration</span>
              <span className="guide-chip">Operation</span>
              <span className="guide-chip">Troubleshooting</span>
              <span className="guide-chip">Optimization</span>
            </div>

            <p className="text-xs font-mono text-text-muted">Updated {guide.updatedAt}</p>
          </section>

          {guide.sections.map((section, idx) => {
            const id = `section-${idx}`;
            const phase = getSectionPhase(section.heading);
            return (
              <section
                key={id}
                id={id}
                className={`guide-section flex flex-col ${isVisualFirst ? 'gap-5 pt-8' : 'gap-8 pt-10'} transition-all duration-300 relative`}
              >
                <h2 className="text-3xl font-semibold text-text-primary">{section.heading}</h2>

                {/* 
                  Using dangerouslySetInnerHTML because we are now generating holistic guides with 
                  HTML content for <span class="text-opta"> and inline <a class="app-link link-*"> 
                */}
                <div
                  className={`guide-prose text-text-secondary leading-relaxed ${isVisualFirst ? 'text-base' : 'text-lg'} [&_code]:text-[#06b6d4] [&_code]:bg-white/5 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:mx-0.5`}
                  dangerouslySetInnerHTML={{ __html: processBody(section.body) }}
                />

                {section.visual && (
                  <div className={`guide-visual visual-container w-full visual-stage-${phase} ${isVisualFirst ? 'guide-visual-primary' : ''}`}>
                    <div className="guide-visual-meta">
                      <span className="guide-visual-phase">{phase}</span>
                      <span className="guide-visual-title">{getSectionLabel(section.heading)}</span>
                    </div>
                    <div
                      className="guide-visual-canvas"
                      dangerouslySetInnerHTML={{ __html: processBody(section.visual) }}
                    />
                  </div>
                )}

                {section.note && (
                  <div className="guide-callout callout p-6 mt-2 flex gap-4 text-base">
                    <Info className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-2">
                      <p className="text-amber-500/90 leading-relaxed [&_code]:text-[#f59e0b] [&_code]:bg-[#f59e0b]/10 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:inline-block [&_code]:mx-1" dangerouslySetInnerHTML={{ __html: processBody(section.note) }} />
                    </div>
                  </div>
                )}

                {section.code && (
                  <div className="guide-code p-6 font-mono text-sm overflow-x-auto text-neon-green">
                    <pre><code>{section.code}</code></pre>
                  </div>
                )}
              </section>
            );
          })}

          <div className="h-32" />
        </main>
      </div>
    </div>
  );
}
