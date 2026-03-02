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
- Metadata generator:
  - `scripts/generate-manager-update-metadata.mjs`
- Link reachability validator:
  - `scripts/validate-manifest-links.mjs`
- Publish sync:
  - `scripts/sync-desktop-manifests.mjs`
  - `scripts/sync-manager-updates.mjs`

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
- Every component must ship both `macos` and `windows` artifact arrays with:
  - artifact URL
  - package type
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
- Platform payloads are under `platforms` and keyed by target:
  - `darwin-aarch64`
  - `darwin-x86_64`
  - `windows-x86_64`
- Every platform entry must include:
  - `url`
  - `signature`
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

These variables are required whenever manager updater signatures are generated or rotated:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

If either variable is missing, do not publish manager updater metadata.

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
`../.github/workflows/opta-init-desktop-manager-release.yml`.
It builds macOS + Windows updater artifacts, publishes release assets, generates
`channels/manager-updates/<channel>.json`, syncs `public/desktop-updates/<channel>.json`,
and runs contract validation gates.

1. Build desktop manager update artifacts for each target being published (`darwin-aarch64`, `darwin-x86_64`, `windows-x86_64` at minimum).
2. Export required signing variables:
   - `export TAURI_SIGNING_PRIVATE_KEY='<private-key-pem>'`
   - `export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<private-key-password>'`
3. Sign each updater artifact and collect generated signatures.
4. Update channel metadata in:
   - `channels/manager-updates/beta.json` for beta releases
   - `channels/manager-updates/stable.json` for stable releases
5. Ensure each changed target has correct `url`, `signature`, `version`, `notes`, and `date`.
6. Validate manager metadata:
   - `npm run validate:manager-update-metadata -- channels/manager-updates/beta.json channels/manager-updates/stable.json`
   - `npm run validate:manager-update-links`
7. Sync public updater metadata:
   - `npm run sync:manager-updates`
8. Run the combined contract gate:
   - `npm run validate:release-contract`
9. Commit + publish changes.

## Automated Release Workflow Inputs

- `channel`: `stable` or `beta`
- `version`: semver (defaults to desktop-manager version)
- `notes_url`: optional release notes URL (defaults to GitHub release page)
- `publish_metadata`: whether workflow commits feed updates
- `strict_link_check`: runs strict manager updater URL gate
- `dry_run`: build + validate without metadata commit

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

## Rollback Procedure

1. Re-point affected component and/or manager updater entries to last-known-good versions.
2. If needed, reduce rollout percentage to `0` or move to `holdback` in component manifests.
3. Re-run validation:
   - `npm run validate:release-contract`
4. Re-sync:
   - `npm run prebuild`
5. Publish rollback metadata and record incident in release notes.
