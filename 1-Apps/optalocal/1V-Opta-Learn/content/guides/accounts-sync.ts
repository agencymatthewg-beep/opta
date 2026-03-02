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
      heading: 'What is Local Sync?',
      body: 'Opta Accounts provides federated identity and preference sync across your Opta ecosystem. Local Sync keeps sensitive execution payloads on-device while allowing account-level configuration continuity between machines.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-void"><div class="grid grid-cols-2 gap-4 text-xs font-mono"><div class="p-3 rounded border border-[#3b82f6]/30">Cloud: identity + prefs</div><div class="p-3 rounded border border-[#22c55e]/30">Local: prompts + traces + code</div></div></div>`,
    },
    {
      heading: 'Data Boundary Rules',
      body: 'Allowed sync scope includes profile metadata, non-sensitive preference state, and policy version pointers. Disallowed scope includes private prompts, repo contents, raw tool outputs, and model reasoning traces.',
    },
    {
      heading: 'Use Cases',
      body: 'Primary use case is consistent behavior across devices without leaking project IP. For example, you can keep identity/session routing aligned while each machine keeps its private local context isolated.',
    },
    {
      heading: 'Under the Hood',
      body: 'The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> daemon authenticates with encrypted tokens, then performs bounded sync operations for approved metadata only. Runtime execution remains local to your daemon + <a href="/guides/lmx" class="app-link link-lmx">LMX</a> stack.',
    },
    {
      heading: 'Configuration & Verification',
      body: 'Use CLI commands to inspect and enforce sync policy. Always verify effective config after toggling so you can confirm policy took effect.',
      code: 'opta config view\nopta config set sync.enabled true\nopta status',
      note: 'Treat sync enablement as policy configuration, not a blind convenience toggle.',
    },
  ],
};
