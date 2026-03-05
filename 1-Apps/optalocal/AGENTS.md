# Repository Guidelines

## Project Structure & Module Organization
This workspace is a multi-app monorepo under `1-Apps/optalocal`. Core apps are prefixed by ID (for example `1R-Opta-Accounts`, `1S-Opta-Status`, `1T-Opta-Home`).  
Use `apps.registry.json` as the source of truth for app IDs, paths, ports, and task names.  
Workspace orchestration lives in `scripts/opta-local-workspace.mjs`. Canonical docs are in `docs/` (start at `docs/INDEX.md`).

## Build, Test, and Development Commands
Run commands from `1-Apps/optalocal` unless noted.

- `npm run apps:list` - list registered apps.
- `npm run apps:verify` - validate app registry/path integrity.
- `npm run dev:1x` (or `dev:1r`, `dev:1s`, etc.) - run one app locally.
- `npm run check:all` - run each app’s `check` task.
- `npm run build:all` - build all apps.
- `npm run docs:check` - validate canonical docs.
- `npm run monitor:synthetic` - production synthetic website checks.

Per-app checks are preferred before PRs, for example:
`npm --prefix 1R-Opta-Accounts run check`.

## Coding Style & Naming Conventions
Follow existing style in each app; do not reformat unrelated files.  
TypeScript/Next.js apps use ESLint + TypeScript checks via app-level scripts.  
Naming conventions:
- Components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts` / `useX.ts`
- API routes: `app/api/**/route.ts`
- Keep app directory prefixes (`1D`, `1R`, `1X`) unchanged.

## Testing Guidelines
There is no single global test runner; each app defines its own `check` pipeline.  
Minimum expectation for app changes:
1. Run that app’s `check` (or `typecheck` + `build` if no full check).
2. For web health/ops changes, run `npm run monitor:synthetic`.
3. Include exact commands and results in PR notes.

## Commit & Pull Request Guidelines
Use Conventional Commits (observed pattern), for example:
- `feat(cli): ...`
- `fix(desktop): ...`
- `ci(init): ...`
- `docs(updates): ...`

PRs should include:
1. Scope summary (which app IDs changed).
2. Verification evidence (commands + pass/fail).
3. UI screenshots for visual changes.
4. Any domain, workflow, or secret/config impact.

## Security & Configuration Tips
Never commit secrets. Use Vercel envs and GitHub Actions secrets.  
If monitoring/alerts are touched, document required secret names (for example `OPTA_MONITOR_ALERT_WEBHOOK_URL`).
