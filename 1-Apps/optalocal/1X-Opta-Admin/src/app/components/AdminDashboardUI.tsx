'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GuideRecord,
  GuideSection,
  WebsiteHealthSnapshot,
  WebsiteRuntimeStatus,
} from '../lib/types';

interface AdminDashboardUIProps {
  initialGuides: GuideRecord[];
  websites: WebsiteHealthSnapshot[];
}

function getStatusClasses(status: WebsiteRuntimeStatus): string {
  if (status === 'online') return 'bg-green-500/15 text-green-400 border-green-500/30';
  if (status === 'degraded') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

function appColorHex(app?: string): string {
  const normalized = app?.trim().toLowerCase();
  if (normalized === 'cli') return '#22c55e';
  if (normalized === 'accounts') return '#3b82f6';
  if (normalized === 'init') return '#f59e0b';
  if (normalized === 'lmx') return '#a855f7';
  if (normalized === 'status') return '#06b6d4';
  if (normalized === 'help') return '#94a3b8';
  return '#a855f7';
}

export function AdminDashboardUI({ initialGuides, websites }: AdminDashboardUIProps) {
  const router = useRouter();
  const [guides, setGuides] = useState(initialGuides);
  const [selectedGuide, setSelectedGuide] = useState<GuideRecord | null>(null);
  const [activeAppFilter, setActiveAppFilter] = useState('all');
  const [promoting, setPromoting] = useState<string | null>(null);

  const appFilters = useMemo(() => {
    const apps = new Set<string>();
    for (const guide of guides) {
      if (guide.app?.trim()) apps.add(guide.app.trim().toLowerCase());
    }
    return ['all', ...Array.from(apps).sort((a, b) => a.localeCompare(b))];
  }, [guides]);

  const filteredGuides = useMemo(() => {
    if (activeAppFilter === 'all') return guides;
    return guides.filter((guide) => guide.app?.trim().toLowerCase() === activeAppFilter);
  }, [guides, activeAppFilter]);

  async function handlePromote(slug: string): Promise<void> {
    setPromoting(slug);
    try {
      const response = await fetch('/api/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        alert(`Promotion failed: ${body.error ?? 'Unknown error'}`);
        return;
      }

      setGuides((current) =>
        current.map((guide) => (guide.slug === slug ? { ...guide, status: 'verified' } : guide))
      );
      setSelectedGuide((current) => (current && current.slug === slug ? { ...current, status: 'verified' } : current));
      router.refresh();
    } catch {
      alert('Network error during promotion.');
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative z-20 overflow-hidden text-sora">
      <header className="w-full border-b border-admin/20 bg-surface/80 backdrop-blur-3xl pt-12 relative z-20">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <h1 className="text-3xl md:text-4xl font-bold text-moonlight-admin">Opta Admin Website Operations</h1>
          <p className="text-text-secondary mt-2">
            Private control plane for managing Opta Local websites and the Opta Learn guide promotion pipeline.
          </p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-8 py-8 relative z-10 overflow-y-auto">
        <section className="glass border-admin/30 rounded-3xl p-6 mb-8 shadow-[0_0_40px_rgba(245,158,11,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-mono text-admin text-sm font-bold tracking-widest uppercase">Managed Website Fleet</h2>
            <span className="text-[10px] font-mono text-text-muted">
              Last checked {new Date(websites[0]?.checkedAt ?? Date.now()).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {websites.map((site) => (
              <div key={site.key} className="obsidian rounded-xl p-5 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{site.name}</h3>
                    <p className="text-xs text-text-muted font-mono mt-1">{site.path}</p>
                    <p className="text-sm text-text-secondary mt-2">{site.purpose}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className={`text-[10px] font-mono px-2 py-1 rounded border ${getStatusClasses(site.localStatus)}`}>
                      LOCAL: {site.localStatus.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-1 rounded border ${getStatusClasses(site.productionStatus)}`}
                    >
                      PROD: {site.productionStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={site.localUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono px-3 py-1.5 rounded-md border border-white/15 text-text-secondary hover:text-white hover:border-white/30 transition-colors"
                  >
                    Open Local
                  </a>
                  <a
                    href={`https://${site.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono px-3 py-1.5 rounded-md border border-admin/35 text-admin hover:bg-admin/10 transition-colors"
                  >
                    Open Production
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass border-admin/30 rounded-3xl p-6 mb-8 shadow-[0_0_40px_rgba(245,158,11,0.05)]">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="font-mono text-admin text-sm font-bold tracking-widest uppercase">Guide Index & Promotion Pipeline</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {appFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveAppFilter(filter)}
                  className={`text-[11px] font-mono px-3 py-1.5 rounded border transition-colors ${
                    activeAppFilter === filter
                      ? 'border-admin bg-admin/15 text-admin'
                      : 'border-white/10 text-text-secondary hover:text-white hover:border-white/30'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="obsidian rounded-xl overflow-hidden border border-admin/20">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-black/40 text-xs font-mono text-text-secondary uppercase tracking-wider">
              <div className="col-span-4">Guide Title</div>
              <div className="col-span-3">Source</div>
              <div className="col-span-2">App</div>
              <div className="col-span-1">Updated</div>
              <div className="col-span-2 text-right">Status / Action</div>
            </div>
            <div className="flex flex-col">
              {filteredGuides.map((guide) => {
                const isDraft = guide.status === 'draft';
                const rowClass = isDraft ? 'bg-admin/[0.03]' : '';
                const dotColor = isDraft
                  ? 'bg-admin shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                  : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]';

                return (
                  <div
                    key={guide.slug}
                    onClick={() => setSelectedGuide(guide)}
                    className={`guide-row grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 items-center cursor-pointer ${rowClass}`}
                  >
                    <div className={`col-span-4 font-bold ${isDraft ? 'text-white' : 'text-text-primary'} flex items-center gap-3`}>
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      {guide.title}
                    </div>
                    <div className="col-span-3 font-mono text-xs text-text-muted truncate">{guide.file ?? 'content/guides/unknown.ts'}</div>
                    <div className="col-span-2 font-mono text-xs text-text-secondary">{guide.app ?? 'general'}</div>
                    <div className="col-span-1 font-mono text-xs text-text-secondary">{guide.updatedAt ?? '-'}</div>
                    <div className="col-span-2 text-right">
                      {isDraft ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedGuide(guide);
                          }}
                          className="text-[10px] font-bold font-mono px-3 py-1.5 rounded-md bg-admin text-black hover:bg-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-colors"
                        >
                          REVIEW DRAFT
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold font-mono px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 border border-green-500/20">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredGuides.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-text-muted">No guides matched this app filter.</div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      {selectedGuide ? (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex flex-col pt-10 px-10 pb-4 transition-opacity">
          <div className="w-full max-w-7xl mx-auto h-full flex flex-col relative">
            <div className="pb-6 flex justify-between items-end border-b border-white/10 mb-8 w-full max-w-6xl mx-auto">
              <div>
                <div className="flex items-center gap-4 mb-3">
                  {selectedGuide.status === 'draft' ? (
                    <span className="bg-admin text-black font-bold font-mono text-[10px] px-2 py-1 rounded shadow-[0_0_10px_rgba(245,158,11,0.5)] tracking-widest">
                      DRAFT - REVIEW REQUIRED
                    </span>
                  ) : (
                    <span className="bg-green-500/20 text-green-500 border border-green-500/30 font-bold font-mono text-[10px] px-2 py-1 rounded">
                      PUBLISHED LIVE
                    </span>
                  )}
                  <p className="font-mono text-xs text-text-secondary tracking-widest">{selectedGuide.file ?? selectedGuide.slug}</p>
                </div>
                <h2 className="text-2xl font-bold text-moonlight">{selectedGuide.title}</h2>
              </div>
              <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                {selectedGuide.status === 'draft' ? (
                  <button
                    onClick={() => handlePromote(selectedGuide.slug)}
                    disabled={promoting === selectedGuide.slug}
                    className="bg-admin text-black font-bold font-mono text-sm px-8 py-3.5 rounded-xl hover:bg-yellow-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all disabled:opacity-50"
                  >
                    {promoting === selectedGuide.slug ? 'PROMOTING...' : 'APPROVE & PUBLISH TO MAIN'}
                  </button>
                ) : (
                  <a
                    href={`http://localhost:3007/guides/${selectedGuide.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-surface border border-white/20 text-white font-bold font-mono text-sm px-6 py-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  >
                    OPEN IN OPTA LEARN
                  </a>
                )}
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-all bg-black/50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-3xl border border-white/10 bg-void bg-dot-subtle shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative flex max-w-6xl mx-auto w-full overflow-hidden">
              <div className="flex-1 overflow-y-auto preview-scroll p-12 lg:p-20 pb-40">
                <div className="w-full max-w-4xl mx-auto">
                  <section id="preview-overview" className="flex flex-col gap-6 pt-8">
                    <div
                      className="inline-flex items-center gap-2 w-max px-3 py-1 text-xs font-mono border rounded uppercase tracking-wider mb-8"
                      style={
                        {
                          borderColor: `${appColorHex(selectedGuide.app)}40`,
                          color: appColorHex(selectedGuide.app),
                          backgroundColor: `${appColorHex(selectedGuide.app)}10`,
                        } as CSSProperties
                      }
                    >
                      {(selectedGuide.category ?? 'general')} Guide
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-moonlight mb-6">{selectedGuide.title}</h1>
                    <p className="text-xl text-text-secondary leading-relaxed mb-6">{selectedGuide.summary}</p>
                    <p className="text-xs font-mono text-text-muted mb-12">Updated {selectedGuide.updatedAt ?? 'Unknown'}</p>
                  </section>

                  <div>
                    {selectedGuide.sections.map((section: GuideSection, index: number) => (
                      <section
                        key={`${selectedGuide.slug}-${index}`}
                        id={`modal-sec-${index}`}
                        className="flex flex-col gap-8 pt-10 border-t border-white/10 border-l-[3px] border-l-transparent pl-8 -ml-[34px] transition-all duration-300 relative"
                      >
                        <h2 className="text-3xl font-semibold text-text-primary">{section.heading}</h2>
                        <div className="opta-md-body text-text-secondary leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: section.body }} />

                        {section.visual ? <div dangerouslySetInnerHTML={{ __html: section.visual }} /> : null}

                        {section.note ? (
                          <div className="callout p-6 mt-2 flex gap-4 text-base bg-surface border border-white/5 rounded-xl border-l-4 border-l-amber-500">
                            <svg
                              className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <p className="text-amber-500/90 leading-relaxed font-mono text-sm">{section.note}</p>
                          </div>
                        ) : null}

                        {section.code ? (
                          <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-6 font-mono text-sm overflow-x-auto shadow-inner text-green-400 mt-4 leading-relaxed tracking-wider">
                            <pre>
                              <code>{section.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                            </pre>
                          </div>
                        ) : null}
                      </section>
                    ))}
                    {selectedGuide.sections.length === 0 ? (
                      <section className="pt-10 border-t border-white/10">
                        <p className="text-text-secondary">No parsed section content found for this guide yet.</p>
                      </section>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
