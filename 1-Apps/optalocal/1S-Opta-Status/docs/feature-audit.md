# OptaLocal Feature Registry Audit

Generated: 2026-03-03T19:46

| App | Complete | Pending | Total | Completion | Risk | Top gaps |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| accounts | 11 | 1 | 12 | 91.7% | Low | Subscription management — Stripe integration for Opta Plus |
| admin | 3 | 5 | 8 | 37.5% | High | Restricted access controls and role-based operations; Audit trail export and incident context; Private admin API and health endpoints +2 more |
| cli | 54 | 3 | 57 | 94.7% | Low | Diagnostics in TUI; Code actions via LSP; MCP server health monitoring |
| code-desktop | 33 | 2 | 35 | 94.3% | Low | Auto-update — in-app update mechanism; Code signing — Apple Developer ID signing |
| help | 8 | 1 | 9 | 88.9% | Medium | Markdown rendering — parsed and styled documentation pages |
| init | 23 | 0 | 23 | 100.0% | Low |  |
| learn | 15 | 2 | 17 | 88.2% | Medium | Personalized knowledge tracking per user profile; Versioned guide changelog with migration notes |
| lmx | 29 | 4 | 33 | 87.9% | Medium | LoRA adapter loading; Function calling (tool_use); Auto-tune quantization per model size +1 more |
| local-web | 27 | 8 | 35 | 77.1% | Medium | File attachments — image and document upload; Multimodal input — paste screenshots for vision models; Session search — filter by content or date +5 more |
| status | 16 | 0 | 16 | 100.0% | Low |  |

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
- Close remaining gaps in `local-web` first: highest gap volume.
- Close pending items in `accounts`/`help`/`learn` with highest confidence first.
- Add a production `/api/health` for Opta Admin; currently using root probe fallback as placeholder.
