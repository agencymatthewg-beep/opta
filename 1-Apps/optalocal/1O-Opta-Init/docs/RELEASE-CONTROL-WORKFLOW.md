# Release Control Workflow

This document defines the internal release-control contract for Opta Init channel manifests and desktop manager updater metadata.

## Scope

- Source component manifests:
  - `channels/beta.json`
  - `channels/stable.json`
- Source manager updater metadata:
  - `channels/manager-updates/beta.json`
  - `channels/manager-updates/stable.json`
- Component contract schema:
  - `channels/schema/release-manifest.v1.schema.json`
- Manager updater schema:
  - `channels/schema/manager-updater-metadata.v1.schema.json`
- Validators:
  - `scripts/validate-release-manifests.mjs`
  - `scripts/validate-manager-update-metadata.mjs`
  - `scripts/validate-manager-update-links.mjs`
- Component upsert utility:
  - `scripts/upsert-channel-component.mjs`
- Metadata generator:
  - `scripts/generate-manager-update-metadata.mjs`
- Link reachability validator:
  - `scripts/validate-manifest-links.mjs`
- Publish sync:
  - `scripts/sync-desktop-manifests.mjs`
  - `scripts/sync-manager-updates.mjs`

## Component Sync Automation

- Reusable workflow:
  - `/.github/workflows/opta-init-component-manifest-sync.yml`
- Manual wrapper workflow:
  - `/.github/workflows/opta-init-component-manifest-sync-manual.yml`
- Current integration:
  - `/.github/workflows/opta-cli-release.yml` calls the reusable sync workflow on release tags.
  - `/.github/workflows/opta-code-release-manifest-sync.yml` syncs `opta-code-universal` from release tags/assets.
  - `/.github/workflows/opta-code-macos-build.yml` and `/.github/workflows/opta-code-windows-build.yml` publish release assets consumed by Opta Code manifest sync.
  - `/.github/workflows/opta-lmx-release.yml` builds/publishes LMX release assets and syncs `opta-lmx`.
  - `/.github/workflows/opta-daemon-macos-build.yml` and `/.github/workflows/opta-daemon-windows-build.yml` publish Opta Daemon macOS + Windows release bundles.
  - `/.github/workflows/opta-daemon-release-manifest-sync.yml` syncs `opta-daemon` from release tags/assets.
    - Enforced requirement: both macOS and Windows artifacts must resolve before sync.

This keeps `channels/<channel>.json`, `public/desktop/manifest-<channel>.json`,
and `vercel.json` synchronized from component release events, then re-runs contract validation.

## Component Manifest Contract Summary

- Schema is versioned (`schemaVersion: "1.0.0"`, `manifestVersion: 1`).
- Each manifest carries:
  - global release metadata (`release.id`, `release.notesUrl`, `release.minManagerVersion`)
  - global rollout controls (`strategy`, `percentage`, `cohort`, `startsAt`, `allowDowngrade`)
  - component-level entries for:
    - `opta-cli`
    - `opta-lmx`
    - `opta-code-universal`
    - `opta-daemon`
- Every component must expose both `macos` and `windows` artifact arrays.
- Arrays may be empty during progressive rollout when installers are not yet published.
- Artifact records require:
  - artifact URL
  - package type
  - platform + arch
- Recommended (optional but preferred for production release):
  - size
  - SHA-256 checksum
  - signature metadata

## Manager Updater Metadata Contract Summary

- Schema is versioned (`schemaVersion: "1.0.0"`, `manifestVersion: 1`).
- Each channel file is a Tauri-compatible static updater feed.
- Feed-level fields:
  - `version`
  - `notes`
  - `pub_date`
- Platform payloads are under `platforms` and keyed by target (for example `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`).
- Every published platform entry must include:
  - `url`
  - `signature`
- Progressive mode allows shipping a subset of platforms (for example macOS first).
- `scripts/sync-manager-updates.mjs` publishes runtime feeds (`public/desktop-updates/*.json`) in Tauri-native shape:
  - `version`
  - `notes`
  - `pub_date`
  - `platforms`

## URL Policy

- Canonical component artifact URL namespace:
  - `https://init.optalocal.com/downloads/...`
- Canonical manager updater artifact URL namespace:
  - `https://init.optalocal.com/desktop-updates/manager/...`
- Primary manager artifact storage for CI automation:
  - `https://github.com/<repo>/releases/download/opta-init-manager-<channel>-v<version>/...`
- Published manager updater feed endpoints consumed by desktop manager:
  - `https://init.optalocal.com/desktop-updates/stable.json`
  - `https://init.optalocal.com/desktop-updates/beta.json`

## Manager Updater Endpoint Contract

- `200` with static JSON feed containing:
  - `version`
  - `notes`
  - `pub_date`
  - `platforms` (`{ target: { url, signature } }`)
- Tauri updater selects the local target from `platforms` and performs version comparison client-side.
- `validate-manager-update-links` gate:
  - checks manager artifact URL reachability when `manifest.version` is newer than local manager version
  - skips by default when no update is being advertised (`manifest.version <= local manager`)
  - supports strict mode: `npm run validate:manager-update-links -- --strict`
- During gateway mode, unresolved package URLs may temporarily route to channel release notes while packaging/signing completes.

## Required Signing Variables (Manager Updater)

These variables are required by `/.github/workflows/opta-init-desktop-manager-release.yml`:

- Updater signature (all manager builds):
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Platform signing/notarization (only when `enable_platform_signing=true`):
  - macOS:
    - `APPLE_CERTIFICATE`
    - `APPLE_CERTIFICATE_PASSWORD`
    - `APPLE_SIGNING_IDENTITY`
    - `APPLE_ID`
    - `APPLE_PASSWORD`
    - `APPLE_TEAM_ID`
  - Windows:
    - `WINDOWS_CERTIFICATE`
    - `WINDOWS_CERTIFICATE_PASSWORD`

Notes:
- `TAURI_SIGNING_PUBLIC_KEY` is derived in CI from `TAURI_SIGNING_PRIVATE_KEY`; no separate repo secret is required.
- Default release mode is zero-cost (`enable_platform_signing=false`), producing unsigned installer bundles while preserving updater functionality/signatures.

Current secret snapshot (verified 2026-03-03, repo `agencymatthewg-beep/opta`):
- configured: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- missing: `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`

If signed Windows installers are required, configure Windows certificate secrets first.

## Publish Procedure (Component Manifests)

1. Build and package all component artifacts for macOS and Windows.
2. Compute checksums:
   - macOS/Linux: `shasum -a 256 <file>`
   - Windows PowerShell: `Get-FileHash <file> -Algorithm SHA256`
3. Sign artifacts using the platform signer:
   - macOS packages/bundles: code signing/notarization
   - Windows installers: Authenticode
   - Runtime bundles (optional): Cosign/Sigstore
4. Publish artifact routes for every manifest URL:
   - preferred: upload artifacts/signatures to release storage/CDN and route `/downloads/...` to them
   - temporary gateway mode: route unresolved artifacts to channel release notes
5. Update `channels/beta.json` or `channels/stable.json` with new versions, URLs, checksums, signatures, and rollout values.
6. Validate:
   - `npm run validate:release-manifests -- channels/beta.json channels/stable.json`
   - `npm run validate:manifest-links -- channels/beta.json channels/stable.json`
7. Sync deployable component manifests:
   - `npm run sync:desktop-manifests`

## Publish Procedure (Manager Updater Metadata)

Preferred path: run the automated workflow
at repo root:
`/.github/workflows/opta-init-desktop-manager-release.yml`.
It builds macOS + Windows updater artifacts, publishes release assets, generates
`channels/manager-updates/<channel>.json`, syncs `public/desktop-updates/<channel>.json`,
and runs contract validation gates.

1. Build desktop manager update artifacts for each target being published (`darwin-aarch64`, `darwin-x86_64`, `windows-x86_64` at minimum).
2. Export required updater signing variables:
   - `export TAURI_SIGNING_PRIVATE_KEY='<private-key-pem>'`
   - `export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<private-key-password>'`
   - optional platform signing variables (only when `enable_platform_signing=true`):
   - macOS:
     - `export APPLE_CERTIFICATE='<p12-base64>'`
     - `export APPLE_CERTIFICATE_PASSWORD='<p12-password>'`
     - `export APPLE_SIGNING_IDENTITY='<developer-id-application-cn>'`
     - `export APPLE_ID='<apple-id-email>'`
     - `export APPLE_PASSWORD='<apple-app-specific-password>'`
     - `export APPLE_TEAM_ID='<apple-team-id>'`
   - Windows:
     - `export WINDOWS_CERTIFICATE='<pfx-base64>'`
     - `export WINDOWS_CERTIFICATE_PASSWORD='<pfx-password>'`
3. Generate updater signatures for each target artifact (always required). Platform installer signing is optional unless `enable_platform_signing=true`.
4. Update channel metadata in:
   - `channels/manager-updates/beta.json` for beta releases
   - `channels/manager-updates/stable.json` for stable releases
5. Ensure each changed target has correct `url`, `signature`, `version`, `notes`, and `date`.
6. Validate manager metadata:
   - progressive mode:
     - `npm run validate:manager-update-metadata -- channels/manager-updates/beta.json channels/manager-updates/stable.json`
   - full cross-platform mode:
     - `npm run validate:manager-update-metadata:strict -- channels/manager-updates/beta.json channels/manager-updates/stable.json`
   - `npm run validate:manager-update-links`
7. Sync public updater metadata:
   - `npm run sync:manager-updates`
8. Run the combined contract gate:
   - `npm run validate:release-contract` (progressive)
   - optional full gate:
     - `npm run validate:release-contract:strict`
9. Commit + publish changes.

Known live verification note (2026-03-05):
- The release workflow now publishes both Windows artifacts:
  - updater bundle: `Opta-Init-Manager_x64-setup.nsis.zip` (+ `.sig`)
  - installer binary: `opta-init-windows-x64.exe`
- Canonical public installer endpoint:
  - `https://init.optalocal.com/downloads/opta-init/latest/opta-init-windows-x64.exe`
  may return `404` until both are complete:
  1. a release run uploads `opta-init-windows-x64.exe` to the manager release tag, and
  2. init-site `vercel.json` redirects are deployed.
- Missing `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD` only blocks Authenticode signing. Unsigned Windows artifacts can still ship when `enable_platform_signing=false`.

## Automated Release Workflow Inputs

- `channel`: `stable` or `beta`
- `version`: semver (defaults to desktop-manager version)
- `notes_url`: optional release notes URL (defaults to GitHub release page)
- `publish_metadata`: whether workflow commits feed updates
- `strict_link_check`: runs strict manager updater URL gate
- `dry_run`: build + validate without metadata commit
- `enable_platform_signing`: opt-in platform installer signing/notarization (`false` by default)

## Automated Component Sync Inputs (Reusable Workflow)

- `channel`: `stable` or `beta`
- `component_id`: `opta-cli`, `opta-lmx`, `opta-code-universal`, `opta-daemon`
- `payload_json`: component upsert payload (release patch + component patch)
- `metadata_ref`: target git ref for metadata commit (default `main`)
- `commit_changes`: whether generated manifest changes are committed
- `strict_require_artifacts`: require at least one artifact for the updated component
- `strict_require_signatures`: require signature metadata for every artifact of the updated component
- `strict_require_platforms_for`: require platform coverage for updated component (for example `opta-daemon:macos,windows`)

## Promote Beta to Stable

1. Confirm beta meets release gates (smoke tests, crash rate, install success).
2. Promote component manifest entries from `channels/beta.json` into `channels/stable.json`.
3. Promote manager updater feed values (`version`, `notes`, `pub_date`, and `platforms`) from `channels/manager-updates/beta.json` into `channels/manager-updates/stable.json`.
4. Validate:
   - `npm run validate:release-contract`
5. Sync outputs:
   - `npm run sync:desktop-manifests`
   - `npm run sync:manager-updates`
6. Commit + publish stable metadata.

## Promotion Visibility + Stable Gate

- Generate a current promotion matrix at any time:
  - `npm run report:promotion-status`
- Hard-gate stable readiness locally:
  - `npm run validate:stable-promotion`
- CI enforcement:
  - `/.github/workflows/opta-init-release-manifest-checks.yml` uploads an
    `opta-init-promotion-status` report artifact on every run.
  - The same workflow enforces `validate:stable-promotion` when either:
    - `channels/stable.json`, or
    - `channels/manager-updates/stable.json`
    changes in the diff.

## Rollback Procedure

1. Re-point affected component and/or manager updater entries to last-known-good versions.
2. If needed, reduce rollout percentage to `0` or move to `holdback` in component manifests.
3. Re-run validation:
   - `npm run validate:release-contract`
4. Re-sync:
   - `npm run prebuild`
5. Publish rollback metadata and record incident in release notes.
