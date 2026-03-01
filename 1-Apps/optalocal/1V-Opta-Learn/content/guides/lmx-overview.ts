import type { Guide } from './index';

export const lmxOverview: Guide = {
  slug: 'lmx-overview',
  title: 'Getting Started with LMX',
  app: 'lmx',
  category: 'getting-started',
  summary:
    'Learn how to use the LMX dashboard to load models, run inference, and manage your local AI server.',
  tags: ['lmx', 'dashboard', 'inference', 'models', 'server', 'getting started'],
  updatedAt: '2026-03-01',
  sections: [
    {
      heading: 'What is LMX?',
      body: 'LMX is the inference engine at the core of Opta Local. It runs an OpenAI-compatible API on your machine, serves models via MLX on Apple Silicon, and provides a dashboard for monitoring and managing inference.',
    },
    {
      heading: 'The Dashboard',
      body: 'Access the LMX dashboard at lmx.optalocal.com. From here you can see loaded models, VRAM usage, throughput, and active sessions. The dashboard connects to your local LMX server running on port 1234.',
    },
    {
      heading: 'Loading a Model',
      body: 'Navigate to the Models tab in the LMX dashboard. Models are stored locally in your HuggingFace cache. Select a model from the list and click Load — it will be pulled into unified memory and made available via the API.',
      note: 'LMX uses MLX format (safetensors) on Apple Silicon for best performance. GGUF is not supported on this backend.',
    },
    {
      heading: 'Running Inference',
      body: 'Once a model is loaded, use the Chat tab to test it directly, or send requests to the OpenAI-compatible endpoint at http://localhost:1234/v1/chat/completions from any compatible client.',
      code: 'curl http://localhost:1234/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"current","messages":[{"role":"user","content":"Hello"}]}\'',
    },
  ],
};
