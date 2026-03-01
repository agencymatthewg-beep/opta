# Opta CLI — Release Runbook

This runbook defines the release flow required before Opta Init can safely point users to downloadable CLI artifacts.

## Versioning

- Source of truth: `package.json` `version`.
- Tag format: `v<version>` (example: `v0.5.0-alpha.2`).
- Release workflow trigger: Git tag push.

## Pre-Release Gate (must pass)

```bash
npm run test:ci
npm run test:parity:ws9
npm run smoke:features
```

If any command fails, do not cut a release.

Also complete `docs/FEATURE-AUDIT-CHECKLIST.md` before upload.

Latest local pre-release verification (2026-02-28):
- `npm run lint:budget` ✅
- `npm run build` ✅
- `npm run check-dist` ✅
- `npm run test:parity:core-smoke` ✅
- `npm run test:parity:ws9` ✅
- `npm run test:ci` ✅
- `npm run smoke:features -- --output docs/evidence/feature-smoke-2026-02-28-rerun.tsv` ✅

## npm Publish Path

The CI release workflow publishes to npm on tag push and uploads a deterministic
GitHub release asset:

- Workflow: `.github/workflows/release.yml`
- Requirements: `NPM_TOKEN` in GitHub environment secrets.
- Uploaded asset: `opta-cli-npm.tgz`

2026-02-28 execution note:
- GitHub release asset upload was performed manually via `gh release create` because the remote repository did not expose a `Release` workflow.
- npm registry publish remains pending local npm authentication (`npm whoami` returned `ENEEDAUTH`).

## GitHub Artifact Naming Contract (for Opta Init)

Use deterministic artifact names so `init.optalocal.com` links remain stable.

- npm tarball: `opta-cli-npm.tgz`

Expected URL pattern:

```text
https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz
```

## Artifact Verification

After publishing release assets:

```bash
curl -I -L "https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz"
```

Success criteria: HTTP `200` for the final resolved URL.

## Clean-Machine Install Validation

On a clean macOS machine:

1. Install from release asset:
   `npm install -g https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz`
2. Run `opta --help`.
3. Run `opta doctor`.
4. Run `opta chat --help` and verify startup path is healthy.
5. Confirm local or remote LMX target can be configured and reached.

## Opta Init Handoff Checklist

Before updating `1O-Opta-Init` constants:

- [x] GitHub latest release asset exists with required filename.
- [x] Direct download URL resolves to `200`.
- [x] Clean-machine install validation passed.
- [x] Release notes include known constraints and fallback guidance.
