# Opta Local Features

Opta Local (`1L-Opta-Local`) is the web dashboard and chat interface for the LMX inference server.

## Chat Interface

- [x] Streaming chat — token-by-token output via SSE
- [x] LMX model selection — choose loaded model from dropdown
- [x] Message history — persistent session conversation view
- [x] Stop generation — cancel in-flight inference
- [x] Code block rendering — syntax-highlighted code in responses
- [ ] File attachments — image and document upload
- [ ] Multimodal input — paste screenshots for vision models

## Dashboard

- [x] LMX connection status — live health indicator
- [x] Throughput metrics — tokens/sec via circular buffer (300 samples)
- [x] Active model display — currently loaded model name and size
- [x] Memory gauge — Metal GPU memory usage from `/admin/health`
- [x] Helper node status — embedding and reranking service health
- [x] SSE event stream — real-time dashboard updates from `/admin/events`

## Session Management

- [x] Session list — browse and resume past sessions
- [x] Session creation — start new sessions with model selection
- [x] Session deletion — remove individual sessions
- [ ] Session search — filter by content or date
- [ ] Session export — download conversation as Markdown

## Authentication Modes

- [x] LAN mode — no auth required on local network
- [x] Cloud mode — Supabase auth via magic link / Google OAuth
- [x] Auth provider — `useAuthSafe()` returns null in LAN mode (no-op)
- [x] Sign-in page — redirect flow with sanitized `next` param
- [x] Session persistence — Supabase session cookie management

## Settings

- [x] General settings — theme and display preferences
- [x] Tunnel configuration — Cloudflare Tunnel URL for remote access
- [x] Account settings — sign in / sign out, plan display
- [x] LMX endpoint override — custom LMX server URL

## iOS App

- [x] iOS project foundation — SwiftUI app scaffold
- [ ] Chat interface — native SwiftUI chat view
- [ ] LMX connection — iOS-to-LAN API client
- [ ] Session sync — shared sessions with web

## Infrastructure

- [x] Vercel deployment — web app on optalocal.com
- [x] Cloudflare Tunnel — LAN services exposed for cloud access
- [x] Supabase auth — cloud-mode authentication backend
- [ ] Service worker — offline capability

## Recent Updates

- 2026-02-26 — Production readiness improvements
- 2026-02-25 — Session management and dashboard improvements
- 2026-02-23 — Cloudflare Tunnel config and LAN/cloud mode separation
- 2026-02-19 — Phase 5 sessions implementation complete
