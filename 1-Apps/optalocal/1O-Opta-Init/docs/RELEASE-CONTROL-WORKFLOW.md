# Release Control Workflow

This document defines the internal release-control contract for Opta Init manager channel manifests.

## Scope

- Source manifests:
  - `channels/beta.json`
  - `channels/stable.json`
- Contract schema:
  - `channels/schema/release-manifest.v1.schema.json`
- Validator:
  - `scripts/validate-release-manifests.mjs`
- Link reachability validator:
  - `scripts/validate-manifest-links.mjs`
- Publish sync:
  - `scripts/sync-desktop-manifests.mjs`

## Contract Summary

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

## Publish Procedure (Beta)

1. Build and package all component artifacts for macOS and Windows.
2. Compute checksums:
   - macOS/Linux: `shasum -a 256 <file>`
   - Windows PowerShell: `Get-FileHash <file> -Algorithm SHA256`
3. Sign artifacts using the platform signer:
   - macOS packages/bundles: code signing/notarization
   - Windows installers: Authenticode
   - Runtime bundles (optional): Cosign/Sigstore
4. Upload artifacts and detached signatures to release storage/CDN.
5. Update `channels/beta.json` with new versions, URLs, checksums, signatures, and rollout values.
6. Validate:
   - `npm run validate:release-manifests -- channels/beta.json`
   - `npm run validate:manifest-links -- channels/beta.json`
   - Both checks are required release gates and must pass before publish/sync.
7. Sync deployable manager manifests:
   - `node scripts/sync-desktop-manifests.mjs`
8. Commit + publish manifest changes.
9. Monitor rollout metrics/errors and adjust `rollout.percentage` if needed.

## Promote Beta to Stable

1. Confirm beta meets release gates (smoke tests, crash rate, install success).
2. Copy promoted component versions/URLs/checksums/signatures from beta into `channels/stable.json`.
3. Set stable rollout policy (usually `immediate`, `percentage: 100`).
4. Validate both channels together:
   - `npm run validate:release-manifests -- channels/stable.json channels/beta.json`
   - `npm run validate:manifest-links -- channels/stable.json channels/beta.json`
   - Both checks are required release gates and must pass before publish/sync.
5. Sync deployable manager manifests:
   - `node scripts/sync-desktop-manifests.mjs`
6. Commit + publish stable manifest.
7. Keep beta moving forward to the next prerelease line.

## Rollback Procedure

1. Re-point affected component(s) in the relevant channel manifest to last-known-good versions.
2. If needed, reduce rollout percentage to `0` or move to `holdback`.
3. Re-validate manifest.
4. Publish rollback manifest and record incident in release notes.
