# Opta Software State Registry (Long-Term)

_Last updated: 2026-03-01 (Australia/Melbourne)_

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

