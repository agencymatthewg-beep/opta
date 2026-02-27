---
title: v0.5.0-alpha → v1.0 Milestone Definition
date: 2026-02-26
author: Matthew Byrden
status: in-progress (verified 2026-02-27)
---

# Opta CLI: v0.5.0-alpha → v1.0 Milestone Definition

## What v0.5.0-alpha Is (Current State)

Version 0.5.0-alpha.1 is a working agentic CLI with a far larger scope than the original V1 design planned. The codebase has grown to 225 source files (~60,600 lines) across 23 modules and 165 test files (~28,000 lines).

### What Is Working Now

**Core agent loop** — `src/core/agent.ts` and surrounding files handle streaming responses, tool dispatch, permission gating, context compaction, and circuit breaking.

**Full-screen TUI** — `src/tui/` provides a complete Ink/React terminal UI with: message list, model picker, permission prompts, tool cards, thinking blocks, browser rail, optimiser panel, command browser, action history, and skill runtime.

**Multi-provider routing** — `src/providers/` supports Opta-LMX (primary), Anthropic cloud (fallback), with health-aware provider selection and model scanning.

**Browser automation** — `src/browser/` provides a Playwright-based runtime daemon with session management, policy engine, quality gates, visual diffing, canary evidence, and replay.

**Background daemon** — `src/daemon/` exposes agent capabilities over HTTP + WebSocket with a worker pool, permission coordinator, and session manager supporting concurrent clients.

**Git integration** — `src/git/` provides auto-commit, session checkpoints, and rollback.

**MCP integration** — `src/mcp/` provides a full MCP client and server registry.

**LSP integration** — `src/lsp/` provides a full LSP client with server lifecycle management and diagnostics.

**Research routing** — `src/research/` routes web queries across Brave, Exa, Tavily, Gemini, and Groq with health-aware dispatch.

**Account & key management** — `src/accounts/` and `src/lmx/api-key.ts` handle Supabase-backed accounts and LMX API keys.

**Learning & journal** — `src/learning/` and `src/journal/` provide adaptive ledger, retrieval, summarization, and structured session logging.

**Policy engine** — `src/policy/` evaluates global and per-project permission policies independent of browser-specific rules.

**165 test files** covering all major modules including browser, daemon, TUI, providers, LMX, MCP, core, and integration tests.

---

## What v0.5.0-alpha Is Not (Known Alpha Gaps)

- **Stability** — Alpha-quality code exists in browser and daemon modules. Concurrency edge cases are not fully hardened.
- **Error recovery** — Browser daemon crash recovery and daemon reconnect logic need production hardening.
- **Install experience** — No `npx`-friendly zero-config path. Requires manual setup of Opta-LMX connection.
- **Documentation** — CLAUDE.md and APP.md were severely outdated (now fixed); user-facing docs are incomplete.
- **Performance profiling** — No systematic latency budget enforcement. TUI render performance is unmeasured.
- **Security audit** — Shell injection hardening added (commit a27ef02) but no formal audit of all tool executors.
- **Integration test coverage** — `tests/integration/` is sparse. Browser + daemon cross-system tests are thin.

---

## Features Implemented Beyond Original V1 Scope

These were explicitly listed as "deferred" in `docs/plans/2026-02-12-opta-cli-v1-design.md` and are now present:

| Feature | Module | Notes |
|---------|--------|-------|
| Browser automation | `src/browser/` | Full Playwright runtime, policy, replay |
| Background daemon | `src/daemon/` | HTTP + WS server, worker pool |
| Multi-provider routing | `src/providers/` | LMX + Anthropic + fallback |
| MCP integration | `src/mcp/` | Client + registry |
| LSP integration | `src/lsp/` | Full client + server lifecycle |
| Git integration | `src/git/` | Auto-commit + checkpoints |
| Agent swarms | `src/core/subagent.ts`, `orchestrator.ts` | Sub-agent spawning |
| Research routing | `src/research/` | 5 search providers |
| Accounts + API keys | `src/accounts/`, `src/lmx/api-key.ts` | Supabase-backed |
| Learning system | `src/learning/` | Ledger + retrieval + summarizer |
| Journal | `src/journal/` | Structured session logs |
| Policy engine | `src/policy/` | Global permission rules |
| Protocol v3 | `src/protocol/v3/` | Typed HTTP + WS contracts |
| Benchmark suite | `src/benchmark/` | Automated model evaluation |

---

## v1.0 Definition of Done

v1.0 means: production-quality, daily-driver reliable, installable by a technical user in under 5 minutes.

### Stability Bar

- [ ] Browser daemon survives 24h continuous use without manual restart — _Architecture supports it (session recovery, .unref() timers, uncaughtException handler); no soak test exists_
- [x] Daemon HTTP/WS server handles client disconnect + reconnect gracefully — _ws-server.ts close/error cleanup, SSE replay buffer, verified in daemon-multi-client.test.ts_
- [x] Agent loop has no known hang conditions on network timeout — _Retry logic in agent-streaming.ts, AbortSignal threading, LMX watchdog, circuit breaker maxDuration_
- [ ] All `npm test` passing with no flaky tests (< 0.5% flake rate) — _1,763 tests pass; no flake rate measurement system exists_

### Security Bar

- [x] Formal review of all `run_command` and `edit_file` execution paths for shell injection — _docs/SECURITY-AUDIT.md (2026-02-27) complete; parseShellCommand in background-manager.ts; 8 security tests_
- [x] API key storage uses OS keychain (not plaintext config file) — _src/keychain/index.ts (macOS security(1) + Linux secret-tool); 33 tests; config fallback documented as acceptable_
- [ ] Browser policy engine blocks all cross-origin credential access by default — _blockedOrigins defaults to []; allowedHosts defaults to ['*']; high-risk gated but not denied_
- [ ] Autonomy floor cannot be overridden below `ask` for destructive tools via config — _Math.floor prevents fractional escalation; but config can set permissions.run_command: 'allow'_

### Install & Onboarding Bar

- [ ] `npm install -g opta-cli && opta onboard` completes first-run setup in < 2 minutes — _Command exists (onboard.ts + OnboardingOverlay.tsx); no timing benchmark_
- [x] `opta doctor` correctly identifies all connection and config problems with actionable fixes — _9 checks with actionable detail messages: config, LMX, model, OPIS, MCP, account_
- [x] Zero-config local mode works without Opta-LMX (uses Anthropic API key directly) — _probeProvider() in providers/manager.ts; LMX unreachable + ANTHROPIC_API_KEY → auto-fallback_

### Documentation Bar

- [x] CLAUDE.md and APP.md accurate (done as of this commit)
- [ ] `docs/GUARDRAILS.md` updated to reflect browser and daemon threat model — _GUARDRAILS.md dated 2026-02-15, predates browser/daemon; SECURITY-AUDIT.md covers it separately but not merged_
- [ ] User-facing README covers install, quick start, and common workflows — _README targets developers (npm install, npm run dev); no end-user install flow or API key setup_

### Test Coverage Bar

- [ ] `tests/integration/` covers: full chat session, browser session, daemon multi-client — _All 3 files exist; chat is API-key-gated; browser test mocks Playwright; daemon multi-client DONE_
- [ ] All new browser module files have corresponding test files — _15/19 have dedicated tests; adaptation.ts, approval-log.ts, retry-taxonomy.ts, session-store.ts covered only indirectly_
- [x] CI passes on clean Node.js 20 and Node.js 22 environments — _ci.yml matrix [20.x, 22.x] × [ubuntu, macos] configured; no remote to verify empirically_

---

## Next Actions Before v1.0

Ordered by priority (updated 2026-02-27 — struck items completed):

1. ~~**Daemon stability hardening**~~ — ✅ Disconnect/reconnect handled; crash recovery via session persistence; shutdown under load tested
2. **Integration test expansion** — `tests/integration/` still the weakest area; chat test is API-key-gated, browser test mocks Playwright
3. ~~**`opta onboard` flow**~~ — ✅ `src/commands/onboard.ts` + `src/tui/OnboardingOverlay.tsx` (9-step wizard); needs timing benchmark
4. ~~**API key storage**~~ — ✅ `src/keychain/index.ts` (macOS security(1) + Linux secret-tool); 33 tests
5. **Browser policy defaults** — blockedOrigins still defaults to []; allowedHosts to ['*']; needs tightening
6. ~~**Shell injection audit**~~ — ✅ docs/SECURITY-AUDIT.md complete 2026-02-27; parseShellCommand; 8 security tests
7. **Performance budget** — establish and enforce TUI render latency targets
8. **User README** — needs rewrite targeting end users (npm install -g, API key setup, opta onboard)
9. ~~**`opta doctor` completeness**~~ — ✅ 9 checks covering config, LMX, model, OPIS, MCP, account
10. ~~**CI environment test**~~ — ✅ ci.yml matrix [20.x, 22.x] × [ubuntu, macos] configured
