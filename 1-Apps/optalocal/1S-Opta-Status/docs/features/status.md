# Opta Status Features

Opta Status (`1S-Opta-Status`) provides real-time health monitoring and feature completeness tracking for the Opta Local ecosystem.

## Health Monitoring

- [x] Service status overview — live operational state of apps
- [x] LMX reference instance monitoring — configured via `OPTA_LMX_HEALTH_URL` (legacy fallback: `OPTA_LMX_TUNNEL_URL`) and reported as online/degraded/offline
- [x] Daemon reference instance monitoring — configured via `OPTA_DAEMON_TUNNEL_URL` and reported as online/degraded/offline
- [x] Management websites tracking — Opta Local (optalocal.com), Init, Accounts, Help, Learn, and Admin
- [x] Priority policy: when management websites drift, those are treated as highest-priority repair tasks before single-surface feature work
- [x] Auto-refresh — polling every 30 seconds for live updates
- [ ] Route caching policy alignment — route currently forces `no-store` per upstream probe for freshness

## Feature Registry

- [x] Global progress tracking — aggregated feature completion metrics
- [x] Per-app feature lists — parsed markdown checklists
- [x] Visual indicators — CSS-styled checkboxes and progress bars

## Release Notes

- [x] Automated generation — compiled from CLI and LMX update logs
- [x] Markdown parsing — frontmatter extraction and bullet summarization
- [x] Categorization — model runtime vs stack sync updates

## Aesthetic & UI

- [x] Opta Ring component — animated CSS ambient singularity effect
- [x] Dark mode first — void background with neon indicators
- [x] Responsive layout — optimized for desktop and mobile

## Recent Updates

-  — 

## Auto-Synced Features
- [x] Feature:

<!-- opta-sync-applied: 0009-final-vercel-test -->
