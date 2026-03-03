# Opta Software State Registry (Long-Term)

_Last updated: 2026-03-03 22:40 AEDT (Australia/Melbourne)_

Purpose: single source of truth for external software/services Opta depends on, including ownership, auth state, current usage, risk posture, and next action.

## How to use
- Update this file after any meaningful integration change.
- Link detailed runbooks/specs from each system section.
- Keep credentials out of this file; reference SOT credential locations only.

---

## A) Source Control & Delivery

### GitHub
- **Primary account in use:** `agencymatthewg-beep`
- **Main repo:** `agencymatthewg-beep/opta`
- **Tap repo:** `agencymatthewg-beep/homebrew-opta-cli`
- **State:** Active and authenticated via `gh` CLI
- **Open risk:** Brand/org mismatch vs desired `optaops` identity
- **Next action:** Create `optaops` org later and migrate when ready

### Vercel
- **Team:** `team_gU9yOVESJwOUWdYC0SLGGoGv`
- **State:** Active (domains linked and routing managed)
- **Recent outcome:** `help.optalocal.com` live; old `opta-help.vercel.app` redirects 308
- **Next action:** maintain domain mapping in canonical SOT docs

### Learn experience (new)
- **Planned domain:** `learn.optalocal.com`
- **Intent:** central searchable guide hub for Opta Local app/features/issues (visual + explanatory guides)
- **Navigation plan:** add CTA buttons on `optalocal.com` and `help.optalocal.com` ("Learn More", "Users Guide", "Don’t understand?") redirecting to `learn.optalocal.com`
- **Execution owner:** Opta512 (frontend design skill + Gemini workflow)
- **State:** Planned / in-progress handoff

---

## B) Package & Distribution

### npm
- **Package target:** `opta-cli`
- **State:** Not published yet
- **Blocker:** missing repo secret `NPM_TOKEN`
- **Policy note:** npm classic tokens revoked; use granular token
- **Next action:** create granular token + set `NPM_TOKEN`

### Homebrew
- **Tap:** `agencymatthewg-beep/homebrew-opta-cli`
- **Formula path:** `Formula/opta-cli.rb`
- **State:** Bootstrapped, pending SHA finalization after npm publish
- **Open risk:** Formula metadata still references `optaops` URLs (legacy)
- **Next action:** rewrite formula URLs to canonical artifact source + set final sha256

### Opta Init Desktop Manager (Tauri)
- **Release workflow:** `/.github/workflows/opta-init-desktop-manager-release.yml`
- **Default mode:** zero-cost (unsigned platform installers; updater signatures still enforced)
- **Required repo secrets (always):**
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Optional repo secrets (only when `enable_platform_signing=true`):**
  - `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
  - `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`
- **Current snapshot (names only, no secret values):**
  - configured: TAURI signing pair + Apple signing/notarization set
  - missing: Windows certificate pair
- **Operational note:** Windows users can install/run unsigned builds (SmartScreen warning expected) with no feature loss.
- **Credential source-of-truth:** values remain in SOT credential storage per `2-Docs/Operations/SOT-OPTA-OPERATING-MODEL.md` (do not store raw secrets in this registry).
- **Deferred investigation (approved):**
  - keep default mode as zero-cost now
  - investigate signed-installer lane economics/options later (Windows certificate + Apple signing/notarization tradeoffs)
  - investigate/confirm secret-handling hardening and app-specific-password rotation timing later

---

## C) Identity, Auth & Data

### Supabase
- **Project ref:** `cytjsmezydytbmjrolyz`
- **State:** Linked and migration parity confirmed through current baseline
- **Helper script:** `~/Synced/AI26/2-Bot-Ops/2F-Scripts/supabase-opta.sh`
- **Open risk:** `api_keys.key_value` plaintext at rest
- **Next action:** introduce key hardening plan (masking/encryption strategy)

### Cloudflare
- **Primary zones:** `optalocal.com`, `optamize.biz`
- **State:** healthy and documented in SOT
- **Open issue:** `www.optamize.biz` record gap
- **Next action:** add missing `www` CNAME

---

## D) Runtime & Dev Tooling

### Node / Toolchain
- **Release workflow Node:** 22
- **Homebrew formula node dep:** `node@20`
- **Risk:** possible runtime mismatch over time
- **Next action:** align runtime policy (document target minimum Node version)

### OpenClaw automation
- **State:** operational
- **Use:** cron, infra checks, domain verification, release ops assistance
- **Next action:** keep operational runbooks in `2-Docs/Operations/`

---

## E) Governance (Officialization without heavy spend)

### Free / low-cost baseline now
1. Consistent business branding on GitHub/npm/docs
2. Public legal docs in repos/sites (license/privacy/terms/security)
3. Domain-backed support/contact identity (`optamize.biz`)
4. Clear ownership map in this registry + OPIS docs

### Defer until needed (paid)
- App store company enrollment and advanced trust marks
- Enterprise security/compliance tooling

---

## F) Standard Update Trigger
Update this registry whenever one of these changes:
- New external service adopted
- Auth model changed
- Repo/org ownership changed
- Distribution channel added/removed
- Critical risk introduced/resolved
