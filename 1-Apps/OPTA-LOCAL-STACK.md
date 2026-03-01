# Opta Local Stack

**Last updated:** 2026-02-28

## Components

| Component | Path | Role |
|---|---|---|
| Opta CLI | `1D-Opta-CLI-TS/` | TUI + daemon runtime (`opta chat`, `opta do`, `opta daemon`) |
| Opta LMX | `1M-Opta-LMX/` | Local inference server (`/v1/chat/completions`, `/v1/chat/stream`) |
| Opta Local Web | `1L-Opta-Local/web/` | Browser client + dashboard, now with daemon connector support |

## Current Architecture (Level 3)

```text
opta tui / opta do / opta chat
        │
        ▼
opta daemon (127.0.0.1:<dynamic>, token-auth)
        │
        ├─ /v3/* HTTP control plane
        ├─ /v3/ws WebSocket event plane
        └─ /v1/chat compatibility shim
                │
                ▼
Opta LMX (192.168.188.11:1234 default)
  ├─ /v1/chat/stream (WS, bidirectional + cancel)
  └─ /v1/chat/completions (SSE/JSON)
```

## Integration Notes

- CLI daemon owns session orchestration, queueing, permissions, and event persistence.
- LMX remains the inference backend; daemon now prefers WS streaming where available.
- Web app now includes daemon client transport scaffold at:
  - `1L-Opta-Local/web/src/lib/opta-daemon-client.ts`

## Runtime Defaults

- Daemon bind target: `127.0.0.1:9999` preferred.
- Port fallback window: `10000-10020` when 9999 is unavailable.
- Auth: per-daemon local session token.
- LMX default endpoint: `http://192.168.188.11:1234`.

## Operational Commands

```bash
# CLI / daemon
cd ~/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS
npm run dev -- daemon start
npm run dev -- daemon status
npm run dev -- chat --tui

# Web
cd ~/Synced/Opta/1-Apps/optalocal/1L-Opta-Local/web
npm run dev
```

## Host Policy (Critical)

- **Opta48 (MacBook) is client-only** for models.
- Do **not** run local inference hosting (`python -m opta_lmx`) on Opta48.
- Do **not** store local model artifacts on Opta48.
- Inference host is **Mono512** (192.168.188.11:1234).
- If you need to operate LMX directly, do it on Mono512, not Opta48.


## Focus Areas

1. Full daemon stability under long-running streaming/tool workloads.
2. Strict compatibility lock for existing CLI automation.
3. Shared terminal + web session attach with deterministic multi-writer semantics.
