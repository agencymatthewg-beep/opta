# Next.js Static Export Vercel Sandboxing & Missing Dependency Crashes

**Date:** 2026-03-07

**Symptom:** Vercel deployment of a monorepo Next.js app (`1O-Opta-Init`) crashes consistently with `exit code 1` immediately after the `Running TypeScript...` phase, or encounters routing errors preventing a clean static export. However, the exact same build executes flawlessly locally (`npm run build`).

**Root Cause:**
There are two strictly enforced isolation behaviors on Vercel's Edge network that easily bypass local macOS environments:

1. **Sandboxing Trace Breakage:** In a static export (`output: 'export'`), Next.js naturally does not compile serverless functions. However, if `next.config.ts` includes `outputFileTracingRoot: path.join(__dirname, '../../')` (a common monorepo setting), it instructs the Vercel builder to traverse outside its secured subdirectory sandbox. This instantly crashes the static build.
2. **Missing Hoisted Dependencies:** The app imported `@opta/protocol-shared`, which was present in the global monorepo `node_modules` (working locally via hoisting), but was *not* declared explicitly inside the local app's `package.json`. Vercel leverages `npm ci` within an isolated Linux container, meaning the unlisted module causes an immediate fatal compile failure.

**Fix:**

1. **Disable Tracing for Static Sites:** Removed the obsolete `outputFileTracingRoot` entirely from `next.config.ts` as it's structurally incompatible with `output: 'export'`.
2. **Decouple or Re-declare:** To fix the build crash organically, either correctly add the monorepo workspace package into the local `package.json`, or completely inline the heavily requested code (e.g., union types) to decouple the static frontend entirely from the internal workspace dependencies.

**Rule:**
Never rely on monorepo node_module hoisting for Next.js deployments. Vercel runs isolated containers; if an import isn't specified in the local subdirectory's `package.json`, it will critically fail to build. Additionally, purge all serverless tracing paths during static export builds to prevent path traversal crashes.
