# Opta Help

User-facing documentation website for the Opta Local private AI stack.

## Identity

- **URL:** help.optalocal.com
- **Owner:** Opta Operations (optamize.biz)
- **Stack:** Next.js 16, React 19, Tailwind v3, Framer Motion, Lucide React
- **Export:** Static (no API routes)
- **Port:** 3006 (dev)

## Scope

Comprehensive user guides for:
- Opta CLI (commands, configuration, slash commands)
- Opta Daemon (setup, API, event streaming)
- Opta LMX (local inference server, model management)
- Opta Local Web (dashboard, chat, model picker)
- Opta Code Desktop (session management, daemon lifecycle)
- Browser Automation (tools, recording, guardrails)
- Security & Permissions (policy engine, approval workflow)
- Developer Guide (MCP integration, API reference)

## Build

```bash
npm install
npm run dev     # http://localhost:3006
npm run build   # Static export to out/
```
