# Phase 6: optalocal.com Cloud Sync — Design Document

> Validated design from brainstorming session 2026-02-19

## Summary

Evolve the existing Opta Local web app into a cloud-connected platform at **optalocal.com**, adding Supabase Auth, device registration, and full session/message sync while preserving the existing LAN-only experience for unauthenticated users.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Off-LAN UX | Cloud dashboard + tunnel connect | See devices from anywhere, connect via Cloudflare Tunnel |
| Device pairing | OAuth from device | Like `gh auth login` — device opens browser, user signs in |
| Sync scope | Full sync including messages | Cross-device session continuity |
| App identity | Evolve existing app | Single codebase, dual-mode (HTTPS = cloud, HTTP = LAN) |
| Device roles | Workstation can also be Helper Node | `helper_enabled` boolean + `helper_config` jsonb |
| Auth provider | Supabase Auth (shared project) | Same Opta identity across Life, Local, Gateway |

## Architecture

### Dual-Mode Detection

```
HTTPS (optalocal.com) → Cloud mode → Auth required → Tunnel transport
HTTP  (localhost:3004) → LAN mode  → Auth optional → Direct transport
```

### New Supabase Tables

See `001_cloud_sync.sql` migration for full schema.

### Implementation Phases

A (Auth Shell) → B (Device Registry) → C (Session Sync) → D (Cross-Device) → E (Helper Cloud Config)
