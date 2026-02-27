# Opta Local — Development Workflows

> How to build, test, deploy, and delegate work on this project.

Current focus: Web delivery and stabilization. iOS work is temporarily deferred.

---

## Build

### Web

```bash
cd ~/Synced/Opta
pnpm install --frozen-lockfile
pnpm --filter @opta/local-web dev
pnpm --filter @opta/local-web build
pnpm --filter @opta/local-web lint
pnpm --filter @opta/local-web typecheck
pnpm --filter @opta/local-web check
```

### iOS

```bash
cd 1-Apps/optalocal/1L-Opta-Local/ios
open OptaLocal.xcodeproj        # Open in Xcode
# Build: Cmd+B
# Run: Cmd+R (requires iOS 17+ simulator or device)
```

## Test

### Web

```bash
pnpm --filter @opta/local-web lint
pnpm --filter @opta/local-web typecheck
pnpm --filter @opta/local-web test:unit
pnpm --filter @opta/local-web test:integration
pnpm --filter @opta/local-web build
# Optional local smoke E2E:
pnpm --filter @opta/local-web test:e2e:install
pnpm --filter @opta/local-web test:e2e:smoke
```

CI runs `lint + typecheck + test:unit + test:integration + build` for `1-Apps/optalocal/1L-Opta-Local/web/**` changes.
Playwright smoke E2E is available and runs manually via GitHub Actions `workflow_dispatch` (`run_e2e=true`) to keep PR/push CI fast and deterministic.

Security header smoke check (after header/CSP updates):

```bash
cd ~/Synced/Opta
pnpm --filter @opta/local-web dev
curl -I http://localhost:3004 | rg -i "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy"
```

### iOS

```bash
# In Xcode: Cmd+U to run all tests
# Or: xcodebuild test -scheme OptaLocal -destination 'platform=iOS Simulator,name=iPhone 16'
```

**What must pass before merge:**
- `pnpm --filter @opta/local-web typecheck` (Web)
- `pnpm --filter @opta/local-web lint` (Web)
- `pnpm --filter @opta/local-web test:unit` (Web)
- `pnpm --filter @opta/local-web test:integration` (Web)
- `pnpm --filter @opta/local-web build` (Web)
- `swift build` (iOS, only when iOS track resumes)
- No guardrail violations

## Deploy

### Web
- **Platform:** Vercel
- **Branch:** `main` (auto-deploy)
- **Preview:** PR branches get preview URLs
- **Environment:** No server-side env vars needed (static export)

### iOS
- **Beta:** TestFlight (manual upload from Xcode)
- **Release:** App Store (future)
- **Signing:** Automatic signing with personal team

---

## Clauding Workflow (This Project)

**Reference:** `~/Synced/AI26/2-Bot-Ops/2H-Workflows/CLAUDING.md`

### When to Use Clauding
- Complex features (3+ files, architectural changes)
- New platform feature implementation
- Cross-platform consistency work

### Context Files for Claude Code

**Web work:**
1. `APP.md` — Project identity
2. `SHARED.md` — API contracts and design language
3. `web/CLAUDE.md` — Web coding rules
4. `web/ARCHITECTURE.md` — Web system design
5. `web/docs/GUARDRAILS.md` — Web hard rules
6. The specific task

**iOS work:**
1. `APP.md` — Project identity
2. `SHARED.md` — API contracts and design language
3. `ios/CLAUDE.md` — iOS coding rules
4. `ios/ARCHITECTURE.md` — iOS system design
5. `ios/docs/GUARDRAILS.md` — iOS hard rules
6. The specific task

### Prompt Template

```xml
<context>
Read these files first:
- APP.md (project identity)
- SHARED.md (API contracts, design language)
- [platform]/CLAUDE.md (coding rules)
- [platform]/ARCHITECTURE.md (system design)
- [platform]/docs/GUARDRAILS.md (hard limits)
</context>

<task>
[Specific task description]
</task>

<constraints>
- Follow patterns in [platform]/CLAUDE.md
- Use /frontend-design skill for ALL UI work
- Don't violate any GUARDRAILS
- Record any decisions in docs/DECISIONS.md
</constraints>

<output>
- Implement the changes
- Update docs/CHANGELOG.md
- Run tests: [platform test commands]
</output>
```

---

## Sub-Agent Delegation

### Research Tasks
- **Model:** Sonnet (cost-effective)
- **Output:** `docs/research/` folder
- **Pattern:** Specific research brief with boundaries

### Implementation Tasks
- **Model:** Opus or Claude Code
- **Pattern:** Clauding workflow with context files
- **Rule:** ALWAYS invoke `/frontend-design` for UI components

### Review Tasks
- **Model:** Opus (quality gate)
- **Input:** Diff + GUARDRAILS + CLAUDE.md
- **Output:** Approve/request changes with reasoning

---

## Agent Team Patterns

### Web Implementation Team
```
Lead (Opus) — Architecture + coordination
├── Worker 1 (Sonnet) — Dashboard components
├── Worker 2 (Sonnet) — Chat engine + streaming
└── Worker 3 (Sonnet) — Connection manager + settings
```

### iOS Implementation Team
```
Lead (Opus) — Architecture + coordination
├── Worker 1 (Sonnet) — Bonjour discovery + connection
├── Worker 2 (Sonnet) — Chat UI + streaming
└── Worker 3 (Sonnet) — Dashboard views
```

---

## Overnight Automation

### Tasks Safe for Overnight
- Unit test implementation
- Component styling refinement
- Type definition updates
- Documentation updates
- Linting and formatting fixes

### Tasks Requiring Matthew
- Architecture decisions
- New API endpoint design
- Security-related changes
- App Store submission
- Cloudflare Tunnel configuration

### Quality Gates
- All tests pass
- No TypeScript errors
- No lint warnings
- No guardrail violations
- Bundle size within budget

---

## Fix Logging (Mandatory)

When a bug fix requires >1 attempt OR causes downtime:
1. Create `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/YYYY-MM-DD-opta-local-[issue-slug].md`
2. Use template: `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/templates/FIX-TEMPLATE.md`
3. Update `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/INDEX.md`
4. Cross-reference in `docs/CHANGELOG.md`

---

*Updated — 2026-02-20*
