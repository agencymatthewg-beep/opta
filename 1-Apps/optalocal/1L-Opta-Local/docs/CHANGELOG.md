## 2026-02-28

### [Shared]
- Removed secondary-client application scaffolding by explicit user request.
- Normalized project metadata/docs/configs to web-only scope.
- Removed non-web channel namespaces from release channel config.

# Opta Local — Changelog

> What changed and when. Tagged [Web] / [Shared].

---

## [Unreleased]

### [Web] 2026-02-28 — Phase 5 Complete + Vercel Auto-Deploy Restored

- Auth-first architecture: mandatory sign-in in cloud mode via `SignInOverlay`; `useAuthSafe()` now the standard hook for dual-mode components
- Dedicated `/sign-in` page with `next`-path intent, atmospheric background, Google/Apple/email OAuth
- Dashboard aesthetic: migrated from Terminal Core HUD to Gemini-style luminous depth with ambient orbs and iridescent card shimmer
- Restored Vercel auto-deploy: deleted rogue Vercel projects hijacking webhooks, reconnected GitHub integration, fixed shallow-clone git syntax in `ignoreCommand`, added pnpm-lock.yaml to monitored paths
- Fixed `ERR_PNPM_OUTDATED_LOCKFILE` CI failures: committed `pnpm-lock.yaml` in sync with devDependencies added during testing infrastructure phase
- Added `ConnectionProvider` settings-update reactivity; `STATUS_STRIP_POLL` hook dependency fixed (React warning suppressed)
- Added `AuthProvider` mock to `ConnectionProvider` unit tests (fixes test isolation failure)
- Shared components added: `CommandPalette`, `OptaPrimitives` (`OptaSurface`), `ConnectionBadge`
- Services management API routes: `/api/services/status`, `/api/services/setup`, `/api/services/test`
- 14 code-quality refinements committed and deployed (conditional rendering, type safety, hook hygiene)
- Deleted 6 vestigial `.bak` files from `src/app/` and `src/components/shared/`
- Doc sync complete: ROADMAP, FEATURES, CHANGELOG updated to reflect Phase 5 reality

### [Web] 2026-02-20 — Web CI Hardening
- Hardened web CI for deterministic monorepo `pnpm` installs, added `test:integration` to quality gates, and kept Playwright smoke manual-only via `workflow_dispatch`.

### [Web] 2026-02-20 — Web Testing + CI
- Added Vitest config (`web/vitest.config.ts`) and meaningful unit tests for connection probing and sessions filtering/deletion (`web/tests/unit/connection.test.ts`, `web/tests/unit/useSessions.test.tsx`)
- Added `ConnectionProvider` reactivity unit coverage for settings load, settings-update event reload, and default fallback on load failure (`web/tests/unit/connection-provider.test.tsx`)
- Added LMX client integration tests with an in-process HTTP server for streaming SSE parsing, malformed-line tolerance, and non-2xx error propagation (`web/tests/integration/lmx-client.integration.test.ts`)
- Added Playwright smoke E2E config/tests for `/`, `/settings`, and `/chat` load checks (`web/playwright.config.ts`, `web/tests/e2e/smoke.spec.ts`)
- Updated `web/package.json` with dedicated web test scripts (`test:unit`, `test:e2e`, `test:ci`) and required dev dependencies
- Added web CI workflow `.github/workflows/opta-local-web-ci.yml` for PR/push checks (lint, typecheck, unit tests, build) with optional manual E2E execution
- Added Playwright artifact ignores to `web/.gitignore` (`/playwright-report/`, `/test-results/`)
- Switched CI install/execution to monorepo `pnpm` flow (workspace-aware, compatible with `@opta/ui: workspace:*`)

### [Web] 2026-02-20 — Security Hardening
- Added robust global HTTP security headers and CSP in `web/next.config.ts` with dev-safe script policy for Next.js tooling
- Added markdown URL protocol allowlist sanitization (`http/https/mailto/tel`) in `web/src/components/chat/ChatMessage.tsx`
- Added metadata referrer policy in `web/src/app/layout.tsx` to align browser-level behavior with HTTP headers
- Added a security-header smoke check command to `docs/WORKFLOWS.md`

### [Web] 2026-02-20 — Web Stabilization Pass
- Fixed web lint pipeline for Next.js 16 by adding an ESLint flat config and updating `web/package.json` scripts (`lint`, `typecheck`, `check`)
- Added `npm run typecheck` and consolidated quality gate command (`npm run check`)
- Migrated `web/src/middleware.ts` to `web/src/proxy.ts` to align with Next.js deprecation guidance
- Added `turbopack.root` in `web/next.config.ts` to stabilize monorepo builds
- Improved chat stream cancellation by passing `AbortSignal` into `LMXClient.streamChat()`
- Fixed stream request message construction in `useChatStream` to avoid scheduler-order coupling
- Added connection settings update event in `web/src/lib/connection.ts`
- Updated `ConnectionProvider` to reload settings on same-tab updates and storage changes
- Unified web client wiring for `chat`, `chat/[id]`, `sessions`, `rag`, `arena`, `agents`, and `ChatContainer` to consume `ConnectionProvider` context instead of per-page `createClient/getConnectionSettings` initialization
- Cleaned web lint warnings in affected files (`devices`, `tunnel`, `RAG query`, `agent workflow`, `cloud sync`, `sessions`, `sign-in`)

### [Shared] 2026-02-20 — Web-First Documentation Alignment
- Updated `APP.md` status and current phase to reflect active web-first development
- Updated `docs/WORKFLOWS.md` commands and quality gates to match real web scripts
- Rewrote `web/docs/ROADMAP.md` to reflect completed phases and active stabilization phase
- Updated `web/docs/FEATURES.md` statuses from planned to current implementation reality
- Archived stale planning file as `web/docs/PLAN.md` historical context

### [Shared] 2026-02-18 — Project Initialization
- OPIS v2.0 scaffold created (18 files)
- Initial multi-surface scaffold
- 13 features tracked as Active requirements
- 9 initialization decisions recorded

---

*Updated — 2026-02-28*
