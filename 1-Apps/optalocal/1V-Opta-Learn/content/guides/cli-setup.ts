import type { Guide } from './index';

export const cliSetup: Guide = {
  slug: 'cli-setup',
  title: 'Setting Up Opta CLI',
  app: 'cli',
  category: 'getting-started',
  summary:
    'Install and configure the Opta CLI for running AI workflows, agents, and browser automation from the terminal.',
  tags: ['cli', 'terminal', 'install', 'setup', 'command line'],
  updatedAt: '2026-03-01',
  sections: [
    {
      heading: 'What is Opta CLI?',
      body: 'The Opta CLI is a TypeScript-based command-line tool for running AI workflows, browser automation, and agent orchestration. It connects to your local LMX server or falls back to configured cloud providers.',
    },
    {
      heading: 'Installation',
      body: 'Install via npm globally or per-project. The CLI is available as opta-cli in the npm registry.',
      code: 'npm install -g @opta/cli',
    },
    {
      heading: 'Connecting to LMX',
      body: 'By default the CLI looks for a local LMX server at http://localhost:1234. Configure this with the OPTA_LMX_URL environment variable or via the config file.',
      code: 'export OPTA_LMX_URL=http://localhost:1234',
    },
  ],
};
