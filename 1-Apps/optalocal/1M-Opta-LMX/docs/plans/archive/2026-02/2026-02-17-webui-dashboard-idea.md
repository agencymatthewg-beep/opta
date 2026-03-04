---
status: review
---

# Opta LMX WebUI Dashboard — Future Plan

**Status:** Idea captured, not yet designed or implemented
**Date:** 2026-02-17
**Priority:** Deferred

---

## Concept

A web dashboard hosted on optamize.biz that connects to a user's local Opta LMX instance, providing:

- **Model inventory** — View all available/loaded models with performance profiles (like the `/gu` guide cards but live)
- **Configuration** — Edit settings, defaults, KV cache params, TTL, speculative decoding pairs
- **Preset management** — Create/edit/delete model presets with performance profiles
- **Stats & benchmarks** — Live memory usage, tokens/sec, TTFT, request counts, model load times
- **Admin controls** — Load/unload models, trigger benchmarks, view logs

## Key Design Questions (to resolve during brainstorming)

1. **Connection model** — How does a hosted web app reach a user's local LMX? Options: direct LAN (local-only), Cloudflare Tunnel, WebSocket relay, or local-only (serve UI from LMX itself)
2. **Tech stack** — Next.js (matches monorepo pattern) vs lightweight SPA (Vite + React, no SSR needed)
3. **Auth** — Is auth needed if local-only? Token-based if exposed?
4. **Real-time** — WebSocket for live stats vs polling admin endpoints
5. **Scope** — Dashboard only, or also include a chat playground?

## Existing API Surface to Consume

The LMX backend already exposes everything needed:

- `GET /v1/models` — List loaded models
- `POST /v1/chat/completions` — Inference (streaming + non-streaming)
- `POST /v1/embeddings` — Embedding generation
- `POST /v1/messages` — Anthropic format
- `POST /admin/load` / `POST /admin/unload` — Model lifecycle
- `GET /admin/memory` — Memory stats
- `GET /admin/presets` — List presets
- `GET /admin/presets/{name}` — Single preset detail
- `GET /health` — Health check
- `WS /ws/chat` — WebSocket chat

## Visual Inspiration

The `/gu` performance optimization guide (screenshots in brainstorming request) shows the model card layout with Opta obsidian glass aesthetic — the WebUI should use this same design language but interactive and live.

## Prerequisites Before Starting

- [ ] Decide connection model (local-only vs hosted)
- [ ] Add any missing admin endpoints (benchmark trigger, config read/write, log streaming)
- [ ] Run brainstorming skill to finalize design
- [ ] Write implementation plan with writing-plans skill
