# Opta Init — Ecosystem Context

## optalocal.com Platform

Opta Init is one node in the optalocal.com multi-app platform for LLM optimization and development.

```
optalocal.com (platform root)
├── init.optalocal.com     <- THIS APP — onboarding + downloads
├── lmx.optalocal.com      <- Opta Local dashboard (1L-Opta-Local/web)
└── [future subdomains]
```

## Apps This Site Serves (Downloads + Onboarding)

| App | Path | Role |
|-----|------|------|
| Opta CLI | 1D-Opta-CLI-TS | Agentic coding CLI — MacBook -> Mac Studio |
| Opta LMX | 1M-Opta-LMX | Local inference daemon — Apple Silicon |

## App This Site Links To (Dashboard CTA)

| App | URL | Role |
|-----|-----|------|
| Opta Local (web) | lmx.optalocal.com | LMX dashboard + chat |

## App This Site Links To (Account CTA)

| App | URL | Role |
|-----|-----|------|
| Opta Accounts | accounts.optalocal.com | Account and identity management |

## Data Contracts

No runtime data contracts. All relationships are:
- Static links (download URLs pointing to GitHub Releases)
- Static links (dashboard CTA to lmx.optalocal.com)

## What Opta Init Does NOT Overlap With

| App | Why no overlap |
|-----|---------------|
| lmx.optalocal.com | Dashboard, model management, chat — not here |
| optamize.biz | macOS app, different product entirely |
| OptaPlus | Bot client, Telegram replacement — not relevant |
