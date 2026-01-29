# Phase 4: Chat Core - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<vision>
## How This Should Work

Clean and minimalistic by default. The chat interface stays quiet and uncluttered for normal text exchanges — messages flow naturally without visual noise.

When rich content arrives (graphs, GenUI components, images, visualizations, large text blocks), the interface adapts. Message bubbles resize fluidly to fit the content type. A text response stays compact; a graph stretches wide; an image fills appropriately. This expansion feels natural, not jarring — the container molds to the content.

The overall experience should feel like Linear or Raycast: keyboard-first, minimal chrome, developer-focused. Fast interactions, no visual clutter, commands feel native. This isn't Telegram with bot menus everywhere — it's a focused conversation interface where the content is the star.

</vision>

<essential>
## What Must Be Nailed

All three are foundational — no single part can feel off:

- **Message flow feels instant** — Send → response must feel seamless, no perception of lag
- **Visual clarity** — Easy to scan conversation, immediately clear who said what
- **Input experience** — Typing and sending feels natural and responsive

</essential>

<specifics>
## Specific Ideas

- **Adaptive bubbles** — Message containers resize based on content type, not fixed widths
- **Linear/Raycast aesthetic** — Keyboard-first, minimal chrome, developer-focused feel
- **Strategic expansion** — Rich content (graphs, images, visualizations) expands inline within the adaptive bubble
- **Clean default** — Text messages stay compact and scannable

</specifics>

<notes>
## Additional Context

This is the first user-facing phase. Everything before (Foundation, Connection, Protocol) was infrastructure. Now we build what people actually see and interact with.

The chat replaces Telegram for Clawdbot communication — it needs to feel like a native app, not a web wrapper or bot interface.

</notes>

---

*Phase: 04-chat-core*
*Context gathered: 2026-01-30*
