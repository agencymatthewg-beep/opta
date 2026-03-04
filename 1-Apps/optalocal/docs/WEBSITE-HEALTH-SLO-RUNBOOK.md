---
title: Website Health SLO + Incident Runbook
type: operations-runbook
status: active
last_updated: 2026-03-04
---

# Website Health SLO + Incident Runbook

## Scope

- Website surfaces: `optalocal.com`, `init.optalocal.com`, `lmx.optalocal.com`, `accounts.optalocal.com`, `status.optalocal.com`, `help.optalocal.com`, `learn.optalocal.com`, `admin.optalocal.com`.
- Monitoring inputs: uptime probes, health endpoint probes, synthetic user journeys, and latency telemetry.
- Status-proxy probes (synthetic): `/api/health/admin`, `/api/health/lmx`, `/api/health/lmx-site`, `/api/health/daemon`.
- Purpose: detect incidents quickly, restore service fast, and protect error budget.

## SLI Definitions

| SLI | Definition | Window |
|---|---|---|
| Availability | `successful web checks (2xx/3xx) / total web checks` | rolling 30 days |
| Health endpoint success | `2xx health probe responses / total health probes` | rolling 30 days |
| Synthetic pass rate | `passed synthetic runs / total synthetic runs` | rolling 30 days |
| Latency | `p95 response time` for key pages + APIs | 5m, 1h, 30d views |

## SLO Targets and Alert Thresholds

| SLI | SLO Target | Warning Alert | Critical Alert |
|---|---|---|---|
| Availability | >= 99.90% (30d) | < 99.95% over 6h | < 99.50% over 1h or < 99.00% over 5m |
| Health endpoint success | >= 99.95% (30d) | > 1% failures over 15m | > 3% failures over 10m |
| Synthetic pass rate | >= 99.50% (30d) | 2 consecutive failures in 1 region | 2 consecutive failures in 2+ regions |
| Latency p95 | page <= 1500ms, API <= 750ms | p95 > 2000ms over 15m | p95 > 3000ms over 10m or p99 > 5000ms |

Error budget reference:
- 99.90% monthly availability budget = 43m 12s downtime per 30 days.

## Severity Matrix

| Severity | User Impact | Typical Trigger | Response SLA |
|---|---|---|---|
| SEV-1 | Full outage or major user lockout | Home/help/status unavailable in multiple regions | Acknowledge <= 5m, incident channel immediately |
| SEV-2 | Major degradation with partial availability | Elevated 5xx/timeout rates or synthetic failures across regions | Acknowledge <= 15m, coordinated mitigation |
| SEV-3 | Limited degradation or localized issue | Single-region failures, elevated latency, non-core path issues | Acknowledge <= 4h (business hours) |
| SEV-4 | No current user impact | Alert noise, threshold tuning, documentation gaps | Next business day |

## Escalation Path

1. Primary on-call (web/platform) acknowledges and starts triage.
2. If unresolved after 10 minutes (SEV-1/2), page secondary on-call.
3. If unresolved after 20 minutes (SEV-1) or 30 minutes (SEV-2), assign Incident Commander and notify product/leadership stakeholders.
4. Escalate to external provider support (DNS/CDN/hosting) when root cause is outside local control.
5. Communication cadence: SEV-1 every 15 minutes, SEV-2 every 30 minutes until stable.

## Triage Checklist

1. Confirm alert validity (not a monitor outage/noise).
2. Classify severity with current blast radius.
3. Check current status for:
   - uptime probes
   - health endpoints
   - synthetic checks
   - latency and 5xx spikes
4. Identify recent changes (deploys, config, DNS, certs, dependencies).
5. Apply fastest safe mitigation (rollback, traffic shift, feature flag off, scale up).
6. Post first status update with impact, owner, next update time.
7. Track timeline and decisions in incident notes.

## Rollback Checklist

1. Identify last known good release/version.
2. Validate rollback compatibility (DB/config/schema backward-safe).
3. Freeze new deploys while rollback is running.
4. Execute rollback via standard release mechanism.
5. Verify recovery:
   - health endpoint returns 2xx
   - synthetic journeys pass in primary regions
   - latency and error rates normalize
6. Keep elevated monitoring for at least 30 minutes.
7. Close incident only after stability window and stakeholder update.

## Operational Cadence

Daily:
- Review overnight alerts and unresolved warnings.
- Check SLO dashboard and error budget burn.
- Verify synthetic monitor coverage for key user paths.
- Confirm on-call handoff and contact readiness.

Weekly:
- Review SLO trend and alert quality (false positive/negative rate).
- Review incidents and action items from the past week.
- Run one rollback readiness drill (tabletop or staging).
- Update this runbook if thresholds, ownership, or systems changed.
