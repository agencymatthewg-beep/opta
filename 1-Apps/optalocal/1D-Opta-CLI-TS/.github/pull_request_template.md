## Summary

- Change:
- Why:
- Risk level: `low` / `medium` / `high`

## Parity IDs (required)

<!-- REQUIRED: include every impacted parity ID (example formats: P0-CLI-001, G07, PARITY-RECONNECT-02). -->

- [ ] I listed all impacted parity IDs.
- Parity IDs:
  - ``
- Mapping (ID -> test/validation evidence):
  - ``

## Visual Evidence (required when output/UI/TUI changes)

<!-- REQUIRED for visual changes: provide before/after screenshots or terminal captures. -->

| Surface | Before | After |
| ------- | ------ | ----- |
| CLI/TUI |        |       |

## Performance Delta (required)

<!-- REQUIRED: include exact commands, machine context, baseline, candidate, and delta. -->

- Benchmark command(s):
  - ``
- Environment (mac model / CPU / RAM):
  - ``
- Baseline (main or commit SHA):
  - ``
- Candidate (this branch):
  - ``
- Metrics (latency, throughput, memory, etc.):
  - Before:
  - After:
  - Delta:
- [ ] Delta is within accepted threshold or exception is documented.

## Rollback Plan (required)

<!-- REQUIRED: provide executable rollback steps, not general intent. -->

1.
2.
3.

## Validation Checklist

- [ ] `/Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/.github/workflows/parity-macos-codex.yml` passes.
- [ ] New/updated tests cover behavioral changes.
- [ ] Any remaining TODOs are linked to tracked follow-up work.
