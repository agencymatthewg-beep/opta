# Opta Local — Decision Log

> Every significant technical decision, with reasoning and alternatives considered.
> **Append-only.** Never delete entries. If a decision is reversed, add a new entry.

---

## How to Use This File

**Before making a decision:** Check if it's already been decided here.
**After making a decision:** Add an entry with date, decision, alternatives, and reasoning.
**If reversing a decision:** Don't delete the old entry — add a new one that references it.

---

## Decisions

| # | Date | Decision | Alternatives Considered | Reasoning |
|---|------|----------|------------------------|-----------|
| 1 | 2026-02-18 | Web-first execution | Parallel platform builds from day one | Faster iteration cycles and tighter feedback loops during early validation |
| 2 | 2026-02-18 | Next.js 16 + React 19 for Web | SvelteKit, plain Vite React, Remix | Ecosystem consistency with other Opta web apps, @opta/ui is React-based |
| 3 | 2026-02-18 | Maintain web-only delivery scope | Add parallel native app track | Keeps implementation effort focused on one production surface |
| 4 | 2026-02-18 | Direct browser→LMX (no backend) | Add a proxy server, BFF pattern | Simpler architecture, LMX already serves HTTP, avoids extra deployment |
| 5 | 2026-02-18 | Single-surface project scaffold | Split code/docs by multiple client surfaces | Reduced complexity and lower maintenance overhead |
| 6 | 2026-02-18 | All 13 ideas as Active requirements | Shortlisted 5 only, all 22 from pipeline | Captures full vision while phased roadmap controls what gets built when |
| 7 | 2026-02-18 | Cloudflare Tunnel for WAN access | Tailscale, WireGuard, port forwarding | Free tier, zero-config on client, E2E encrypted, proven in OptaPlus |
| 8 | 2026-02-18 | `/frontend-design` skill mandatory for all UI | Optional, only for complex components | Ensures premium design consistency across the web surface |
| 9 | 2026-02-18 | Location: 1-Apps/1L-Opta-Local/ | Separate repo, inside Opta-LMX | Follows monorepo convention, shares @opta packages, next letter sequence |
| 10 | 2026-02-20 | Prioritize web hardening before scope expansion | Expand client-surface scope immediately | Stabilizing quality gates and deployment first reduced coordination overhead |
| 11 | 2026-02-28 | Canonical path contract: use `1-Apps/optalocal/1L-Opta-Local/` in docs/tooling | Keep alias path (`1-Apps/1L-Opta-Local`) as canonical | `1-Apps/PATH-CONTRACT.md` defines domain-folder canonical paths; aliases are compatibility only and must not be the source of truth |

---

### Decision #4: No Intermediate Backend

**Date:** 2026-02-18
**Context:** Web apps typically need a backend for API key security and CORS. Opta Local connects to a server on your own network.
**Options:**
1. **Direct browser→LMX** — Browser talks directly to Mac Studio via HTTP. Pros: Simple, no extra deployment. Cons: Admin key in client, CORS configuration needed on LMX.
2. **BFF (Backend-for-Frontend)** — Next.js API routes proxy to LMX. Pros: Hides admin key server-side. Cons: Adds deployment complexity, latency, and a new failure point.
3. **Edge proxy** — Cloudflare Workers proxy. Pros: No self-hosted backend. Cons: Adds Cloudflare dependency for LAN access.
**Decision:** Option 1 — Direct connection
**Reasoning:** This is a single-user app on a private network. The admin key is "protecting" your own server from yourself. CORS can be configured on LMX. Avoiding a backend keeps the architecture simple and eliminates an entire deployment target.
**Consequences:** Must encrypt admin key in localStorage. Must configure CORS on LMX server.

---

*Updated — 2026-02-20*

| 12 | 2026-02-28 | Remove unused secondary-client scaffolding and standardize web-only scope | Keep deferred secondary-client track in-repo | Reduces ambiguity and maintenance overhead |
