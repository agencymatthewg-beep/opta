# 0006 — LMX Dashboard: Sidebar Nav + 5 New Feature Pages

**Date:** 2026-03-04
**Target:** LMX Dashboard (`lmx.optalocal.com`)
**Commit:** 9288dc83

## What Changed

### New: Persistent Sidebar Navigation

- `components/DashboardLayout.tsx` — new shared layout wrapping all pages
- Sidebar groups: **Core** (Overview, Models, Chat) · **Intelligence** (Agents, Skills, Knowledge, Audio) · **Observability** (Metrics, Benchmark, Sessions, Logs, Diagnostics) · **System** (Settings)
- Active route highlighting via `usePathname()`

### New Pages Added

| Route | Page | Key Features |
|-------|------|-------------|
| `/audio` | Audio | TTS (voice selector, playback) + STT (mic recorder + file upload) |
| `/rag` | Knowledge Base | Collection browser, document ingest, semantic search with scored results |
| `/skills` | Skills & MCP | Split-panel skill list + MCP tools tab + JSON execution playground |
| `/agents` | Agents | Create/cancel agent runs, run cards with progress bar + status filter |
| `/logs` | Logs | Session/Update log file browser with full content viewer |

### Updated

- `app/page.tsx` — overview now wrapped in `DashboardLayout`; old header removed; SSE lifecycle hooks moved to layout

## Impact

- **Critical gap resolved** — all 5 previously invisible LMX features now have navigation and UI
- **Build verification:** ✓ Compiled successfully (Next.js 16 Turbopack, 1447ms)
- **Commit:** 9288dc83 | **Branch:** main
