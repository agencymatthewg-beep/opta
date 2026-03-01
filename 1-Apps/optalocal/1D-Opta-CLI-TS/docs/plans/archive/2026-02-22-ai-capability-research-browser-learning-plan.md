---
status: archived
---

# Opta AI Capability Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three high-leverage competitive capabilities in Opta CLI: multi-provider research connectors, integrated browser control (Playwright + screenshotting + navigation), and autonomous learning/documentation of plans-problems-solutions.

**Architecture:** Add a new capability layer (`src/research`, `src/browser`, `src/learning`) while reusing Opta's existing config menu, tool registry, slash command system, and session persistence. Keep provider/tool discoverability dynamic so the model always gets an up-to-date capability manifest and can autonomously route work.

**Tech Stack:** TypeScript, OpenAI-compatible tool calling, existing Opta MCP registry, Playwright, JSONL/Markdown knowledge artifacts, Vitest.

---

## 1) Research Findings (External + Current Codebase)

### 1.1 External capability facts that matter for design

- **Tavily**
  - Official API endpoint is `POST https://api.tavily.com/search` and supports an explicit `api_key` auth field with parameters like `query`, `topic`, `search_depth`, `max_results` (official docs and quickstart).  
  - `search_depth: "advanced"` is explicitly tied to deeper result retrieval and higher credits, useful for an “expensive but deep” tier.

- **Gemini**
  - Gemini API key guidance is explicit: use `GEMINI_API_KEY`, keep it server-side, and never expose in frontend code.  
  - Function-calling supports mode control (`AUTO`, `ANY`, etc.) and allowed function whitelisting, which maps well to Opta’s autonomous tool use model.  
  - Grounding with Google Search is available as built-in tooling (`google_search`) through the API.

- **Exa**
  - Exa uses `x-api-key` auth and exposes `/search`, `/answer`, and content retrieval endpoints.  
  - Exa docs show query optimization controls (`useAutoprompt`) and explicit model controls (`exa` and `exa-research`) for answer generation.

- **Brave Search API**
  - Brave’s Web Search API uses `X-Subscription-Token` auth and offers filtering/aggregation parameters for web/news/image/video use cases.  
  - Brave docs include usage guidance and pricing/rate-limit considerations, so Opta should treat Brave as a costed connector with quotas.

- **Groq**
  - Groq uses `GROQ_API_KEY` with OpenAI-compatible SDK usage.  
  - Groq supports built-in tools and Remote MCP, which creates a second path for capability expansion (native HTTP wrappers or MCP passthrough).

- **Playwright / Browser control**
  - Playwright provides deterministic browser automation primitives, screenshot APIs, isolated browser contexts, and traces.  
  - `connectOverCDP` and persistent contexts enable controlled attachment to existing browser sessions.  
  - `@playwright/mcp` already exposes browser actions as MCP tools with security flags (`--allowed-hosts`, `--blocked-origins`) and an isolated profile mode.

- **Learning / autonomous self-improvement**
  - ReAct demonstrates stronger outcomes when reasoning and actions are interleaved.  
  - Reflexion demonstrates measurable gains from explicit self-reflection after attempts.  
  - LangGraph docs show production-grade memory patterns (persistent stores, semantic retrieval, interrupt/resume workflows) directly applicable to Opta’s session loop.

### 1.2 Current Opta codebase facts that shape implementation

- Config and interactive config menu already exist and are extensible:
  - `src/core/config.ts`
  - `src/commands/config.ts`
  - `src/commands/slash/manage.ts`
- Tool schemas + execution routing are centralized and already support MCP + custom tools:
  - `src/core/tools/schemas.ts`
  - `src/core/tools/executors.ts`
  - `src/mcp/registry.ts`
- System prompt is already assembled centrally and mode-aware:
  - `src/core/agent-setup.ts`
- Research mode currently only toggles permissions and appends a simple session marker:
  - `src/commands/slash/research.ts`
  - `src/commands/slash/workflow.ts`
- Memory currently supports only unstructured `.opta/memory.md` appends plus session JSON:
  - `src/core/tools/executors.ts` (`save_memory`)
  - `src/memory/store.ts`

## 2) Target Product Behavior

### 2.1 Feature A: Research Keys + Autonomous Capability Routing

User outcome:
- `opta config menu` (and `/config menu`) includes a dedicated **Research** section for Tavily, Gemini, Exa, Brave, Groq key entry and toggles.
- Agent always sees a dynamic capability manifest (what connectors are enabled, what each is best at, current health).
- Agent autonomously picks connectors and retries/falls back when one provider fails or is rate-limited.

System outcome:
- New research abstraction decouples provider-specific API details from tool layer.
- One stable “intent-driven” research tool contract for model simplicity.

### 2.2 Feature B: Browser control + screenshot + navigation

User outcome:
- Agent can open sites, click/type, extract snapshots, take screenshots, and return artifacts.
- Can run in either isolated browser profile mode (default) or optional attached mode with explicit user consent.

System outcome:
- Phase 1: ship quickly via MCP (`@playwright/mcp`) integration path.
- Phase 2: native first-party browser tool path for tighter control and Opta-specific UX.
- All actions logged with artifact paths and trace IDs.

### 2.3 Feature C: Learning + autonomous documentation

User outcome:
- Opta automatically captures plan/problem/solution records with evidence.
- Opta can retrieve prior lessons and adapt behavior.
- Project-level logs become useful institutional memory, not raw chat transcripts.

System outcome:
- Structured learning ledger (JSONL + markdown summaries) with verifiable evidence links.
- Reflection loop after key events (error, rollback, success).
- Prompt includes top relevant learned constraints before execution.

## 3) Architecture Blueprint

### 3.1 New modules

- `src/research/`
  - `types.ts` — provider and normalized result contracts.
  - `registry.ts` — provider factory from config.
  - `router.ts` — intent-based provider routing + fallback.
  - `providers/tavily.ts`
  - `providers/gemini.ts`
  - `providers/exa.ts`
  - `providers/brave.ts`
  - `providers/groq.ts`
  - `health.ts` — connectivity/rate-limit health summaries.

- `src/browser/`
  - `types.ts` — browser session/action/result contracts.
  - `mcp-bootstrap.ts` — Playwright MCP setup helper.
  - `native-session-manager.ts` — optional first-party Playwright session management.
  - `artifacts.ts` — deterministic screenshot/trace storage.

- `src/learning/`
  - `types.ts` — plan/problem/solution/reflection schemas.
  - `ledger.ts` — append/read/query JSONL ledger.
  - `summarizer.ts` — markdown summary writer.
  - `retrieval.ts` — task-to-lessons relevance retrieval.
  - `hooks.ts` — capture events from slash mode transitions + tool outcomes.

### 3.2 Core modifications

- Config schema expansion:
  - `src/core/config.ts`
- Config CLI + slash menu for research keys and health checks:
  - `src/commands/config.ts`
  - `src/commands/slash/manage.ts`
- Tool schemas/executors for new research + browser + learning actions:
  - `src/core/tools/schemas.ts`
  - `src/core/tools/executors.ts`
- Dynamic capability manifest injected into system prompt:
  - `src/core/agent-setup.ts`
  - `src/mcp/registry.ts` (expose runtime tool manifest summary hook)
- Learning persistence integrated with session lifecycle:
  - `src/memory/store.ts`
  - `src/commands/slash/research.ts`
  - `src/commands/slash/workflow.ts`

## 4) Delivery Plan (Phased)

### Task 1: Extend config schema for research providers

**Files:**
- Modify: `src/core/config.ts`
- Test: `tests/core/config.test.ts`

**Step 1: Add failing config schema tests**
- Validate defaults for:
  - `research.enabled`
  - `research.defaultProvider`
  - `research.providers.<provider>.apiKey`
  - `research.providers.<provider>.enabled`
- Validate unknown provider keys are rejected.

**Step 2: Implement schema additions**
- Add new `research` object to `OptaConfigSchema`.
- Include provider-specific nested configs:
  - `tavily`, `gemini`, `exa`, `brave`, `groq`.

**Step 3: Re-run config tests**
- Run: `npm test -- tests/core/config.test.ts`

### Task 2: Add research section to interactive config menus

**Files:**
- Modify: `src/commands/config.ts`
- Modify: `src/commands/slash/manage.ts`
- Test: `tests/commands/config.test.ts`
- Test: `tests/commands/slash-manage.test.ts`

**Step 1: Add failing menu tests**
- Assert research keys appear in menu sectioning.
- Assert masked display for API keys (`(set)`/`(none)` in list output).

**Step 2: Implement menu/list updates**
- Add “Research” group and field summaries.
- Keep secure display semantics (never print full keys).

**Step 3: Verify behavior**
- Run: `npm test -- tests/commands/config.test.ts tests/commands/slash-manage.test.ts`

### Task 3: Build research provider abstraction and adapters

**Files:**
- Create: `src/research/types.ts`
- Create: `src/research/registry.ts`
- Create: `src/research/router.ts`
- Create: `src/research/providers/tavily.ts`
- Create: `src/research/providers/gemini.ts`
- Create: `src/research/providers/exa.ts`
- Create: `src/research/providers/brave.ts`
- Create: `src/research/providers/groq.ts`
- Test: `tests/research/router.test.ts`
- Test: `tests/research/providers.test.ts`

**Step 1: Add failing provider contract tests**
- Common interface expectations:
  - `search()`
  - `extract()` (optional)
  - `answer()` (optional)
  - standardized `ResearchResult`.

**Step 2: Implement adapters**
- Tavily adapter uses search endpoint and returns normalized citations.
- Exa adapter supports `search` and `answer`.
- Brave adapter wraps web search endpoint.
- Gemini adapter supports function/tool-driven grounded responses.
- Groq adapter supports OpenAI-compatible and/or remote MCP bridge mode.

**Step 3: Add router logic**
- Routing by intent:
  - `latest-news` -> Brave/Gemini
  - `deep-technical` -> Exa/Tavily advanced
  - `fast-general` -> Tavily/Brave
- Add fallback ladder when rate-limited or degraded.

**Step 4: Run tests**
- Run: `npm test -- tests/research/router.test.ts tests/research/providers.test.ts`

### Task 4: Expose normalized research tools to the model

**Files:**
- Modify: `src/core/tools/schemas.ts`
- Modify: `src/core/tools/executors.ts`
- Modify: `src/core/tools/permissions.ts`
- Test: `tests/core/tools.test.ts`
- Test: `tests/tools/permissions.test.ts`

**Step 1: Add failing schema tests**
- Expected tool names:
  - `research_query`
  - `research_health`
  - `research_set_provider` (optional)

**Step 2: Implement executors**
- `research_query` calls router with provider hints + intent.
- `research_health` reports configured providers and live status.
- Map tool permission defaults to `allow` in normal/research, `deny` in plan/review if desired.

**Step 3: Re-run tool tests**
- Run: `npm test -- tests/core/tools.test.ts tests/tools/permissions.test.ts`

### Task 5: Inject dynamic capability manifest into system prompt

**Files:**
- Modify: `src/core/agent-setup.ts`
- Modify: `src/mcp/registry.ts`
- Test: `tests/core/agent.test.ts`
- Test: `tests/mcp/registry.test.ts`

**Step 1: Add failing prompt assembly tests**
- Prompt includes short “Active capabilities” section with:
  - configured research providers
  - browser automation availability
  - learning ledger availability

**Step 2: Implement runtime manifest assembly**
- Derive from config + registry schemas + health results.
- Keep manifest concise (<250 tokens target).

**Step 3: Validate tool-use behavior stability**
- Ensure no regression in mode constraints and tool filtering.

**Step 4: Run tests**
- Run: `npm test -- tests/core/agent.test.ts tests/mcp/registry.test.ts`

### Task 6: Phase-1 browser automation via Playwright MCP bootstrap

**Files:**
- Create: `src/browser/mcp-bootstrap.ts`
- Modify: `src/commands/mcp.ts`
- Modify: `src/commands/slash/manage.ts`
- Test: `tests/commands/mcp.test.ts`

**Step 1: Add failing command tests**
- `opta mcp add-playwright` (or equivalent) installs config entry.
- Default secure flags included.

**Step 2: Implement bootstrap helper**
- Add first-party helper that writes MCP server config:
  - command: `npx`
  - args include `@playwright/mcp@latest`, `--isolated`, and safe host/origin controls.

**Step 3: Add status visibility**
- `/mcp` output indicates browser MCP health.

**Step 4: Run tests**
- Run: `npm test -- tests/commands/mcp.test.ts tests/commands/slash-manage.test.ts`

### Task 7: Phase-2 native browser session tools

**Files:**
- Create: `src/browser/types.ts`
- Create: `src/browser/native-session-manager.ts`
- Create: `src/browser/artifacts.ts`
- Modify: `src/core/tools/schemas.ts`
- Modify: `src/core/tools/executors.ts`
- Test: `tests/browser/native-session-manager.test.ts`
- Test: `tests/core/tools.test.ts`

**Step 1: Add failing browser tool tests**
- `browser_open`, `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_screenshot`, `browser_close`.

**Step 2: Implement Playwright-backed manager**
- Session map keyed by `sessionId`.
- Isolated context by default.
- Artifact output to `.opta/browser/<sessionId>/`.

**Step 3: Implement safe action limits**
- Max steps per turn.
- Domain allowlist support.
- Explicit confirmation for dangerous actions (e.g., credential entry).

**Step 4: Run tests**
- Run: `npm test -- tests/browser/native-session-manager.test.ts tests/core/tools.test.ts`

### Task 8: Add browser UX entry points

**Files:**
- Create: `src/commands/slash/browser.ts`
- Modify: `src/commands/slash/index.ts`
- Modify: `src/commands/slash/display.ts`
- Test: `tests/commands/slash-smoke.test.ts`

**Step 1: Add failing slash tests**
- `/browser open <url>`
- `/browser screenshot`
- `/browser close`

**Step 2: Implement command handlers**
- Keep slash handlers lightweight; delegate to tool calls.

**Step 3: Run tests**
- Run: `npm test -- tests/commands/slash-smoke.test.ts tests/commands/slash-display.test.ts`

### Task 9: Implement structured learning ledger

**Files:**
- Create: `src/learning/types.ts`
- Create: `src/learning/ledger.ts`
- Create: `src/learning/retrieval.ts`
- Test: `tests/learning/ledger.test.ts`

**Step 1: Add failing storage tests**
- Append/read/query by type (`plan`, `problem`, `solution`, `reflection`).
- Evidence integrity (command output refs, file refs, timestamps).

**Step 2: Implement storage**
- Store under `.opta/learning/ledger.jsonl`.
- Include schema version and stable IDs.

**Step 3: Run tests**
- Run: `npm test -- tests/learning/ledger.test.ts`

### Task 10: Hook learning capture into session + workflow events

**Files:**
- Create: `src/learning/hooks.ts`
- Modify: `src/commands/slash/research.ts`
- Modify: `src/commands/slash/workflow.ts`
- Modify: `src/core/agent.ts`
- Modify: `src/memory/store.ts`
- Test: `tests/commands/plan.test.ts`
- Test: `tests/core/agent.test.ts`
- Test: `tests/memory/store.test.ts`

**Step 1: Add failing behavior tests**
- Entering `/research` and `/plan` creates a plan/research event.
- Tool failures create problem events.
- Successful completion with verification creates solution events.

**Step 2: Implement hooks**
- Add lightweight capture calls at existing decision points.
- Ensure non-blocking writes (do not block response loop).

**Step 3: Run tests**
- Run: `npm test -- tests/commands/plan.test.ts tests/core/agent.test.ts tests/memory/store.test.ts`

### Task 11: Add autonomous reflection + markdown summaries

**Files:**
- Create: `src/learning/summarizer.ts`
- Modify: `src/core/tools/schemas.ts`
- Modify: `src/core/tools/executors.ts`
- Test: `tests/learning/summarizer.test.ts`

**Step 1: Add failing summary tests**
- Generate daily/project summary:
  - plans attempted
  - recurrent problems
  - validated solutions
  - prevention rules

**Step 2: Implement summarizer**
- Output files:
  - `.opta/learning/summaries/YYYY-MM-DD.md`
  - optional `docs/research/` or `docs/plans/` linked artifacts.

**Step 3: Run tests**
- Run: `npm test -- tests/learning/summarizer.test.ts`

### Task 12: Retrieval-aware prompt injection for learned constraints

**Files:**
- Modify: `src/core/agent-setup.ts`
- Modify: `src/learning/retrieval.ts`
- Test: `tests/core/agent.test.ts`

**Step 1: Add failing prompt tests**
- For new tasks, relevant prior lessons are included as short bullets.
- Ensure prompt stays under context budget.

**Step 2: Implement retrieval strategy**
- Query by lexical + tag match first.
- Optional embedding enhancement later (non-blocking future step).

**Step 3: Run tests**
- Run: `npm test -- tests/core/agent.test.ts`

### Task 13: Hardening, privacy, and guardrails

**Files:**
- Modify: `src/core/tools/permissions.ts`
- Modify: `src/core/config.ts`
- Create: `docs/GUARDRAILS-AI-CAPABILITIES.md`
- Test: `tests/tools/permissions.test.ts`

**Step 1: Add failing permission tests**
- Browser and research tools honor mode restrictions.
- Learning write tools denied in strict read-only modes when required.

**Step 2: Implement redaction and secure logging**
- Never persist raw API keys in logs.
- Redact secrets from learning ledger.

**Step 3: Run tests**
- Run: `npm test -- tests/tools/permissions.test.ts`

### Task 14: Benchmarks and acceptance checks

**Files:**
- Create: `tests/integration/research-routing.test.ts`
- Create: `tests/integration/browser-flow.test.ts`
- Create: `tests/integration/learning-loop.test.ts`
- Create: `opta-ai-capability-test-report.md`

**Step 1: Define acceptance scenarios**
- Research: key configured -> autonomous provider selection -> citations returned.
- Browser: open/login-like flow in sandbox -> screenshot artifacts produced.
- Learning: repeated error -> reflection -> prevention rule reused.

**Step 2: Run full verification**
- Run: `npm test`
- Run: `npm run typecheck`
- Run: `npm run lint`

## 5) Rollout Strategy

### Phase A (fastest value, low risk)
- Ship config + research connectors + prompt capability manifest.
- Ship Playwright MCP bootstrap (no native browser manager yet).
- Ship learning ledger v1 (append-only, no embeddings).

### Phase B (competitive differentiation)
- Native browser tools + artifact/trace controls.
- Reflection and retrieval-aware prompting.
- Provider-aware cost/latency routing policy.

### Phase C (advanced autonomy)
- Confidence scoring for research source quality.
- Auto-generated “execution playbooks” from prior successful sessions.
- Optional semantic memory indexing.

## 6) Risks and Mitigations

- **API drift / provider instability**
  - Mitigation: strict adapter layer + provider health checks + fallback routing.

- **Context bloat from capability manifests**
  - Mitigation: keep dynamic manifest compressed and data-driven (<250 tokens target).

- **Browser safety**
  - Mitigation: isolated profile default, host allowlist, explicit opt-in for attached mode.

- **Noisy self-learning**
  - Mitigation: evidence requirement (`verified: true` only after command/test success).

- **Cost escalation (paid search APIs)**
  - Mitigation: per-provider quotas + adaptive routing + budget mode in config.

## 7) Success Metrics

- Research success rate:
  - `% of research tasks resolved without manual provider switching`
- Browser reliability:
  - `% of scripted browser tasks completed with artifact output`
- Learning value:
  - `% reduction in repeated failure classes over 30 days`
- Latency/cost:
  - median provider latency and cost-per-research-task by connector

## 8) Source Links (Primary)

- Tavily docs and endpoint:
  - https://docs.tavily.com/documentation/get-started/quickstart
  - https://docs.tavily.com/documentation/api-reference/endpoint/search
- Gemini API key, function calling, grounding:
  - https://ai.google.dev/gemini-api/docs/api-key
  - https://ai.google.dev/gemini-api/docs/function-calling
  - https://ai.google.dev/gemini-api/docs/grounding
- Exa API and docs:
  - https://docs.exa.ai/reference/getting-started
  - https://exa.ai/docs/reference/search
  - https://exa.ai/docs/reference/answer
  - https://exa.ai/docs/reference/rate-limits
- Brave Search API:
  - https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
  - https://brave.com/search/api/
- Groq docs:
  - https://console.groq.com/docs/quickstart
  - https://console.groq.com/docs/tool-use
  - https://console.groq.com/docs/remote-mcp
- Playwright + Playwright MCP:
  - https://playwright.dev/docs/intro
  - https://playwright.dev/docs/screenshots
  - https://playwright.dev/docs/browser-contexts
  - https://playwright.dev/docs/api/class-browsertype
  - https://playwright.dev/docs/trace-viewer
  - https://github.com/microsoft/playwright-mcp
- Learning/agent patterns:
  - https://arxiv.org/abs/2210.03629
  - https://arxiv.org/abs/2303.11366
  - https://docs.langchain.com/oss/python/langgraph/memory

