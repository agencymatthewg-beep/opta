# Codex Readiness Audit — OptaLocal
Date: 2026-03-05 (Australia/Melbourne)
Scope: Codex CLI install/version, upgrade path, OptaLocal monorepo compatibility, validation + rollback.

## 1) Current State (Observed)

### Host installation
- Binary path: `/opt/homebrew/bin/codex`
- Install channel: **Homebrew cask** (`brew info codex`)
- Installed version: **0.107.0**
- Latest known by local Codex state: `~/.codex/version.json` → `latest_version: 0.107.0`
- Outdated check: no `codex` entry from `brew outdated` (currently up to date)

### Codex config
- File: `~/.codex/config.toml`
- Default model: `gpt-5.3-codex`
- Reasoning effort: `xhigh`
- Features enabled: `multi_agent`, `prevent_idle_sleep`, `js_repl`
- Trust scope includes:
  - `/Users/matthewbyrden/Synced/Opta`
  - `/Users/matthewbyrden/Synced/Opta/1-Apps`
  - `/Users/matthewbyrden`

### OptaLocal conventions alignment (repo-level)
- Root workspace commands exist and are current in `optalocal/package.json`:
  - `npm run apps:list`
  - `npm run apps:verify`
  - `npm run check:all`
  - `npm run build:all`
- Agent guidance exists in `optalocal/AGENTS.md` and aligns with running from monorepo root.

### Drift found (needs cleanup)
1. `1T-Opta-Home/WORKFLOW-DESIGN-ITERATION.md` still states **codex-cli 0.104.0** (stale).
2. `~/.codex/config.toml` has stale project entries:
   - `/Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS` (outside current `optalocal/` path)
   - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Desktop` (folder name drift vs `1P-Opta-Code-Universal`)


## 2) Breaking-Change Check (Relevant to OptaLocal Workflows)

Reference checked: OpenAI Codex changelog for CLI 0.107.0.

### High relevance
- Sandbox/escalation behavior tightened and made more consistent.
- Escalated commands retain sandbox configuration on rerun.
- Sandbox restrictions tightened around sensitive directories (`~/.ssh` hardening in some environments).

### Impact to OptaLocal monorepo
- Normal repo-local operations (`npm run apps:*`, checks/builds in workspace) should remain unaffected.
- Workflows that rely on SSH key access or external network installs from sandboxed runs may require explicit escalation/approval.
- `--ask-for-approval on-failure` appears deprecated in CLI help; move to `on-request` for interactive and `never` for non-interactive CI-like runs.

Risk score (readiness): **8.5/10**
- Gap is mostly config/doc drift, not binary/runtime incompatibility.


## 3) Recommended Target State

1. Keep Codex on Homebrew cask channel, pinned operationally to **current latest**.
2. Standardize invocation defaults for OptaLocal:
   - Interactive local work: `--sandbox workspace-write --ask-for-approval on-request`
   - Deterministic scripted/non-interactive runs: `--ask-for-approval never` (+ explicit sandbox mode)
3. Clean stale trust/project entries in `~/.codex/config.toml`.
4. Update stale workflow docs that mention old Codex version.


## 4) Upgrade + Hardening Commands (Exact)

### A. Preflight snapshot (safe rollback point)
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
mkdir -p docs/ops/_snapshots
cp ~/.codex/config.toml docs/ops/_snapshots/codex-config.toml.bak-$(date +%Y%m%d-%H%M%S)
codex --version
brew info codex | sed -n '1,20p'
```

### B. Upgrade Codex (Homebrew path)
```bash
brew update
brew upgrade codex
codex --version
```

### C. Clean config drift (manual edit targets)
Edit `~/.codex/config.toml`:
- Remove stale project path entries not used anymore.
- Ensure trust inheritance includes current monorepo root:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal`

### D. Update stale workflow doc in repo
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
rg -n "codex-cli 0\.104\.0|on-failure|Opta-Code-Desktop" -g '!**/.next/**'
# Update matches to current version/policies/folder names.
```


## 5) Validation Checklist (Run in Order)

### 5.1 Binary + channel
```bash
which codex
codex --version
brew info codex | sed -n '1,20p'
brew outdated | rg '^codex' || echo "codex current"
```
Expected:
- Path resolves to `/opt/homebrew/bin/codex`
- Version prints expected target
- No outdated entry

### 5.2 Config sanity
```bash
test -f ~/.codex/config.toml && echo "config present"
rg -n "\[projects\.|model\s*=|model_reasoning_effort|ask-for-approval|sandbox" ~/.codex/config.toml
```
Expected:
- No stale project paths
- Model remains `gpt-5.3-codex` (or intentional override)

### 5.3 OptaLocal root compatibility smoke
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
npm run apps:verify
npm run apps:list
```
Expected:
- Registry verifies successfully
- App matrix lists without path errors

### 5.4 Codex runtime smoke in monorepo root
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
codex exec --sandbox workspace-write --ask-for-approval never "Inspect root and report app IDs from apps.registry.json only. No file edits."
```
Expected:
- Command completes without trust/sandbox path failures
- Output references registry app IDs accurately


## 6) Rollback Plan

If upgrade/config cleanup causes regressions:

### Rollback binary
```bash
brew uninstall --cask codex
# Reinstall target known-good (example: 0.107.0 currently)
brew install --cask codex
codex --version
```

### Rollback config
```bash
# choose latest backup created in docs/ops/_snapshots
cp /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/docs/ops/_snapshots/<backup-file>.toml ~/.codex/config.toml
```

### Re-validate after rollback
```bash
codex --version
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal
npm run apps:verify
```


## 7) Risks and Mitigations

1. **Sandbox/network mismatch during agent runs**
   - Why: stricter sandbox behavior in newer Codex versions.
   - Mitigation: prefer `on-request` for interactive runs; escalate intentionally.

2. **Stale trusted-path mappings causing confusing prompts/denials**
   - Why: renamed/moved app directories.
   - Mitigation: prune stale `projects.*` entries and keep root trust at monorepo path.

3. **Operational drift from stale docs**
   - Why: workflow docs still mention 0.104.0.
   - Mitigation: update docs with current version/policy defaults and re-run grep checks.


## 8) Verdict

Codex readiness for OptaLocal is **good and upgrade-safe now**.
- Current runtime is already on latest observed (0.107.0).
- No critical blockers for monorepo workflows.
- Remaining work is drift cleanup (config + docs) and one smoke validation pass after any future upgrade.
