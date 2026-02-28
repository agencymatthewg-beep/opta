# Opta Ecosystem — Optimization & Resolution Guide

*Generated: 2026-02-25 | Scope: Full repo audit*

---

## Executive Summary

The Opta ecosystem is architecturally sound with strong documentation conventions (OPIS), but accumulating structural debt from rapid expansion. There are **4 active build/blocking issues**, **7 undocumented apps**, **9 apps missing OPIS**, and **3 stale infrastructure docs** that will cause confusion at scale. This guide is organized by priority: fix blocking issues first, then structural cleanup, then doc gaps.

---

## Section 1 — Active Build & Blocking Issues

These are breaking things right now or will break the next deployment.

### 1.1 Remote CLI Build Failing on Mono512 ❌

**File:** `1-Apps/1D-Opta-CLI-TS/src/daemon/http-server.ts` + `ws-server.ts`
**Error:** `Cannot find module 'fastify'` and `@fastify/websocket` on remote (Mono512 at `192.168.188.11`)
**Evidence:** Update log `207_2026-02-24` — remote CLI build fails with 30+ TypeScript errors

**Fix:**
```bash
ssh opta@192.168.188.11
cd /Users/Shared/312/Opta/1-Apps/1D-Opta-CLI-TS
npm install
```

**Root cause:** The remote copy of the repo has no `node_modules`. The dependencies exist in `package.json` (fastify `^5.7.4`, `@fastify/websocket ^11.2.0`) but were never installed on Mono512. Running `npm install` should resolve all 30+ type errors in one shot.

---

### 1.2 Dirty Working Trees Blocking Git Pulls ⚠️

Both local CLI and OptaPlus have dirty working trees, causing `opta update` to skip git pulls. This means Mono512 may drift from MacBook.

**Affected:**
- `1-Apps/1D-Opta-CLI-TS` — dirty (local)
- `1-Apps/1I-OptaPlus` — dirty (local)
- `1-Apps/1D-Opta-CLI-TS` — git status unavailable (remote)
- `1-Apps/1I-OptaPlus` — git status unavailable (remote)

**Fix:** Commit or stash uncommitted changes in both apps, then re-run `opta update`. The `opta update` command will then be able to pull latest on subsequent runs.

---

### 1.3 Opta LMX Has No Git Repository ⚠️

`1-Apps/1M-Opta-LMX` reports "not a git repository" on both local and remote in update logs. This is infrastructure-critical code running live on Mono512 with no version control.

**Risk:** No ability to roll back if a bad push breaks inference. No history. No diff tracking.

**Fix:** Initialize git and push to GitHub.
```bash
cd ~/Synced/Opta/1-Apps/1M-Opta-LMX
git init
git add .
git commit -m "chore(lmx): initial commit — v0.5 (~80% complete)"
git remote add origin git@github.com:agencymatthewg-beep/opta.git  # or a dedicated repo
git push -u origin main
```

---

### 1.4 Duplicate Lockfiles at Repo Root ⚠️

Both `pnpm-lock.yaml` and `package-lock.json` exist at the monorepo root. This creates two competing dependency graphs for the same workspace.

**Fix:**
```bash
rm /Synced/Opta/package-lock.json
```

Commit the deletion. pnpm is the declared package manager (`"packageManager": "pnpm@9.15.0"`). The npm lockfile is a ghost from before pnpm was established as policy.

---

## Section 2 — Structural / Organization Issues

These aren't breaking anything today but will cause "where does this live?" confusion as the codebase grows.

### 2.1 Legacy Root Directories Need Archiving ⚠️

The Feb 24 org audit already flagged these. There are 5 parallel app trees sitting at the repo root that predate the numbered `1-Apps/` system:

| Directory | Contains | Maps to Canonical |
|-----------|----------|-------------------|
| `ios/` | `app/`, `life-manager/` | Likely `1E-Opta-Life-IOS` or `1H-Opta-Scan-IOS` |
| `macos/` | `app/` | Likely `1J-Optamize-MacOS` |
| `native/` | `app/`, `life-manager/` | Likely `1J` or `1I-OptaPlus` |
| `mini/` | `OptaMini/`, `.xcodeproj` | `1G-Opta-Mini-MacOS` |
| `web/` | `life-manager-site/`, `optamize/` | `1F-Opta-Life-Web` or `1K-Optamize-Web` |

**Fix (non-destructive):**
```bash
mkdir -p ~/Synced/Opta/_LEGACY-ROOT-TREES
mv ios macos native mini web _LEGACY-ROOT-TREES/
```

Before moving: verify no active symlinks, build scripts, or CI processes point to these paths. Then archive for 30 days before deleting.

---

### 2.2 Undocumented / Unlisted App Directories ⚠️

Five directories exist in `1-Apps/` with no entry in `APPS-INDEX.md`, `README.md`, or `CLAUDE.md`:

| Directory | Status | What it appears to be |
|-----------|--------|-----------------------|
| `1P-Opta-Code-Desktop` | No README | Has `adapters/`, `contracts/`, `runbooks/` — possibly a desktop client scaffold integrated with Opta CLI daemon |
| `1N-Opta-Cloud-Accounts` | Has README | Supabase auth canonical contracts repo — well-structured but unlisted |
| `opta-pa-messenger` | Has code | A personal assistant messenger app (`next.config.js`, `package.json`) — no docs |
| `opta-phone-bridge` | Has code | Has a LaunchAgent plist — appears to be a running macOS service |
| `kimi-proxy` | Listed in README but not APPS-INDEX | Python FastAPI proxy at port 4999 — mentioned but status unclear |

**Fix:** For each directory, decide: is it active? If yes, add it to `APPS-INDEX.md` with a status, create an `APP.md`, and assign a numbered prefix (e.g., `1O-`, `1P-`). If no longer needed, archive it.

---

### 2.3 MonoUsage (1C) Status Conflict

| Doc | Says |
|-----|------|
| `README.md` | Retired (merged into 1G Opta Mini usage link) |
| `APPS-INDEX.md` | Active |

**Fix:** Update `APPS-INDEX.md` to mark 1C as `Retired` and add a note: *(merged into 1G-Opta-Mini-MacOS)*. Also update `CLAUDE.md` root which currently says "Mac Studio monitor" under 1C.

---

### 2.4 OptaNative Is an Unexplained Sub-Project Inside 1J

`1-Apps/1J-Optamize-MacOS/` contains `OptaNative/` and `OptaNative.xcodeproj`. There's no documentation about what this is. Is it:
- An experimental Swift/native port of Optamize?
- An embedded framework?
- Abandoned exploration?

**Fix:** Document what OptaNative is in `1J-Optamize-MacOS/README.md` or `CHANGELOG.md`. If abandoned, move it to a `_scratch/` folder inside 1J.

---

### 2.5 Session Log Directories Are Scattered

`12-Session-Logs` directories exist in:
- `/Opta/12-Session-Logs` (root level)
- `/Opta/1-Apps/1M-Opta-LMX/12-Session-Logs`
- `/Opta/1-Apps/1D-Opta-CLI-TS/12-Session-Logs`

**Fix:** Establish a policy. Either: (a) one root `12-Session-Logs/` where all app session logs live in subdirectories, or (b) per-app session logs are fine but should be explicitly `.stignore`d to avoid syncing large log files across devices.

---

### 2.6 Root `node_modules` Is Large and Undocumented

The org audit noted ~1.8GB of `node_modules` at the repo root. This is expected for a pnpm monorepo, but it's not documented as policy anywhere.

**Fix:** Add a note to the root `README.md` or `CLAUDE.md`: *"Root `node_modules` exists as pnpm monorepo workspace deps. Install with `pnpm install` from root. Never `npm install` at root."* Also add `node_modules` to `.stignore` if not already there.

---

## Section 3 — Documentation Gaps

### 3.1 Nine Apps Are Missing OPIS Documentation

From `APPS-INDEX.md`:

| App | Missing OPIS |
|-----|-------------|
| 1A — AI Components Web | ⬜ |
| 1B — AICompare Web | ⬜ |
| 1C — MonoUsage | ⬜ (retired anyway) |
| 1E — Opta Life iOS | ⬜ |
| 1F — Opta Life Web | ⬜ |
| 1G — Opta Mini macOS | ⬜ |
| 1H — Opta Scan iOS | ⬜ |
| 1J — Optamize macOS | ⬜ (has CLAUDE.md but not full OPIS scaffold) |
| 1K — Optamize Web | ⬜ |

OPIS docs are the primary way AI agents get context before working on a project. Without them, every coding session starts blind.

**Prioritize OPIS for:**
1. **1J Optamize macOS** — flagship app, active development, already has DESIGN_SYSTEM.md and CLAUDE.md but no APP.md or docs/ scaffold
2. **1E Opta Life iOS** and **1H Opta Scan iOS** — active iOS apps with no identity docs
3. **1F Opta Life Web** — deployed production app

Deferrable: 1A (scaffold-only), 1C (retired), 1K (marketing page).

---

### 3.2 INFRASTRUCTURE.md Describes Obsolete Setup

`docs/INFRASTRUCTURE.md` describes a setup that has since been replaced:

| What It Documents | What It Is Now |
|-------------------|----------------|
| llama.cpp server (port 8080) | Replaced by Opta LMX (port 1234) |
| LiteLLM Proxy (port 4000) | Legacy, kimi-proxy now at 4999 |
| "Clawdbot Gateway" | Renamed to OpenClaw |
| Models at `/Users/Shared/Models/` | Models now at `/Users/Shared/Opta-LMX/models/` |
| `~/llama.cpp/` | No longer the inference runtime |

**Fix:** Rewrite `docs/INFRASTRUCTURE.md` to reflect the current setup: Opta LMX as inference engine, OpenClaw as bot orchestration layer, Claude Code Router if still running. Archive the old version as `docs/INFRASTRUCTURE-LEGACY-2025.md`.

---

### 3.3 Terminology Inconsistency: Clawdbot vs OpenClaw

"Clawdbot" appears in `INFRASTRUCTURE.md` and older docs. "OpenClaw" appears in all current APP.md files (OptaPlus, Opta LMX, Opta CLI). These refer to the same system.

**Fix:** Global search-replace across all docs: `Clawdbot` → `OpenClaw`. Update the INFRASTRUCTURE.md rewrite (§3.2) to use OpenClaw throughout.

---

### 3.4 OptaPlus Phase Count Inconsistency

| Doc | Says |
|-----|------|
| `README.md` | 9/13 phases |
| `APPS-INDEX.md` | 8/13 phases |

**Fix:** Update `APPS-INDEX.md` to match the current phase count in `APP.md` / `README.md`. Run the OPIS health check on OptaPlus to confirm the current phase.

---

### 3.5 Opta CLI Version Inconsistency

| Doc | Says |
|-----|------|
| `APP.md` header | `status: BETA (v0.1.0, unfinished Aider fork)` |
| `package.json` | `"version": "0.5.0-alpha.1"` |
| `APPS-INDEX.md` | `BETA v0.5` |

`APP.md` says "v0.1.0, unfinished Aider fork" — this is stale. The app has grown well beyond that description (32 TypeScript files, daemon, browser tests, TUI).

**Fix:** Update `APP.md` frontmatter and description to reflect v0.5 reality. Remove "unfinished Aider fork" — it's its own thing now.

---

### 3.6 profile.md Has Unfilled Sections

`7-Personal/profile.md` has:
```
### Languages
*TBD — Ask Matthew*

### Frameworks
*TBD — Ask Matthew*
```

This is a blank memory slot. AI agents reading this file get no information about your technical background.

**Fix:** Fill in Languages and Frameworks. Example:
```
### Languages
TypeScript, Python, Swift, Rust (via Tauri), HTML/CSS

### Frameworks
React 19, Next.js 15/16, SwiftUI, FastAPI, Tauri v2, MLX
```

---

### 3.7 goals.md Is 30 Days Stale

`7-Personal/goals.md` was last updated 2026-01-26. Several items may have changed:
- "Set up GLM 4.7 on Mac Studio" — is this done? Opta LMX is live on Mono512.
- "Assemble server PC" — status?
- "Configure Proxmox with core services" — status?

**Fix:** Update goals.md with current status of each item and add new goals reflecting where development is now (e.g., "complete OptaPlus Telegram replacement", "ship Opta CLI v1", "Opta Local to production").

---

### 3.8 README.md and INDEX.md Are Out of Sync

`README.md` (the root "monorepo README") doesn't list 1L, 1M, or 1N apps and still shows 1C as MonoUsage (not retired). `INDEX.md` is more current. Having two semi-authoritative index files creates confusion.

**Fix:** Either: (a) delete `README.md` and use `INDEX.md` + `APPS-INDEX.md` as the source of truth, or (b) make `README.md` a brief entry point that just links to `APPS-INDEX.md`. Currently both files duplicate similar information at different levels of staleness.

---

### 3.9 MIGRATION-FROM-DOCUMENTS.md Can Be Archived

This migration doc records a completed migration (all steps checked off, "Completed: 2026-02-19"). It's taking up space at the root as noise.

**Fix:** Move it to `8-Project/8A-Reorganization-Docs/` as a historical record.

---

## Section 4 — App-Specific Incomplete Work

### 4.1 OptaPlus (1I) — 4 Phases Remaining

Status: 9/13 phases complete (0.9.0). The remaining 4 phases are blocking the core value proposition: iOS Telegram replacement + App Store launch.

No specific roadmap file was accessible during this audit, but based on APP.md, the unfinished areas are likely:
- CloudKit/iCloud sync for chat history
- Push notifications (APNs via OpenClaw)
- Siri integration
- App Store submission

**Priority:** High. This is daily-use infrastructure (replaces Telegram for all bot comms).

---

### 4.2 Opta CLI (1D) — Daemon Layer Needs Remote Fix

Beyond the remote build failure (§1.1), the daemon architecture (`src/daemon/`) is complex — 13 source files including a worker pool, permission coordinator, session manager, and WebSocket server. This suggests significant scope expansion beyond the v1 "3 capabilities" spec in APP.md.

**Questions to resolve:**
- Is the daemon in scope for v1.0 or is it a v2 feature that crept in?
- What's the current test pass rate on `test:parity:ws9`?
- Does the daemon need to run on Mono512 (remote) or just MacBook (local)?

---

### 4.3 Opta LMX (1M) — Phase 5A and 5B Blocked by CLI State

Remaining: Phase 5A (Opta CLI provider) lives in the CLI repo, Phase 5B (OpenClaw bot integration) lives in OptaPlus. Both depend on the other apps being stable first.

**Dependency chain:**
```
Opta LMX stable → Opta CLI v1 → Phase 5A complete → OpenClaw bots connected
                                                     → Phase 5B complete
```

Opta LMX is ~80% done and functional. The remaining ~20% is integration work that is blocked on the "brother app" (Opta CLI) reaching v1.

---

### 4.4 Opta Local (1L) — 4 Open Questions Unresolved

From `APP.md` Section 10:

1. Should the web app work as a PWA for mobile Safari?
2. Should session storage move from filesystem to LMX SQLite?
3. What authentication model for WAN beyond admin key? (JWT, TOTP)
4. Should Opta Local support multiple user accounts?

These are architectural decisions that will become harder to reverse once the web app ships. Resolve them before pushing to production.

**Recommended answers** (based on ecosystem context):
1. **PWA:** Yes — it's free, useful while iOS is deferred, and aligns with web-first strategy
2. **Session storage:** Defer to SQLite when LMX v1.0 is done; filesystem is fine for now
3. **WAN auth:** TOTP is the right balance (no extra infra, secure, single-user context)
4. **Multi-user:** No — this is a single-user tool built for Matthew's Mac Studio

---

### 4.5 AI Components Web (1A) — Scaffold Only, No Progress

1A has been in "Scaffold" status since at least Feb 19. There's no roadmap, no APP.md, no clear purpose documented anywhere.

**Fix:** Either: (a) define what this app is and start on it, or (b) explicitly mark it as `status: parked` in APPS-INDEX.md so it's clear it's not active. A parked scaffold confuses AI agents that encounter it.

---

### 4.6 Opta Code Desktop (1P-Opta-Code-Desktop) — Completely Undocumented

Has `adapters/`, `contracts/`, `runbooks/`, `supabase/`, and `tests/` directories but no README, no APP.md, not listed in any index. The name suggests it might be a codex/reference app for auth contracts (related to 1N-Opta-Cloud-Accounts?).

**Fix:** Add a one-paragraph README explaining what this is and why it exists. If it's merged into 1N-Opta-Cloud-Accounts, delete it (after verifying the contracts are in 1N).

---

## Section 5 — Prioritized Action List

Ordered by impact and blocking dependencies:

### Immediate (fix this week)

1. `ssh opta@192.168.188.11 && cd ...1D-Opta-CLI-TS && npm install` — unblock remote CLI build
2. Commit dirty working trees in 1D-Opta-CLI-TS and 1I-OptaPlus — unblock git pulls
3. `rm pnpm-workspace root package-lock.json` — remove duplicate lockfile
4. Initialize git in `1M-Opta-LMX` — protect live infrastructure

### Short-term (this month)

5. Archive legacy root directories (`ios/`, `macos/`, `native/`, `mini/`, `web/`) to `_LEGACY-ROOT-TREES/`
6. Update `INFRASTRUCTURE.md` to reflect Opta LMX / OpenClaw reality
7. Resolve the 4 open questions in Opta Local (1L) APP.md before web launch
8. Update `goals.md` with current status
9. Fill in `profile.md` Languages/Frameworks sections
10. Reconcile APPS-INDEX.md with README.md (one source of truth)

### Medium-term (next development cycle)

11. OPIS retrofit for 1J-Optamize-MacOS (flagship — highest priority among missing OPIS)
12. OPIS retrofit for 1H-Opta-Scan-IOS and 1E-Opta-Life-IOS
13. Document or archive: `1P-Opta-Code-Desktop`, `opta-pa-messenger`, `opta-phone-bridge`
14. Add 1N-Opta-Cloud-Accounts to APPS-INDEX.md
15. Fix OptaPlus phase count discrepancy, Opta CLI version inconsistency
16. Clarify/document OptaNative within 1J-Optamize-MacOS
17. Establish session log policy (root vs per-app)
18. Global find/replace: `Clawdbot` → `OpenClaw` across all docs

### Backlog

19. OPIS retrofit for 1A, 1B, 1F, 1G, 1K
20. Mark 1A as `parked` or give it a real definition
21. Archive `MIGRATION-FROM-DOCUMENTS.md` to 8-Project

---

## Section 6 — pnpm Workspace Gap

The `pnpm-workspace.yaml` lists 6 packages:

```yaml
packages:
  - "6-Packages/*"
  - "1-Apps/1A-AI-Components-Web"
  - "1-Apps/1B-AICompare-Web"
  - "1-Apps/1F-Opta-Life-Web"
  - "1-Apps/1K-Optamize-Web"
  - "1-Apps/1L-Opta-Local/web"
```

The CLAUDE.md root implies more web apps might be in the workspace but 1J, 1I, 1D, and 1M are intentionally excluded because they use their own package managers (npm for Tauri, npm for CLI, uv/pip for Python). This is correct architecture.

However: `package.json` at root has `workspaces` array that only includes 4 apps (missing 1L-Opta-Local/web). The workspace config is split between `pnpm-workspace.yaml` (correct, includes 1L) and `package.json` `workspaces` field (stale, doesn't include 1L). Since pnpm uses the yaml file, the `workspaces` field in package.json is dead config.

**Fix:** Remove the `workspaces` field from root `package.json` to avoid confusion. The yaml is the canonical config.

---

*End of Opta Optimization Guide — 2026-02-25*
