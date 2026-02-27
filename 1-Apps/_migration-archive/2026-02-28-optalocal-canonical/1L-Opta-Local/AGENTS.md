# Repository Guidelines

## Project Structure & Module Organization
- `web/` contains the Next.js 16 client. App routes live in `web/src/app`, reusable UI in `web/src/components`, hooks in `web/src/hooks`, API/data utilities in `web/src/lib`, and shared types in `web/src/types`.
- `web/tests/` is split by level: `unit/`, `integration/`, and `e2e/`.
- `ios/` contains the SwiftUI app (`ios/OptaLocal/...`). Treat `ios/project.yml` as the source of truth for project structure and settings.
- `supabase/migrations/` stores SQL migrations for cloud sync/auth data.
- `docs/` holds architecture notes, workflows, plans, and changelog context.

## Build, Test, and Development Commands
- Web commands (run in `web/`):
  - `pnpm dev` starts local dev server on `http://localhost:3004`.
  - `pnpm build` creates the production build.
  - `pnpm lint` runs ESLint.
  - `pnpm typecheck` runs `tsc --noEmit`.
  - `pnpm test:unit` and `pnpm test:integration` run Vitest suites.
  - `pnpm test:e2e:smoke` runs Playwright smoke coverage.
  - `pnpm check` runs the CI gate (`lint + typecheck + unit + integration + build`).
- iOS commands (run in `ios/`):
  - `xcodegen generate` regenerates `.xcodeproj` after file/layout changes.
  - `xcodebuild -scheme OptaLocal -destination 'platform=iOS Simulator,name=iPhone 16' build` performs a CLI build.

## Coding Style & Naming Conventions
- TypeScript is strict; avoid `any` and prefer explicit, narrow types.
- Use `@/*` imports for modules under `web/src`.
- React component files use `PascalCase` (example: `ConnectionBadge.tsx`); hooks use `useX` naming (example: `useSSE.ts`).
- Swift types use `PascalCase`, members use `camelCase`, and async/await with `@MainActor` view models is preferred.
- Keep styling consistent with shared design tokens/helpers instead of ad hoc literals.

## Testing Guidelines
- Primary frameworks: Vitest (unit/integration) and Playwright (E2E).
- Naming conventions: `*.test.ts` / `*.test.tsx` for Vitest, `*.spec.ts` for Playwright.
- Add or update tests in the same PR for behavior changes and bug fixes.
- Run `pnpm check` in `web/` before requesting review.

## Commit & Pull Request Guidelines
- Use conventional commit style seen in history: `type(scope): summary` (for example, `fix(web): add missing dependency to StatusStrip useEffect`).
- Typical types: `feat`, `fix`, `refactor`, `perf`, `test`, `chore`.
- PRs should include: concise summary, affected area(s) (`web`, `ios`, `supabase`), verification commands/results, and screenshots for UI changes.
- Link related issue(s) or planning doc(s) when available.
