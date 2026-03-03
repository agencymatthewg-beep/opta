# Audit — Opta CLI + Opta Init device installer readiness

Date: 2026-02-28
Scope:
1) Release artifacts + OS coverage (Opta CLI)
2) Bootstrap endpoint status for `https://optalocal.com/init`
3) Gaps blocking a true “download + installer wizard” flow

## Verdict
**Readiness: 4/10 (not launch-ready for cross-device onboarding).**

- CLI has a live release asset, but it is **npm tarball only** (no native installers).
- Init site is live, but `https://optalocal.com/init` returns **404**.
- The hero bootstrap command points to a non-working endpoint.
- Download cards advertise multi-platform intent, but only one asset is wired (CLI macOS via `.tgz`), with LMX and Windows still placeholders.

---

## 1) Current release artifacts + OS coverage

### What exists now
- **CLI package release pipeline exists** and publishes:
  - npm package (`npm publish`)
  - GitHub release asset: `opta-cli-npm.tgz`
- Evidence files:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/.github/workflows/release.yml`
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/package.json`
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/opta-cli-npm.tgz`

### OS coverage reality
- README claims feature support across macOS/Linux/Windows (with constraints), but **distribution artifacts are not OS-native**.
- Current install UX is npm-first (`npm install -g opta-cli`), not “download installer wizard”.
- Evidence file:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/README.md`

### Gap
- Missing downloadable installer binaries for end-user onboarding:
  - macOS: `.pkg` or `.dmg`
  - Windows: `.msi` or signed `.exe`
  - Linux (optional but expected by support table): `.deb`/`.rpm`/AppImage

---

## 2) Bootstrap endpoint status (`https://optalocal.com/init`)

### Observed status
- `https://optalocal.com/init` returns **HTTP 404**.
- `https://init.optalocal.com` returns **HTTP 200**.

### Why this blocks onboarding
- The install section’s canonical command currently shows:
  - `curl -fsSL https://optalocal.com/init | bash`
- This endpoint is not live, so copy-paste bootstrap fails immediately.

### Relevant files
- Hardcoded command in UI:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/app/page.tsx`
- Product intent already notes endpoint uncertainty:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/APP.md`

---

## 3) Gaps blocking “download + installer wizard”

## P0 (must fix before claiming installer onboarding)

1. **Broken bootstrap URL**
   - Problem: `https://optalocal.com/init` is 404.
   - Files to update:
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/app/page.tsx`
     - (plus root-domain routing config in the app/deployment serving `optalocal.com`, not found in 1O)
   - Fix:
     - Either provision real bootstrap script at `/init` (shell script with correct headers/content type), or
     - redirect `/init` -> `https://init.optalocal.com` and change UI command to the actual script URL.

2. **No installer artifacts for promised wizard flow**
   - Problem: only npm tarball is shipped (`opta-cli-npm.tgz`).
   - Files to update:
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/.github/workflows/release.yml`
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/lib/constants.ts`
   - Fix:
     - Add build jobs that produce and upload OS-native installers.
     - Wire those signed assets into Init download cards.

3. **LMX download path is non-functional**
   - Problem: LMX `macos`/`windows` links are null; card remains “coming soon”.
   - File:
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/lib/constants.ts`
   - Fix:
     - Publish at least one LMX installer artifact and replace null links.

## P1 (high-value, next)

4. **Mismatch between marketing copy and actual install mechanics**
   - Problem: UI suggests one-command full provisioning, but endpoint and artifacts don’t support this yet.
   - Files:
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/app/page.tsx`
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/APP.md`
   - Fix:
     - Gate copy behind feature flags until endpoint + assets are live.

5. **No explicit install wizard handoff from download action**
   - Problem: current cards are static links without post-download setup guidance per OS.
   - File:
     - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1O-Opta-Init/app/page.tsx`
   - Fix:
     - Add per-OS “after download” steps and deep links (`/docs/install/macos`, `/docs/install/windows`) or embedded modal checklist.

---

## Minimal launch sequence (fastest path)

1. **Restore bootstrap truth**: make `/init` live or update command to live script URL.
2. **Ship one native installer each**:
   - CLI macOS installer + CLI Windows installer.
3. **Ship one LMX installer target** (macOS first).
4. **Update `lib/constants.ts` download URLs** and remove placeholders for shipped targets.
5. **Only then** market “download + installer wizard” as supported.

---

## Extra risk noticed
- The release workflow currently runs on `ubuntu-latest` only for publish lanes. If native installer packaging is added, this architecture must split by OS runners (`macos-latest`, `windows-latest`) and add code-signing/secrets strategy.
- File to evolve:
  - `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS/.github/workflows/release.yml`
