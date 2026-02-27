# Browser Runtime 24h Canary + Rollback Drill Runbook
Date: 2026-02-23
Owner: Opta Runtime

## Objective
Capture production-safe canary evidence for browser runtime quality over a 24-hour window and record rollback rehearsal outcome in a deterministic artifact.

## Preconditions
1. Browser runtime feature flags are set for canary scope only.
2. High-risk approval gates remain enabled.
3. Host allow/block policy is configured and verified.
4. Artifact writing is enabled (`metadata.json`, `steps.jsonl`, `recordings.json`, `visual-diff-manifest.jsonl`).

## Canary Evidence Capture
1. Run:
```bash
/browser canary 24
```
2. Verify output includes:
- `overall=pass|fail`
- `sessions=<n>`
- `rollback_drill=pending`
- paths for `latest` and timestamped `snapshot`.
3. Evidence file location:
- `.opta/browser/canary-evidence/latest.json`
- `.opta/browser/canary-evidence/<timestamp>.json`

## Rollback Drill Recording
1. Execute rollback rehearsal using the live procedure:
- disable auto routing,
- restart daemon/session boundary,
- verify no orphan runtime sessions.
2. Record drill outcome:
```bash
/browser canary rollback pass Rehearsal completed in 3m
```
or
```bash
/browser canary rollback fail <reason>
```
3. Verify `latest.json` includes:
- `rollbackDrill.status`
- `rollbackDrill.executedAt`
- `rollbackDrill.notes`

## Pass Criteria
1. `overallStatus` is `pass`.
2. `rollbackDrill.status` is `pass`.
3. No unresolved high-risk approvals remain in queue.

## Escalation Criteria
1. Any canary evidence `overallStatus=fail`.
2. Any rollback drill `status=fail`.
3. Any policy bypass or missing audit artifact.

