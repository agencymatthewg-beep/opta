import type { Guide } from './index';

/**
 * DEEP-DIVE TEMPLATE
 * Use this structure when creating new guides for Opta Local apps (like LMX or Accounts).
 * It enforces a high standard for narrative depth and rich visual "GenUI" widgets.
 */
export const deepDiveTemplate: Guide = {
    slug: 'feature-name',
    title: 'Feature Name Masterclass',
    app: 'general', // Update with target app (lmx, cli, accounts, init)
    category: 'feature',
    template: 'feature-deep-dive',
    summary: 'A short 1-2 sentence hook explaining what this feature is and why it matters.',
    tags: ['feature', 'deep-dive', 'template'],
    updatedAt: '2026-03-03',
    sections: [
        {
            heading: '1. Ecosystem Role & Architecture',
            body: 'Start by explaining where this feature sits in the broader Opta Local ecosystem. How does it interact with the CLI, LMX, or the browser?',
            visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0f] text-center">
        <div class="text-text-muted text-sm">[Insert visual architectural diagram here using Tailwind & raw HTML/SVG]</div>
      </div>`
        },
        {
            heading: '2. Core Mechanics & Modes',
            body: 'Break down the primary ways users interact with this feature. Contrast different modes if applicable (e.g., synchronous vs asynchronous, chat vs do).',
            note: 'Use a note block to provide commands or quick tips for triggering these mechanics.'
        },
        {
            heading: '3. State & Introspection (Visual Feedback)',
            body: 'Explain how the user can introspect the state of this feature. How do they know what the AI or system is doing? Show a visual representation of the UI they will see.',
            visual: `<div class="visual-wrapper my-8 bg-void border border-white/10 rounded-xl p-4">
        <div class="text-[10px] text-text-muted font-mono">[Insert a rich representation of a TUI, Dashboard, or Terminal execution log here]</div>
      </div>`
        },
        {
            heading: '4. Advanced Capabilities & Edge Cases',
            body: 'Push the boundary. Detail the power-user workflows. How does this feature handle errors, massive scale, or complex orchestration? Examples: multi-agent swarms, RAG context caching, CEO mode.',
            code: `// Provide a code snippet or terminal command demonstrating the advanced usage\nopta do --advanced --flag`
        },
        {
            heading: '5. Integration Points',
            body: 'How does it connect to other ecosystem pillars? E.g., How does this feature utilize Opta Accounts for identity, or Atpo for code review?'
        },
        {
            heading: 'Conclusion: The Overall Purpose',
            body: 'Summarize the overarching goal of this feature or application. Explain how all the individual pieces detailed above combine to solve a core developer problem—transforming raw components into a cohesive, zero-latency local development powerhouse.',
            visual: `<div class="visual-wrapper my-8 relative rounded-xl border border-white/20 bg-void p-8 text-center text-white">
        <h3 class="font-bold text-lg mb-4">[The Ultimate Synthesized Value Proposition]</h3>
        <p class="text-text-muted text-sm">[A visual capstone tying the ecosystem together, perhaps a badge or a summary matrix.]</p>
      </div>`
        }
    ]
};
