import type { Guide } from './index';

export const optaAccountsGU: Guide = {
  slug: 'opta-accounts',
  title: 'Opta Accounts Masterclass',
  app: 'accounts',
  category: 'feature',
  template: 'gu-masterclass',
  format: 'gu',
  guFile: 'gu-guides/opta-accounts.html',
  summary:
    'Complete guide to the Opta auth ecosystem — OAuth flows, cross-domain SSO, ' +
    'AES-256 vault encryption, device pairing, bridge worker, and OpenClaw identity.',
  tags: ['accounts', 'oauth', 'supabase', 'sso', 'vault', 'encryption', 'bridge', 'openclaw'],
  sections: [],
  updatedAt: '2026-03-06',
};
