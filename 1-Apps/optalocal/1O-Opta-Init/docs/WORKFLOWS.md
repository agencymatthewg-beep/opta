# Opta Init — Workflows

## Local Development

```bash
cd ~/Synced/Opta/1-Apps/optalocal/1O-Opta-Init
npm install
npm run dev           # localhost:3001
```

## Build + Export

```bash
npm run build         # next build + export
npm run start         # serve static export from out/ on localhost:3001
# Output in out/
# Deploy out/ to Vercel
```

## Deploy to Vercel

1. `npx vercel` (first time: link project)
2. Set domain: `init.optalocal.com`
3. Use `npx vercel deploy --prod --yes` for explicit production deploys
4. Vercel auto-deploys on push to main if Git integration is enabled

## Cloudflare DNS

Add record in Cloudflare for optalocal.com:
- Type: CNAME
- Name: init
- Value: cname.vercel-dns.com
- Proxy: DNS only (grey cloud) for Vercel SSL

## Clauding Workflow (AI-assisted development)

Trigger phrase: "Claude it"
Protocol: ~/Synced/AI26/2-Bot-Ops/2H-Workflows/CLAUDING.md

For this project:
1. Read APP.md + CLAUDE.md first
2. Check docs/ROADMAP.md for current phase
3. Implement one phase section at a time
4. Verify Lighthouse after each phase

## Updating Release Metadata

Update both release-control contracts whenever a new release ships:

1. Update component manifests:
   - `channels/stable.json`
   - `channels/beta.json`
2. Update manager updater metadata:
   - `channels/manager-updates/stable.json`
   - `channels/manager-updates/beta.json`
3. Keep URLs in canonical namespaces:
   - component artifacts: `https://init.optalocal.com/downloads/...`
   - manager updater artifacts: `https://init.optalocal.com/desktop-updates/manager/...`
4. Required manager signing variables:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - optional when `enable_platform_signing=true`:
     - `APPLE_CERTIFICATE`
     - `APPLE_CERTIFICATE_PASSWORD`
     - `APPLE_SIGNING_IDENTITY`
     - `APPLE_ID`
     - `APPLE_PASSWORD`
     - `APPLE_TEAM_ID`
     - `WINDOWS_CERTIFICATE`
     - `WINDOWS_CERTIFICATE_PASSWORD`
5. Sync publishable JSON:
   - `npm run sync:desktop-manifests`
   - `npm run sync:manager-updates`
6. Validate contracts and links:
   - `npm run validate:release-contract` (progressive gate, partial platforms/components allowed)
   - `npm run validate:release-contract:strict` (full cross-platform gate; requires Windows manager updater target)
   - `npm run report:promotion-status` (prints current promoted vs non-promoted state)
   - `npm run validate:stable-promotion` (hard gate for full stable catalog readiness)
   - `npm run validate:docs` (active docs references + workflow path consistency)
   - optional strict gate before a manager rollout:
     - `npm run validate:manager-update-links -- --strict`
7. Smoke-check manager updater feed:
   - `curl -s https://init.optalocal.com/desktop-updates/stable.json | jq '.version, .pub_date, .platforms | keys'`
   - `curl -s https://init.optalocal.com/desktop-updates/beta.json | jq '.version, .pub_date, .platforms | keys'`

Current secret snapshot (verified 2026-03-03 UTC, repo `agencymatthewg-beep/opta`):
- configured: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- missing: `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`
- `TAURI_SIGNING_PUBLIC_KEY` is derived automatically in CI from `TAURI_SIGNING_PRIVATE_KEY`.

Commit + push -> Vercel auto-deploys the Opta Initializer web entrypoint.

Release-manifest CI also publishes a markdown artifact (`opta-init-promotion-status`) and enforces
`validate:stable-promotion` whenever `channels/stable.json` or
`channels/manager-updates/stable.json` changes.

Docs CI guardrail:
- `/.github/workflows/opta-init-docs-checks.yml` enforces `npm run validate:docs`
  for active docs updates.

## Automated Component Manifest Sync

Use reusable workflow:
- `/.github/workflows/opta-init-component-manifest-sync.yml`

Current production wiring:
- `/.github/workflows/opta-cli-release.yml` automatically calls the sync workflow for tag releases (`opta-cli-v*`).
- `/.github/workflows/opta-code-release-manifest-sync.yml` auto-syncs `opta-code-universal` on `opta-code-v*` tags (or manual dispatch).
- `/.github/workflows/opta-lmx-release.yml` builds/publishes LMX release assets and syncs `opta-lmx` on `opta-lmx-v*` tags (or manual dispatch).
- `/.github/workflows/opta-daemon-release-manifest-sync.yml` syncs `opta-daemon` on `opta-daemon-v*` tags (or manual dispatch).
- `/.github/workflows/opta-init-component-manifest-sync-manual.yml` provides manual dispatch sync for any component (`opta-cli`, `opta-lmx`, `opta-code-universal`, `opta-daemon`).

Local equivalent command:

```bash
npm run sync:channel-component -- \
  --channel beta \
  --payload-file /absolute/path/component-payload.json
npm run sync:desktop-manifests
npm run sync:vercel-redirects
npm run validate:release-manifests -- channels/beta.json
```

Optional strict component gate:

```bash
npm run validate:release-manifests -- \
  --require-populated-artifacts-for opta-cli \
  channels/beta.json
```

## Automated Desktop Manager Release

Use GitHub Actions workflow:
- `/.github/workflows/opta-init-desktop-manager-release.yml`

Trigger options:
1. Push tag:
   - `opta-init-manager-stable-v<version>`
   - `opta-init-manager-beta-v<version>`
2. Manual dispatch:
   - set `channel`, optional `version`, optional `notes_url`
   - choose `publish_metadata`, `strict_link_check`, `dry_run`, `enable_platform_signing`
   - workflow creates release tag automatically if missing

The workflow:
1. Verifies desktop-manager version consistency.
2. Builds updater artifacts for:
   - `darwin-aarch64`
   - `darwin-x86_64`
   - `windows-x86_64`
   - platform installer signing/notarization is opt-in (`enable_platform_signing=true`)
3. Publishes artifacts to GitHub Releases.
4. Generates and validates `channels/manager-updates/<channel>.json`.
5. Syncs `public/desktop-updates/<channel>.json`.
6. Optionally commits metadata updates back to the repo.
7. Uses canonical manager artifact URLs:
   - `https://init.optalocal.com/desktop-updates/manager/<channel>/<version>/<asset>`
   with Vercel redirects to GitHub release assets.
8. CLI package alias endpoint:
   - `https://init.optalocal.com/downloads/opta-cli/latest`
9. Enforces updater signing secrets on every release lane:
   - updater signing: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - platform signing secrets are only required when `enable_platform_signing=true`

Known live gap (2026-03-03):
- Manager release tags `opta-init-manager-stable-v0.6.1` and `opta-init-manager-beta-v0.6.1`
  currently expose only `opta-init-mac.dmg` assets in GitHub Releases.
- Missing Windows signing secrets currently only block signed Windows installers; unsigned Windows bundles can still be released in zero-cost mode.

## Lighthouse Audit

```bash
npx lighthouse https://init.optalocal.com --output html --output-path ./lighthouse.html
```

Must pass before every deploy: >= 95 Performance, 100 Accessibility, 100 SEO.
