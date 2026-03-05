# Antigravity Session Context — optalocal Workspace

> Cheat sheet for starting a productive session in this codebase.
> Read this alongside `optalocal/GEMINI.md` and the relevant app's own GEMINI.md.

---

## What This Workspace Is

**optalocal/** is the Opta Local product family — Matthew's production-grade local AI coding stack. It contains 4 core apps and 7 management websites, all under `optalocal.com`.

Matthew wants **long-term, production-grade** solutions. Never fragile fixes. Never hack-and-hope.

---

## Session Start Protocol (Always)

```bash
# 1. Check for pending cross-app tasks
ls /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/todo-optalocal/

# 2. Check latest production update log number
ls /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/optalocal-updates/

# 3. Read the specific app's GEMINI.md before touching code
cat <app-dir>/GEMINI.md  # or CLAUDE.md
```

---

## App Quick Reference

| App | Dir | Port | Live URL |
|-----|-----|------|----------|
| Opta CLI | `1D-Opta-CLI-TS/` | — | npm package |
| Opta LMX | `1M-Opta-LMX/` | 1234 | local daemon |
| Opta Code Desktop | `1P-Opta-Code-Universal/` | 5173 | localhost |
| LMX Dashboard | `1L-Opta-LMX-Dashboard/` | 3003 | lmx.optalocal.com |
| Opta Home | `1T-Opta-Home/` | 3000 | optalocal.com |
| Opta Init | `1O-Opta-Init/` | 3001 | init.optalocal.com |
| Opta Help | `1U-Opta-Help/` | 3006 | help.optalocal.com |
| Opta Learn | `1V-Opta-Learn/` | 3007 | learn.optalocal.com |
| Opta Status | `1S-Opta-Status/` | 3005 | status.optalocal.com |
| Opta Accounts | `1R-Opta-Accounts/` | 3002 | accounts.optalocal.com |
| Opta Admin | `1X-Opta-Admin/` | 3008 | admin.optalocal.com |

---

## Skill Activation Map (optalocal specific)

| Task | Skills to Activate |
|------|--------------------|
| Any UI/visual change | `frontend-design` → generate 3 prototypes → get feedback |
| Next.js bug hunt | `systematic-debugging` + `nextjs-developer` |
| Vercel / Cloudflare deploy | `devops-engineer` + `vercel-react-best-practices` + `cloudflare` |
| TypeScript / ESM issue | `javascript-pro` + `systematic-debugging` |
| Python/FastAPI (LMX) | `fastapi-expert` + `python-pro` |
| Desktop (Tauri/React) | `javascript-pro` + `feature-forge` |
| Multi-app change | `dispatching-parallel-agents` + `subagent-driven-development` |
| Cross-app audit | `/sync-check` workflow |

---

## Non-Negotiable Design Rules

- **Background:** `#09090b` (OLED void black — never `#000`)
- **Primary:** `#8b5cf6` (Electric Violet)
- **Fonts:** Sora (UI) + JetBrains Mono (code/stats)
- **Icons:** Lucide React only
- **Animation:** Framer Motion spring physics only (never CSS ease/linear)
- **Colors:** CSS variables only — never hex literals in component code
- **Dark mode only**

---

## Orchestration Patterns

**Multi-site changes (use parallel agents):**

```
1. Dispatch browser_subagent or start_subagent for site A
2. Do work on site B in main thread
3. Both complete in parallel → commit together
```

**Noisy tasks (tests, large searches):**

- Fork via `subagent-driven-development` skill
- Return clean summary to main thread
- Never flood main context with 100+ lines of test output

**Git worktrees for parallel editing of same repo:**

```bash
git worktree add ../opta-work-branch feature/my-branch
```

---

## Production Deployment Checklist

When shipping a live site change:

1. Run `npm run build` (must pass with 0 errors)
2. Run `npm run typecheck` (0 errors)
3. Deploy: `vercel deploy --prod`
4. Log to `optalocal-updates/NNNN-slug.md` (check README for template)
5. Commit with conventional commit: `feat(1t-home): description`

---

## Cross-App Coordination

When identifying needed changes in another app while working in one:

- **Don't context-switch blindly**
- Drop a handoff doc in `todo-optalocal/` using format: `{TargetApp}-{reason}-{YYYYMMDD-HHmm}.md`
- See `todo-optalocal/README.md` for the full template

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `optalocal/GEMINI.md` | Workspace-level router context |
| `optalocal/apps.registry.json` | Canonical app ID, path, port registry |
| `optalocal/optalocal-updates/README.md` | Live update log template |
| `optalocal/todo-optalocal/README.md` | Cross-agent handoff template |
| `optalocal/docs/` | Cross-app standards and audit reports |
| `~/.gemini/antigravity/lessons.md` | Antigravity's own learning log |
| `SOT/1D-Rules/CONTEXT-ENGINEERING-RULES.md` | R1-R10 context engineering rules |
