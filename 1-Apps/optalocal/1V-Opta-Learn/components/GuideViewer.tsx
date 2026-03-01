'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Search, ChevronLeft, Info } from 'lucide-react';
import type { AppSlug, Category, Guide, GuideSection } from '@/content/guides';
import { appColors, appLabels } from '@/content/guides';

export function GuideViewer({ guide }: { guide: Guide }) {
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
    if (title.includes('Opta')) {
      return (
        <>
          <span className="text-opta">Opta</span> {title.replace('Opta ', '')}
        </>
      );
    }
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
    <div className="min-h-screen bg-void flex flex-col font-sora">
      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 glass-nav px-6 py-3 flex items-center justify-between border-b border-white/5">
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
        <aside className="w-72 fixed h-[calc(100vh-72px)] border-r border-white/10 p-8 hidden lg:flex flex-col gap-8 overflow-y-auto z-40 bg-void/80 backdrop-blur-md">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">Guide Navigation</span>
            <h2 className="text-lg font-semibold text-text-primary leading-snug">
              {renderTitle(guide.title)}
            </h2>
          </div>
          
          <nav className="flex flex-col text-sm font-medium border-l border-white/10">
            <a href="#overview" className="toc-link active" data-target="overview">1. Overview</a>
            {guide.sections.map((section, idx) => {
              const id = `section-${idx}`;
              return (
                <a key={id} href={`#${id}`} className="toc-link" data-target={id}>
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
        <main className="flex-1 lg:ml-72 p-8 md:p-12 lg:p-24 max-w-4xl flex flex-col gap-24 relative">
          
          <section id="overview" className="flex flex-col gap-6 pt-8">
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
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-moonlight mb-2">
              {renderTitle(guide.title)}
            </h1>
            
            <p className="text-xl text-text-secondary leading-relaxed">
              {guide.summary}
            </p>
            
            <p className="text-xs font-mono text-text-muted">Updated {guide.updatedAt}</p>
          </section>

          {guide.sections.map((section, idx) => {
            const id = `section-${idx}`;
            return (
              <section key={id} id={id} className="flex flex-col gap-8 pt-8 border-t border-white/10">
                <h2 className="text-3xl font-semibold text-text-primary">{section.heading}</h2>
                
                {/* 
                  Using dangerouslySetInnerHTML because we are now generating holistic guides with 
                  HTML content for <span class="text-opta"> and inline <a class="app-link link-*"> 
                */}
                <div 
                  className="text-text-secondary leading-relaxed text-lg flex flex-col gap-6"
                  dangerouslySetInnerHTML={{ __html: processBody(section.body) }}
                />
                
                {section.note && (
                  <div className="callout p-6 mt-2 flex gap-4 text-base bg-surface border border-white/5 rounded-xl border-l-4 border-l-amber-500">
                    <Info className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-2">
                      <p className="text-amber-500/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: processBody(section.note) }} />
                    </div>
                  </div>
                )}

                {section.code && (
                  <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-6 font-mono text-sm overflow-x-auto shadow-inner text-neon-green">
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
