# Opta Help

User-facing documentation website for Opta, with operational documentation centered on Opta Local as the first public release.

## Identity

- **URL:** help.optalocal.com
- **Owner:** Opta Operations (optamize.biz)
- **Stack:** Next.js 16, React 19, Tailwind v3, Framer Motion, Lucide React
- **Export:** Static (no API routes)
- **Port:** 3006 (dev)

## Scope

Comprehensive user guides for:
- Opta brand and Opta AI activation model (runtime source -> Opta AI -> CLI/Code)
- Ecosystem & Synergies (runtime layer vs web surfaces, change-impact workflow)
- Opta Accounts (auth, SSO, sync, troubleshooting)
- Opta Status (service cards, release notes, feature-state interpretation)
- Opta CLI (commands, configuration, slash commands)
- Opta Daemon (setup, API, event streaming)
- Opta LMX (local inference server, model management)
- Opta Local Web (dashboard, chat, model picker)
- Opta Code Desktop (session management, daemon lifecycle)
- Browser Automation (tools, recording, guardrails)
- Security & Permissions (policy engine, approval workflow)
- Developer Guide (MCP integration, API reference)

## Canonical Narrative

- **Opta:** the optimisation business/platform.
- **Opta AI:** the optimizer users interact with.
- **Opta Local:** first public release for activating and running Opta AI.
- **Activation path:** local Opta LMX runtime or cloud model runtime powers Opta AI, then execution occurs in Opta CLI and Opta Code.

## Build

```bash
npm install
npm run dev     # http://localhost:3006
npm run build   # Static export to out/
```

Canonical taxonomy: `../docs/PRODUCT-MODEL.md` (Opta Local = 3 core apps; websites are surfaces).
