import type { Guide } from './index';

export const accountsSync: Guide = {
  slug: 'accounts-sync',
  title: 'Accounts Local Sync',
  app: 'accounts',
  category: 'feature',
  summary: 'Understand how Opta Accounts securely syncs your preferences and metadata without exposing your local data to the cloud.',
  tags: ['accounts', 'sync', 'security', 'preferences'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'What is Local Sync?',
      body: 'Opta Accounts provides a federated identity and preference layer for your Opta ecosystem. Local Sync ensures that while your overarching identity and access control metrics are centrally managed via <a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>, all sensitive inference logs and codebase interactions remain strictly on your local hardware.'
    },
    {
      heading: 'Use Cases',
      body: 'Local Sync is primarily used for propagating non-sensitive configuration states across your machines. This includes custom system prompts, authorized tool schemas, and high-level usage telemetry required for licensing, while maintaining an air-gap for your proprietary code.'
    },
    {
      heading: 'Under the Hood',
      body: 'The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> daemon authenticates via an encrypted token exchange. When Local Sync is enabled, the daemon performs periodic unidirectional pulls to fetch global state configurations without pushing any local session payload to the cloud.'
    },
    {
      heading: 'Usage & Configuration',
      body: 'You can verify your current sync status and identity mapping directly through the CLI.',
      code: `opta config view\nopta config set sync.enabled true`
    }
  ],
};
