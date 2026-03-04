'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AdminAuditOutcome,
  AdminOpsSnapshot,
  GuideRecord,
  GuideSection,
  PromoteApiResponse,
  PromotionPolicy,
  StatusIntegrationState,
  WebsiteHealthSnapshot,
  WebsiteRuntimeStatus,
} from '../lib/types';

interface AdminDashboardUIProps {
  initialGuides: GuideRecord[];
  websites: WebsiteHealthSnapshot[];
  promotionPolicy: PromotionPolicy;
  adminOps: AdminOpsSnapshot;
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

function getIntegrationStatusClasses(status: StatusIntegrationState): string {
  if (status === 'online') return 'bg-green-500/15 text-green-400 border-green-500/30';
  if (status === 'degraded' || status === 'checking') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (status === 'unconfigured' || status === 'unknown') return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

function getAuditOutcomeClasses(outcome: AdminAuditOutcome): string {
  if (outcome === 'success') return 'bg-green-500/15 text-green-400 border-green-500/30';
  if (outcome === 'attempt') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function formatPromotionLockLabel(policy: PromotionPolicy): string {
  if (policy.allowAll) return 'PROMOTION OPEN';
  if (policy.allowedSlugs.length === 1 && policy.allowedSlugs[0] === 'cli') {
    return 'PROMOTION LOCKED (CLI MASTERCLASS ONLY)';
  }
  if (policy.allowedSlugs.length === 0) return 'PROMOTION LOCKED';
  return `PROMOTION LOCKED (${policy.allowedSlugs.join(', ').toUpperCase()} ONLY)`;
}

function isPromoteApiResponse(value: unknown): value is PromoteApiResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PromoteApiResponse>;
  return typeof candidate.message === 'string' && typeof candidate.promoted === 'boolean';
}

export function AdminDashboardUI({
  initialGuides,
  websites,
  promotionPolicy,
  adminOps,
}: AdminDashboardUIProps) {
  const router = useRouter();
  const [guides, setGuides] = useState(initialGuides);
  const [selectedGuide, setSelectedGuide] = useState<GuideRecord | null>(null);
  const [activeAppFilter, setActiveAppFilter] = useState('all');
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promotionFeedback, setPromotionFeedback] = useState<PromoteApiResponse | null>(null);

  const allowedPromotionSlugs = useMemo(() => {
    return new Set(promotionPolicy.allowedSlugs.map((slug) => normalizeSlug(slug)));
  }, [promotionPolicy.allowedSlugs]);

  const promotionLockLabel = useMemo(() => {
    return formatPromotionLockLabel(promotionPolicy);
  }, [promotionPolicy]);

  function canPromoteGuide(guide: GuideRecord): boolean {
    if (guide.status !== 'draft') return false;
    if (promotionPolicy.allowAll) return true;
    return allowedPromotionSlugs.has(normalizeSlug(guide.slug));
  }

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

  const recentActions = useMemo(() => adminOps.actions.slice(0, 10), [adminOps.actions]);

  async function handlePromote(slug: string): Promise<void> {
    setPromoting(slug);
    setPromotionFeedback(null);
    try {
      const response = await fetch('/api/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      const payload = (await response.json()) as unknown;
      if (!isPromoteApiResponse(payload)) {
        setPromotionFeedback({
          outcome: 'error',
          mode: 'fallback',
          promoted: false,
          slug,
          message: response.ok ? 'Promotion response was invalid.' : 'Promotion failed with an invalid response body.',
          error: 'INVALID_PROMOTION_RESPONSE',
        });
        return;
      }
      setPromotionFeedback(payload);

      if (payload.promoted) {
        setGuides((current) =>
          current.map((guide) => (guide.slug === slug ? { ...guide, status: 'verified' } : guide))
        );
        setSelectedGuide((current) =>
          current && current.slug === slug ? { ...current, status: 'verified' } : current
        );
        router.refresh();
      }
    } catch {
      setPromotionFeedback({
        outcome: 'error',
        mode: 'fallback',
        promoted: false,
        slug,
        message: 'Network error during promotion.',
        error: 'NETWORK_ERROR',
      });
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative z-20 overflow-hidden text-text-primary">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-[0.08] blur-[100px] pointer-events-none rounded-b-[100%] transition-colors duration-1000 z-10"
        style={{ backgroundColor: appColorHex(activeAppFilter === 'all' ? 'learn' : activeAppFilter) }}
      ></div>

      <header className="w-full border-b border-admin/20 bg-surface/80 backdrop-blur-3xl pt-12 relative z-20">
        <div className="flex justify-center items-end px-12 gap-2 h-20">
          <button
            onClick={() => setActiveAppFilter('all')}
            className={`nav-link flex flex-col items-center gap-2 px-8 py-3 pb-4 outline-none border-b-2 transition-all group ${
              activeAppFilter === 'all' ? 'border-admin bg-admin/10' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <svg width="40" height="40" viewBox="0 0 210 210" fill="none" className={`shrink-0 transition-transform ${activeAppFilter === 'all' ? 'text-admin scale-110' : 'text-white/50'}`}>
              <circle cx="105" cy="105" r="90" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <g className="anim-ring" style={{ animation: 'spin 8s linear infinite' }}>
                <ellipse cx="105" cy="105" rx="52" ry="23" stroke="currentColor" strokeWidth="2" className="opacity-80" transform="rotate(-30 105 105)" />
                <circle cx="53" cy="105" r="6" fill="currentColor" transform="rotate(-30 105 105)" />
                <circle cx="157" cy="105" r="6" fill="currentColor" transform="rotate(-30 105 105)" />
              </g>
              <g transform="translate(105, 105)">
                <circle cx="0" cy="0" r="10" fill="currentColor" className="opacity-30" />
                <circle cx="0" cy="0" r="4" fill="#ffffff" className="opacity-90" />
              </g>
            </svg>
            <div className={`hidden sm:block font-bold text-xs text-center transition-colors ${activeAppFilter === 'all' ? 'text-admin' : 'text-white/50 group-hover:text-white'}`}>
              Global Index
            </div>
          </button>
          
          <button
            onClick={() => setActiveAppFilter('lmx')}
            className={`nav-link flex flex-col items-center gap-2 px-8 py-3 pb-4 outline-none border-b-2 transition-all group ${
              activeAppFilter === 'lmx' ? 'border-[#a855f7] bg-[#a855f7]/10' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <svg width="40" height="40" viewBox="0 0 210 210" fill="none" className={`shrink-0 transition-transform ${activeAppFilter === 'lmx' ? 'text-[#a855f7] scale-110' : 'text-[#a855f7]/50'}`}>
              <circle cx="105" cy="105" r="90" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <g className="anim-ring-rev" style={{ animation: 'spin 9s linear infinite reverse' }}>
                <ellipse cx="105" cy="105" rx="52" ry="23" stroke="currentColor" strokeWidth="2" className="opacity-80" transform="rotate(-30 105 105)" />
                <circle cx="53" cy="105" r="5" fill="currentColor" transform="rotate(-30 105 105)" />
                <circle cx="157" cy="105" r="5" fill="currentColor" transform="rotate(-30 105 105)" />
              </g>
              <g transform="translate(105, 105)">
                <path d="M0 -18 L18 0 L0 18 L-18 0 Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" className="opacity-90" />
              </g>
            </svg>
            <div className={`hidden sm:block font-bold text-xs text-center transition-colors ${activeAppFilter === 'lmx' ? 'text-[#a855f7]' : 'text-white/50 group-hover:text-white'}`}>
              Opta LMX
            </div>
          </button>

          <button
            onClick={() => setActiveAppFilter('cli')}
            className={`nav-link flex flex-col items-center gap-2 px-8 py-3 pb-4 outline-none border-b-2 transition-all group ${
              activeAppFilter === 'cli' ? 'border-[#22c55e] bg-[#22c55e]/10' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <svg width="40" height="40" viewBox="0 0 210 210" fill="none" className={`shrink-0 transition-transform ${activeAppFilter === 'cli' ? 'text-[#22c55e] scale-110' : 'text-[#22c55e]/50'}`}>
              <circle cx="105" cy="105" r="90" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <g className="anim-ring" style={{ animation: 'spin 6s linear infinite' }}>
                <ellipse cx="105" cy="105" rx="52" ry="23" stroke="currentColor" strokeWidth="2" className="opacity-80" transform="rotate(-30 105 105)" />
                <circle cx="53" cy="105" r="8" fill="currentColor" transform="rotate(-30 105 105)" />
              </g>
              <g transform="translate(105, 105)">
                 <rect x="-12" y="-12" width="24" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
                 <path d="M-6 -6 L0 0 L-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                 <line x1="2" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </svg>
            <div className={`hidden sm:block font-bold text-xs text-center transition-colors ${activeAppFilter === 'cli' ? 'text-[#22c55e]' : 'text-white/50 group-hover:text-white'}`}>
              Opta CLI
            </div>
          </button>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-mono text-admin text-sm font-bold tracking-widest uppercase">Ops Audit & Status Integration</h2>
            <span className="text-[10px] font-mono text-text-muted">
              Snapshot {new Date(adminOps.generatedAt).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="obsidian rounded-xl p-5 border border-white/10">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Status API Probe</h3>
                <span className={`text-[10px] font-mono px-2 py-1 rounded border ${getIntegrationStatusClasses(adminOps.statusProbe.status)}`}>
                  {adminOps.statusProbe.status.toUpperCase()}
                </span>
              </div>

              <p className="text-sm text-text-secondary mb-3">
                Live check against <span className="font-mono text-text-primary">status.optalocal.com/api/health/admin</span>.
              </p>
              <p className="text-xs font-mono text-text-muted">
                Latency: {adminOps.statusProbe.latencyMs != null ? `${adminOps.statusProbe.latencyMs}ms` : 'n/a'} | Checked{' '}
                {new Date(adminOps.statusProbe.checkedAt).toLocaleTimeString()}
              </p>
              {adminOps.statusProbe.error ? (
                <p className="mt-2 text-xs font-mono text-red-300">{adminOps.statusProbe.error}</p>
              ) : null}

              <div className="mt-5 pt-4 border-t border-white/10">
                <h4 className="text-xs font-mono uppercase tracking-wider text-text-secondary">Feature Registry Snapshot</h4>
                <p className="mt-2 text-sm text-text-secondary">
                  {adminOps.featureRegistry.complete ?? '-'} complete / {adminOps.featureRegistry.total ?? '-'} total (
                  {adminOps.featureRegistry.completion ?? 'n/a'})
                </p>
                <p className="text-xs font-mono text-text-muted mt-1">
                  Risk: {adminOps.featureRegistry.risk ?? 'n/a'} | Source: {adminOps.featureRegistry.source}
                </p>
                {adminOps.featureRegistry.topGaps.length > 0 ? (
                  <p className="text-xs text-text-muted mt-2">
                    Top gap: {adminOps.featureRegistry.topGaps[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="obsidian rounded-xl p-5 border border-white/10">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Recent Admin Actions</h3>
                <span className="text-[10px] font-mono text-text-muted">{recentActions.length} records</span>
              </div>

              <div className="space-y-2">
                {recentActions.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-text-secondary">{entry.action}</span>
                      <span className={`text-[10px] font-mono px-2 py-1 rounded border ${getAuditOutcomeClasses(entry.outcome)}`}>
                        {entry.outcome.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-primary">{entry.message}</p>
                    <p className="mt-1 text-[10px] font-mono text-text-muted">
                      {new Date(entry.createdAt).toLocaleTimeString()} | {entry.slug ?? 'n/a'} | {entry.requestId}
                    </p>
                  </div>
                ))}
                {recentActions.length === 0 ? (
                  <p className="text-sm text-text-muted">No admin actions recorded in this runtime yet.</p>
                ) : null}
              </div>
            </div>
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
                    onClick={() => {
                      setPromotionFeedback(null);
                      setSelectedGuide(guide);
                    }}
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
                            setPromotionFeedback(null);
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
                  !canPromoteGuide(selectedGuide) ? (
                    <span className="bg-zinc-800 text-zinc-300 font-bold font-mono text-sm px-8 py-3.5 rounded-xl border border-zinc-700">
                      {promotionLockLabel}
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePromote(selectedGuide.slug)}
                      disabled={promoting === selectedGuide.slug}
                      className="bg-admin text-black font-bold font-mono text-sm px-8 py-3.5 rounded-xl hover:bg-yellow-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all disabled:opacity-50"
                    >
                      {promoting === selectedGuide.slug ? 'PROMOTING...' : 'APPROVE & PUBLISH TO MAIN'}
                    </button>
                  )
                ) : (
                  <a
                    href={`https://learn.optalocal.com/guides/${selectedGuide.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-surface border border-white/20 text-white font-bold font-mono text-sm px-6 py-3 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  >
                    OPEN IN OPTA LEARN
                  </a>
                )}
                <button
                  onClick={() => {
                    setPromotionFeedback(null);
                    setSelectedGuide(null);
                  }}
                  className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-all bg-black/50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {selectedGuide.status === 'draft' && promotionFeedback ? (
              <div className="w-full max-w-6xl mx-auto mb-6 rounded-xl border border-white/10 bg-surface/70 px-5 py-4">
                <p className="text-sm font-semibold text-text-primary">{promotionFeedback.message}</p>
                {promotionFeedback.error ? (
                  <p className="mt-1 text-[11px] font-mono text-text-muted">Code: {promotionFeedback.error}</p>
                ) : null}
                {promotionFeedback.nextSteps?.length ? (
                  <div className="mt-3 space-y-3">
                    {promotionFeedback.nextSteps.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
                        <p className="text-xs font-mono text-admin uppercase tracking-wider">{step.title}</p>
                        <p className="mt-1 text-sm text-text-secondary">{step.detail}</p>
                        {step.command ? (
                          <pre className="mt-2 overflow-x-auto rounded bg-black/60 px-3 py-2 text-[11px] font-mono text-green-400">
                            <code>{step.command}</code>
                          </pre>
                        ) : null}
                        {step.url ? (
                          <a
                            href={step.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-mono text-admin hover:text-yellow-300"
                          >
                            Open Link
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

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
