# Opta Ecosystem Audit Scope (2026-03)

## In-scope systems
- `~/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS`
- `~/Synced/Opta/1-Apps/optalocal/1M-Opta-LMX`
- `~/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal`

## Audit objectives
1. Map inter-service contracts and ownership boundaries.
2. Identify stale/dead/duplicate code and contract drift.
3. Produce runtime baseline and regression risks (non-destructive checks only).
4. Prioritize remediation by reliability risk and impact/effort.

## Constraints followed
- Read-only analysis by default.
- No deploys.
- No production config mutation.
- Canonical Synced paths only.

## Method
### Static checks
- Repo inventory, file/LOC concentration, TODO/FIXME scan.
- Duplicate artifact/content hash analysis.
- Dead export heuristic (`ts-prune`) for TS packages.
- Cross-repo protocol path/version scan (`/v3/*` vs `/v1/*`).

### Runtime checks (safe)
- Type checks and focused contract/parity test suites.
- No service restarts, no daemon lifecycle mutations.

## Exact commands used (evidence)
```bash
# inventory + file scans
ls -la ~/Synced/Opta/1-Apps/optalocal
find <repo> ...
rg -n "schema_version|/v3/|/v1/|protocol"

# health/baseline runs
cd 1D-Opta-CLI-TS && npm run -s typecheck
cd 1D-Opta-CLI-TS && npm run -s test:contract
cd 1M-Opta-LMX && . .venv/bin/activate && pytest -q tests/test_discovery_contract.py tests/test_quantize_schema.py
cd 1P-Opta-Code-Universal && npm run -s typecheck
cd 1P-Opta-Code-Universal && npm run -s parity:check

# dead/duplication checks
cd 1D-Opta-CLI-TS && npx --yes ts-prune -p tsconfig.json
cd 1P-Opta-Code-Universal && npx --yes ts-prune -p tsconfig.json
python3 docs/audit/static-analysis.json generator
```

## Key measured baseline
- 1D typecheck: **2.862s** (pass)
- 1D contract tests: **1.116s** (16 tests, pass)
- 1M discovery+quantize contract tests: **5.282s** (10 tests, pass)
- 1P typecheck: **2.170s** (pass)
- 1P parity check: **0.219s** (pass, 1 unmatched op)
