# OptaLocal Feature Registry Audit

Generated: 2026-03-04T14:05

| App | Complete | Pending | Total | Completion | Risk | Top gaps |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| accounts | 11 | 1 | 12 | 91.7% | Low | Subscription management — Stripe integration for Opta Plus |
| admin | 6 | 5 | 11 | 54.5% | High | Restricted access controls and role-based operations; Audit trail export and incident context; Status + feature-registry integration +2 more |
| cli | 57 | 0 | 57 | 100.0% | Low |  |
| code-desktop | 33 | 2 | 35 | 94.3% | Low | Auto-update — in-app update mechanism; Code signing — Apple Developer ID signing |
| help | 8 | 1 | 9 | 88.9% | Medium | Markdown rendering — parsed and styled documentation pages |
| init | 23 | 0 | 23 | 100.0% | Low |  |
| learn | 15 | 2 | 17 | 88.2% | Medium | Personalized knowledge tracking per user profile; Versioned guide changelog with migration notes |
| lmx | 29 | 5 | 34 | 85.3% | Medium | Reference LMX endpoint can be degraded when the local service is offline; LoRA adapter loading; Function calling (tool_use) +2 more |
| local-web | 26 | 9 | 35 | 74.3% | High | Missing `/api/health` endpoint keeps status degraded under strict health probing; File attachments — image and document upload; Multimodal input — paste screenshots for vision models +6 more |
| status | 15 | 1 | 16 | 93.8% | Low | Route caching policy alignment — route currently probes upstream with `no-store` for freshness |

## App mapping (status registry)
- `cli` -> `1D-Opta-CLI-TS`
- `code-desktop` -> `1P-Opta-Code-Universal`
- `lmx` -> `1M-Opta-LMX`
- `local-web` -> `1T-Opta-Home`
- `init` -> `1O-Opta-Init`
- `accounts` -> `1R-Opta-Accounts`
- `help` -> `1U-Opta-Help`
- `learn` -> `1V-Opta-Learn`
- `admin` -> `1X-Opta-Admin`
- `status` -> `1S-Opta-Status`

## Recommended priority actions
- Keep production LMX + Daemon references stable and verify daemon/lmx probe latency SLOs.
- Maintain reachable production `/api/health` in Opta Admin and guard against regression in CI.
- Add local-web `/api/health` endpoint (or align health route policy) to clear strict degraded status.
- Keep release-note metadata and feature-audit totals regenerated on each status deploy.
