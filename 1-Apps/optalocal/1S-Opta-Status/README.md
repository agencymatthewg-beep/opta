# 1S-Opta-Status

Canonical path: `1-Apps/optalocal/1S-Opta-Status`

## Purpose

Service and release status dashboard for Opta Local products.

## Local Development

```bash
cd <optalocal-root>/1S-Opta-Status
npm install
npm run dev
```

## Validation

```bash
npm run check
```

## Build and Start

```bash
npm run build
npm run start
```

## Health Probe Environment

- `OPTA_LMX_HEALTH_URL` should point to a health-only tunnel hostname that only forwards `/healthz`.
- `OPTA_LMX_TUNNEL_URL` remains supported as a legacy fallback.
