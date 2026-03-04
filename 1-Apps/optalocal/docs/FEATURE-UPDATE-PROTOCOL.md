# Feature Update Protocol — Opta Help & Opta Status

> **Audience:** All AI agents working in this monorepo.
> **Rule:** After shipping any feature, you MUST follow this protocol.

---

## Why This Exists

Opta Help (`1U`) and Opta Status (`1S`) are **manually-maintained** live websites. They do not auto-scrape code. When features are added in `1D`, `1M`, or `1P` but these sites aren't updated, users see stale documentation and incorrect feature completeness metrics.

---

## How Each Site Is Fed

### Opta Status — Feature Registry (`status.optalocal.com/features`)

**Source files** (commit to update the live site):

```
1S-Opta-Status/docs/features/
  cli.md          ← 1D-Opta-CLI-TS features
  lmx.md          ← 1M-Opta-LMX features
  code-desktop.md ← 1P-Opta-Code-Universal features
  accounts.md     ← 1R-Opta-Accounts features
  init.md         ← 1O-Opta-Init features
  local-web.md    ← 1L-Opta-LMX-Dashboard features
  help.md         ← 1U-Opta-Help features
  learn.md        ← 1V-Opta-Learn features
  status.md       ← 1S-Opta-Status features
  admin.md        ← 1X-Opta-Admin features
```

**Format:** GitHub-flavored markdown task lists. `- [x]` = shipped, `- [ ]` = planned.

**Update rule:** Add a `- [x]` entry for every new feature you ship. Update the `## Recent Updates` section in the target app's file.

### Opta Help — Navigation (`help.optalocal.com/docs/*`)

**Source files:**

```
1U-Opta-Help/lib/content.ts     ← Navigation tree (add new doc page links here)
1U-Opta-Help/app/docs/          ← Per-page TSX content files
```

**Update rule:** When a new feature area is added, add an entry to the relevant `NavSection` in `lib/content.ts`. Create the corresponding `app/docs/{section}/page.tsx` if the doc page doesn't yet exist.

---

## Agent Checklist — After Every Feature Ship

When you complete implementation of a feature in any core app:

- [ ] **1S: Status features** — add `- [x]` entries to the relevant `docs/features/{appId}.md`
- [ ] **1S: Recent Updates** — append a dated entry to `## Recent Updates` in the same file
- [ ] **1U: Help nav** — add nav entry to `lib/content.ts` if a new doc section is needed
- [ ] **1U: Help content** — create or update `app/docs/{section}/page.tsx` with the feature docs
- [ ] **`optalocal-updates/`** — log the live release if the feature is user-facing
- [ ] **`todo-optalocal/`** — drop a handoff doc if other apps need related changes

---

## Automation Gap

Currently, there is **no CI/CD that auto-updates these files**. The optimal future state would be:

1. A GitHub Action triggered on merge to `main` that runs a script to:
   - Parse `optalocal-updates/*.md` for new feature entries
   - Append them to the matching `docs/features/{appId}.md`
   - Trigger a Vercel redeploy of `1S` and `1U`

2. A structured frontmatter format in `optalocal-updates/` entries with `app:` and `features:` keys that the script can parse automatically.

Until then, **agents must update these files manually** as part of every feature commit.

---

## Files Updated as of 2026-03-04

| File | What was added |
|------|----------------|
| `1S/docs/features/lmx.md` | Voice & Audio section (STT/TTS endpoints) |
| `1S/docs/features/cli.md` | Voice & Audio Operations + Cross-App Coordination sections |
| `1S/docs/features/code-desktop.md` | Voice Dictation section + 2026-03-04 recent update entry |
| `1U/lib/content.ts` | "Voice & Audio" nav item under LMX section |
| `GEMINI.md` | Voice & Audio Capabilities section + todo-optalocal reference |
| `docs/ARCHITECTURE.md` | Flow D (voice), Cross-App Coordination |
| `1D/docs/DAEMON-INTEROP-CONTRACT.md` | audio ops, V3 events |
| `1M/docs/ECOSYSTEM.md` | audio endpoints, deps, integration checklist |
