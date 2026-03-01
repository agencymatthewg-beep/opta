# Opta CLI macOS Release Plan — v0.5.0-alpha Track

_Last updated: 2026-03-01 (Australia/Melbourne)_

## 1) Objective
Ship Opta CLI publicly with two install paths:
1. `npm install -g opta-cli`
2. `brew install opta-cli` via dedicated tap

## 2) Current Execution State

### Completed
- GitHub environment `npm` created in `agencymatthewg-beep/opta`.
- Homebrew tap created: `agencymatthewg-beep/homebrew-opta-cli`.
- Formula bootstrapped and pushed to tap (`Formula/opta-cli.rb`).
- Monorepo release workflow created: `.github/workflows/opta-cli-release.yml`.
- Workflow pathing fixed for monorepo (working directory points to `1-Apps/optalocal/1D-Opta-CLI-TS`).
- Release tags pushed to test trigger path (`v0.5.0-alpha`, `v0.5.0-alpha.2`).

### Blocked
- `NPM_TOKEN` missing in GitHub repo secrets.
- npm account/token setup not yet completed.

## 3) Critical Risks Identified + Resolution

### Risk A — Wrong org in release instructions
- **Issue:** Prior instructions referenced `optaops/*`, but org does not exist in GitHub account currently in use.
- **Resolution now:** Use `agencymatthewg-beep/*` for operational continuity.
- **Future option:** Create org `optaops`, then migrate repos.

### Risk B — Workflow file location mismatch in monorepo
- **Issue:** CLI-local release workflow is not picked by root repo Actions; release jobs did not trigger as expected.
- **Resolution:** Added root-level workflow `.github/workflows/opta-cli-release.yml`.

### Risk C — `cache-dependency-path` not resolving on tag runs
- **Issue:** Initial release workflow failed during setup-node cache phase.
- **Resolution:** Removed strict `cache-dependency-path` lines from workflow.

### Risk D — Homebrew formula points to wrong source
- **Issue:** Formula references `optaops/opta-cli` and fixed `v0.5.0` tarball path.
- **Resolution plan:** After npm publish, update formula source to canonical artifact source and set real SHA.

### Risk E — npm auth policy changed
- **Issue:** npm revoked classic tokens and now uses granular tokens with stricter policy.
- **Resolution:** Generate granular token with package publish scope, store as `NPM_TOKEN`.

## 4) Canonical Release Procedure (from current state)

### Step 1 — npm token setup
1. Create/sign in npm account.
2. Generate **Granular Access Token** (publish permission for `opta-cli`).
3. Save token as GitHub secret:
   - repo: `agencymatthewg-beep/opta`
   - secret: `NPM_TOKEN`

### Step 2 — release trigger
1. Create a fresh release tag on latest `main` after workflow fixes.
2. Push tag to origin.
3. Verify `Opta CLI Release` workflow completes.

### Step 3 — post-publish verification
1. Confirm package exists on npm.
2. Verify global install:
   - `npm i -g opta-cli`
   - `opta --version`

### Step 4 — Homebrew finalize
1. Compute tarball SHA256 from canonical release artifact.
2. Update tap formula `sha256` and source URL if required.
3. Push formula update.
4. Validate with:
   - `brew tap <tap>`
   - `brew install opta-cli`

## 5) Long-Term Release Governance
- Keep release workflow in root `.github/workflows/` for monorepo reliability.
- Pin node major versions in workflow and review quarterly.
- Treat release gate as strict: tests + publish + artifact + install verification.
- Track release incidents in fix logs if any release requires >1 attempt.

## 6) Immediate Next Action
- Obtain npm granular publish token, set `NPM_TOKEN`, and re-run release via new tag.

