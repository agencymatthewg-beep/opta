# SUPABASE SLOs + Alerts (Opta)

Service scope: shared Supabase auth/data plane for Opta apps (`1P`, `1D`, `1M`, `1F`, `1E`, `1L`).

## SLO Set

## 1) Auth Availability SLO

- **Definition:** successful sign-in/session refresh requests / total auth requests
- **Target:** >= 99.9% over rolling 30 days
- **Alert threshold:**
  - Warning: < 99.95% (1h window)
  - Critical: < 99.9% (1h window)

## 2) API Latency SLO (p95)

- **Definition:** p95 latency for critical Supabase-backed API paths (accounts/profile/devices/api-keys)
- **Target:** p95 <= 450ms (rolling 24h)
- **Alert threshold:**
  - Warning: p95 > 450ms for 15m
  - Critical: p95 > 800ms for 10m

## 3) Error Rate SLO

- **Definition:** HTTP 5xx + auth failures not caused by invalid user credentials
- **Target:** <= 0.5% over rolling 24h
- **Alert threshold:**
  - Warning: > 1.0% for 10m
  - Critical: > 2.0% for 5m

## 4) Migration Safety SLO

- **Definition:** migrations applied without rollback/incident
- **Target:** 100% per calendar month
- **Alert threshold:** any failed migration on shared project => immediate incident

---

## Alert Routing

- **Primary:** Matthew (Platform)
- **Secondary:** Opta on-call
- **Severity routing:**
  - Warning: async triage within 60 min
  - Critical: immediate incident channel + runbook activation

## Playbooks by Alert Type

- Auth availability breach → follow `SUPABASE-INCIDENT-RUNBOOK.md` (Auth outage path)
- Latency breach → inspect DB load/query patterns, pause non-critical jobs, verify indexes
- Error-rate breach → segment by endpoint/app (`1D` vs `1M` vs `1F/1E`), mitigate hottest failure first
- Migration alert → freeze deploys, assess rollback vs forward-fix

---

## Instrumentation Baseline

Minimum telemetry required:

- Auth success/failure counters by app surface
- Endpoint latency histograms (p50/p95/p99)
- 4xx/5xx counters by endpoint and client (`cli`, `lmx`, `web`, `ios`)
- Migration event log (start, success, fail, duration)

## Daily/Weekly/Monthly Ops Cadence

- **Daily (owner: Matthew):** review overnight alerts + auth smoke outcome
- **Weekly (owner: Matthew):** review burn-rate trends and noisy alerts
- **Monthly (owner: Matthew + backup):** re-tune thresholds using real distributions and incident learnings

## Error Budget Policy

- Monthly auth availability budget: `0.1%` downtime/error budget
- If budget consumption > 50% by mid-month:
  - Freeze non-essential schema changes
  - Prioritize reliability fixes over new feature work
- If budget consumption > 80% anytime:
  - Reliability sprint mandatory until stabilized

## Validation Command Pack

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1N-Opta-Cloud-Accounts
./tests/cross-app-auth-smoke.sh
supabase migration list
```

Use this pack as mandatory verification before declaring incidents resolved.
