import type { Guide } from './index';

export const accountsSync: Guide = {
  slug: 'accounts',
  title: 'Accounts Local Sync',
  app: 'accounts',
  category: 'feature',
  template: 'setting-configuration',
  summary:
    'Understand how Opta Accounts securely syncs your preferences and metadata without exposing your local data to the cloud.',
  tags: ['accounts', 'sync', 'security', 'preferences'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: '[Setup] What is Local Sync?',
      body: 'Opta Accounts provides federated identity and preference sync across your Opta ecosystem. Local Sync keeps sensitive execution payloads on-device while allowing account-level configuration continuity between machines. This means you can move between macOS and Windows environments with consistent identity and policy posture, without copying private project context into cloud storage.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="p-3 rounded-lg border border-[#3b82f6]/35 bg-[#3b82f6]/10">
      <div class="text-[#93c5fd] uppercase tracking-wider">Cloud scope</div>
      <div class="mt-2 text-white">identity + preferences</div>
    </div>
    <div class="p-3 rounded-lg border border-[#22c55e]/35 bg-[#22c55e]/10">
      <div class="text-[#86efac] uppercase tracking-wider">Local scope</div>
      <div class="mt-2 text-white">prompts + traces + code</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Configuration] Data Boundary Rules',
      body: 'Allowed sync scope includes profile metadata, non-sensitive preference state, and policy version pointers. Disallowed scope includes private prompts, repo contents, raw tool outputs, and model reasoning traces. In practice, this boundary should be reviewed as part of onboarding so teams understand exactly which settings are portable and which data remains machine-local by design.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Allowed</div>
      <ul class="mt-2 space-y-1 text-text-secondary">
        <li>• profile metadata</li>
        <li>• preferences</li>
        <li>• policy pointers</li>
      </ul>
    </div>
    <div class="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
      <div class="text-[#fca5a5] uppercase tracking-wider">Disallowed</div>
      <ul class="mt-2 space-y-1 text-text-secondary">
        <li>• private prompts</li>
        <li>• repository payloads</li>
        <li>• reasoning traces</li>
      </ul>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Operation] Use Cases',
      body: 'Primary use case is consistent behavior across devices without leaking project IP. For example, you can keep identity/session routing aligned while each machine keeps its private local context isolated. A common flow is: sign in on primary device, validate baseline behavior, then sign in on secondary device and verify preference parity before executing any sensitive workload.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">1. Sign in primary machine</div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">2. Verify baseline behavior</div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">3. Sync to secondary machine</div>
  </div>
</div>`,
    },
    {
      heading: '[Troubleshooting] Under the Hood',
      body: 'The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> daemon authenticates with encrypted tokens, then performs bounded sync operations for approved metadata only. Runtime execution remains local to your daemon + <a href="/guides/lmx" class="app-link link-lmx">LMX</a> stack. If synchronization appears stale, verify account session status first, then inspect daemon logs for rejected sync scopes or expired token state.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
    <span class="px-3 py-1 rounded border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#93c5fd]">Auth token</span>
    <span class="text-text-muted">→ bounded sync</span>
    <span class="px-3 py-1 rounded border border-white/20 bg-white/[0.03] text-white">Daemon policy</span>
    <span class="text-text-muted">→ runtime local</span>
    <span class="px-3 py-1 rounded border border-[#a855f7]/30 bg-[#a855f7]/10 text-[#c4b5fd]">LMX</span>
  </div>
</div>`,
    },
    {
      heading: '[Optimization] Configuration & Verification',
      body: 'Use CLI commands to inspect and enforce sync policy. Always verify effective config after toggling so you can confirm policy took effect. For production-grade reliability, add this check to your device setup checklist and re-run after policy updates so account behavior remains deterministic across the full Opta stack.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-4 font-mono text-xs">
    <div class="text-[#67e8f9] uppercase tracking-wider">Verification loop</div>
    <div class="mt-2 grid grid-cols-3 gap-2 text-text-secondary">
      <div class="rounded bg-white/5 p-2">Inspect</div>
      <div class="rounded bg-white/5 p-2">Enforce</div>
      <div class="rounded bg-white/5 p-2">Re-check</div>
    </div>
  </div>
</div>`,
      code: 'opta config view\nopta config set sync.enabled true\nopta status',
      note: 'Treat sync enablement as policy configuration, not a blind convenience toggle.',
    },
  ],
};
