import type { Guide } from './index';

export const optaLocalIntro: Guide = {
  slug: 'opta-local-intro',
  title: 'What is Opta Local?',
  app: 'general',
  category: 'getting-started',
  summary:
    'An overview of the Opta Local ecosystem — what it is, why it exists, and how the apps fit together.',
  tags: ['overview', 'intro', 'getting started', 'opta local', 'ecosystem'],
  updatedAt: '2026-03-01',
  sections: [
    {
      heading: 'Overview',
      body: 'Opta Local is a private AI infrastructure stack designed to run entirely on your own hardware. Inference, data, and compute stay on your machine — no cloud dependencies for AI processing.',
    },
    {
      heading: 'The Core Apps',
      body: 'The ecosystem is built around three primary apps: LMX (inference engine and dashboard), CLI (command-line interface for developers), and Accounts (identity and sync management). Together they form a complete local AI stack.',
    },
    {
      heading: 'Why Local?',
      body: 'Running models locally means your prompts, responses, and data never leave your hardware. You control the model, the context, and the compute. No per-token billing, no rate limits, no data retention policies.',
    },
    {
      heading: 'Getting Started',
      body: 'Begin with Opta Init at init.optalocal.com — it walks you through setting up LMX on your machine and gets your first model running.',
      note: 'Opta Local currently supports Apple Silicon (M1–M4 Ultra), NVIDIA (CUDA), and AMD (ROCm) hardware.',
    },
  ],
};
