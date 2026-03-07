# GEMINI.md — optalocal Workspace

This file is the workspace-level context router for Antigravity. Front-loaded critical rules. Read per-app GEMINI.md before touching any app's code.

## Top 5 Critical Rules

1. **Long-term only** — no fragile fixes, no shortcuts with negative downstream implications
2. **Read the app's GEMINI.md first** — 6 of 11 apps have their own; always read before working in one
3. **Session start** → check `todo-optalocal/` for pending tasks, check `lessons-optalocal/` for past gotchas/fixes, check `optalocal-updates/` for latest log number
4. **Design changes** → always activate `frontend-design` skill + provide 3 prototypes for review
5. **Proactive commit** → commit autonomously with a conventional commit after every verified task

> See full session cheat sheet: `docs/ANTIGRAVITY-CONTEXT.md`

---

## Product Taxonomy (Non-Negotiable)

**4 Core Apps:**

| App | Dir | Stack |
|-----|-----|-------|
| Opta CLI | `1D-Opta-CLI-TS/` | TypeScript, Commander, Ink, Vitest |
| Opta LMX | `1M-Opta-LMX/` | Python 3.12, FastAPI, MLX |
| Opta Code Desktop | `1P-Opta-Code-Universal/` | Tauri v2, React 18, Vite 7 |
| LMX Dashboard | `1L-Opta-LMX-Dashboard/` | Next.js 16, SWR |

**7 Management Websites:**

| App | Dir | Domain |
|-----|-----|--------|
| Opta Home | `1T-Opta-Home/` | optalocal.com |
| Opta Init | `1O-Opta-Init/` | init.optalocal.com |
| Opta Help | `1U-Opta-Help/` | help.optalocal.com |
| Opta Learn | `1V-Opta-Learn/` | learn.optalocal.com |
| Opta Accounts | `1R-Opta-Accounts/` | accounts.optalocal.com |
| Opta Status | `1S-Opta-Status/` | status.optalocal.com |
| Opta Admin | `1X-Opta-Admin/` | admin.optalocal.com |

Do NOT label management websites as core apps.

---

## Architecture

```
opta chat / opta tui / opta do         (1D — CLI commands)
        │
opta daemon  127.0.0.1:<port>          (1D — HTTP v3 REST + WS streaming)
        │
Opta LMX  192.168.188.11:1234          (1M — OpenAI-compatible API)
        │
Opta Code Desktop                      (1P — connects to daemon over HTTP/WS)
```

**Host policy:** MacBook (Opta48) is client-only. Never run `opta-lmx` locally. Inference host = Mono512 (192.168.188.11).

---

## Dev Commands Quick Reference

| App | Dev command | Port | Static export? |
|-----|------------|------|----------------|
| 1D-Opta-CLI-TS | `npm run dev` | — | No |
| 1M-Opta-LMX | `uvicorn ... --port 1234` | 1234 | No |
| 1P-Opta-Code-Universal | `npm run dev` | 5173 | No |
| 1L-Opta-LMX-Dashboard | `npm run dev` | 3003 | No |
| 1O-Opta-Init | `npm run dev` | 3001 | Yes |
| 1R-Opta-Accounts | `npm run dev` | 3002 | No |
| 1S-Opta-Status | `npm run dev` | 3005 | No |
| 1T-Opta-Home | `npm run dev` | 3000 | No |
| 1U-Opta-Help | `npm run dev` | 3006 | Yes |
| 1V-Opta-Learn | `npm run dev` | 3007 | No |
| 1X-Opta-Admin | `npm run dev` | 3008 | No |

Package managers: `npm` for all JS apps, `pip/uv` for 1M (Python venv at `.venv/`).

---

## Shared Design System (Non-Negotiable)

| Concern | Rule |
|---------|------|
| Background | `#09090b` (OLED void black — never `#000`) |
| Primary | `#8b5cf6` (Electric Violet) |
| Fonts | Sora (UI) + JetBrains Mono (code/stats) |
| Icons | Lucide React only — no inline SVGs |
| Glass panels | `.glass` / `.glass-subtle` / `.glass-strong` |
| Animations | Framer Motion spring physics only (never CSS ease/linear) |
| Colors | CSS variables only — never hex/rgb literals in components |
| Mode | Dark only |

---

## Deployment

All Next.js sites → Vercel at `*.optalocal.com`. CLI → npm. Desktop → GitHub Releases.

After any live deployment, log to `optalocal-updates/NNNN-slug.md` (see README in that dir for template).

---

## Design Preservation Rules

- **Opta Init (1O):** Design preserved. NO redesigns — only targeted feature additions.
- **Opta Home (1T):** Precision over decoration. No `output: 'export'`. No generic AI aesthetics.

---

## Live Production Update Logging

Any live release MUST be documented:

1. Check `optalocal-updates/` for latest `NNNN-slug.md`
2. Create next sequential file
3. Follow template in `optalocal-updates/README.md`
4. Commit alongside your changes

---

## Cross-App Coordination (`todo-optalocal/`)

When identifying changes needed in another app, drop a handoff doc:

```
{TargetApp}-{brief-reason}-{YYYYMMDD-HHmm}.md
```

See `todo-optalocal/README.md` for the full template.

---

## Lessons & Knowledge (`lessons-optalocal/`)

When discovering any workspace-specific fix, gotcha, or repeated pattern:

1. Write a new entry in `lessons-optalocal/YYYY-MM-DD-slug.md`.
2. All AI agents **must** read `lessons-optalocal/` at the start of a session or before attempting complex fixes to ensure they autonomously adopt past learnings and avoid repeating documented mistakes (such as the Vercel sandboxing and Next.js static export bugs).

---

## Key Capabilities (as of 2026-03-05)

- **Voice/Audio pipeline:** LMX `/v1/audio/transcriptions` (STT) + `/v1/audio/speech` (TTS). Daemon `audio.transcribe` + `audio.tts`. Desktop mic button in `Composer.tsx`.
- **Auth:** Supabase SSO, cookie domain `.optalocal.com`. Google/Apple OAuth + email. Redirect whitelist enforced.
- **Workspace orchestration:** `apps.registry.json` + `scripts/opta-local-workspace.mjs`. Run `npm run apps:list` to verify.
