# Opta Init — Ecosystem Context

## optalocal.com Platform

Opta Init is one node in the optalocal.com multi-app platform for LLM optimization and development.

```
optalocal.com (platform root)
├── init.optalocal.com     <- THIS APP — onboarding + downloads
├── lmx.optalocal.com      <- Opta Local dashboard (1L-Opta-LMX-Dashboard)
└── [future subdomains]
```

## Apps This Site Serves (Downloads + Onboarding)

| App | Path | Role |
|-----|------|------|
| Opta Init Desktop Manager | /desktop-manager (1O) | Single install/discovery surface for stack management |

## Apps Managed Through Opta Init Manifests

| App | Path | Role |
|-----|------|------|
| Opta CLI | 1D-Opta-CLI-TS | Agentic coding CLI |
| Opta LMX | 1M-Opta-LMX | Local inference daemon |
| Opta Code | 1P-Opta-Code-Universal | Desktop coding surface |
| Opta Daemon | core service | Runtime orchestration daemon |

## App This Site Links To (Dashboard CTA)

| App | URL | Role |
|-----|-----|------|
| Opta Local (web) | lmx.optalocal.com | LMX dashboard + chat |

## App This Site Links To (Account CTA)

| App | URL | Role |
|-----|-----|------|
| Opta Accounts | accounts.optalocal.com | Account and identity management |

## Data Contracts

Runtime relationships are contract-driven:
- Static links (download URLs pointing to GitHub Releases)
- Static links (dashboard CTA to lmx.optalocal.com)
- mDNS network-discovery contract:
  - Service type: `_opta-lmx._tcp.local.`
  - Shared connection store: `~/.config/opta/lmx-connections.json`
  - Reference: `docs/NETWORK-DISCOVERY.md`

## What Opta Init Does NOT Overlap With

| App | Why no overlap |
|-----|---------------|
| lmx.optalocal.com | Dashboard, model management, chat — not here |
| optamize.biz | macOS app, different product entirely |
| OptaPlus | Bot client, Telegram replacement — not relevant |
