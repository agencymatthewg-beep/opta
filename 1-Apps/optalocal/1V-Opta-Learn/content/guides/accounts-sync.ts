import type { Guide } from './index';

export const accountsSync: Guide = {
  slug: 'accounts-sync',
  title: 'Accounts & Sync Explained',
  app: 'accounts',
  category: 'feature',
  summary:
    'Understand how Opta Accounts works, what syncs to the cloud, and how you control each capability.',
  tags: ['accounts', 'sync', 'cloud', 'identity', 'supabase', 'privacy'],
  updatedAt: '2026-03-01',
  sections: [
    {
      heading: 'The Three Layers',
      body: 'Opta Local has three data layers: inference (always local — never syncs), session data (local-first, syncs to cloud only what you choose), and identity (auth and device registry via Accounts).',
    },
    {
      heading: 'What You Control',
      body: 'In the Accounts portal you can individually opt in or out of syncing: Chat History, Model Presets, App Settings, and Custom Instructions. API keys and inference data never leave your device.',
      note: 'Sync is powered by Supabase. Your data is encrypted in transit and at rest. Opta does not use your data for training.',
    },
    {
      heading: 'Device Registry',
      body: 'When you sign in, your device is registered in the Accounts system. This lets you manage which machines can access which capabilities and revoke access remotely.',
    },
  ],
};
