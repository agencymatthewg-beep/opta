# OPIS — Opta Project Initialization System

> Turn a vision into a fully-documented, AI-ready project in one interactive session.

**Version:** 2.0
**Created:** 2026-02-15
**Author:** Matthew Byrden + Opta Max

---

## What Is OPIS?

A structured, interactive process that converts a project idea — or retrofits an existing codebase — into a complete documentation scaffold optimized for AI-assisted development. The output isn't one file — it's a **development operating system** that any AI (Claude Code, OpenClaw bots, sub-agents, Conductor teams) reads before writing a single line of code.

---

## Why OPIS Exists

| Without OPIS | With OPIS |
|-------------|-----------|
| AI makes assumptions about purpose | AI reads authoritative identity doc |
| Decisions get re-litigated every session | Decision log prevents re-opening settled debates |
| Every AI agent reinvents the wheel | Workflows + knowledge map point to existing solutions |
| No one knows what other Opta apps do | Ecosystem map shows all relationships |
| Guardrails live in someone's head | Written non-negotiables prevent violations |
| New AI agents start blind | INDEX.md → read order → full context in 2 minutes |
| Skills/MCPs/AIALL resources go unused | KNOWLEDGE.md explicitly maps available resources |

---

## Entry Modes

Every OPIS session starts by identifying the mode. The mode determines what the AI does BEFORE asking questions.

### Mode Selection

```
"What are we working with?"

A) 🟢 Greenfield     — New app from scratch. No code, no plans.
B) 🟤 Brownfield     — Existing app that needs OPIS docs retrofitted.
C) 🔵 Companion      — New platform for an existing app (e.g., build iOS for existing macOS).
D) 🟠 Migration      — Rebuilding an existing app in a new tech stack.
E) 🟣 Ecosystem Add  — New app joining the Opta ecosystem to fill a gap.
F) ⚪ Fork/Variant   — Clone of an existing app with targeted changes.
```

**Auto-detection:** The AI can infer the mode from context:
- Project folder exists with code → **Brownfield**
- "Build iOS version of [existing macOS app]" → **Companion**
- "Rewrite X in Y" → **Migration**
- References to ecosystem gaps → **Ecosystem Addition**
- "Clone X but change Y" → **Fork**
- Nothing exists → **Greenfield**

---

## Output: The OPIS Scaffold

### Single-Platform Project
```
project/
├── APP.md                 ← Identity & Purpose (the soul)
├── CLAUDE.md              ← AI Coding Instructions (the rules)
├── ARCHITECTURE.md        ← System design & data flow
├── docs/
│   ├── INDEX.md           ← File map, read order, last-updated dates
│   ├── ROADMAP.md         ← Phased priorities with acceptance criteria
│   ├── DECISIONS.md       ← Resolved decisions with reasoning
│   ├── GUARDRAILS.md      ← Hard rules, non-negotiables, never-do list
│   ├── ECOSYSTEM.md       ← Opta app relationships + data contracts
│   ├── KNOWLEDGE.md       ← AI26/AIALL refs, research, prior art, skills map
│   ├── WORKFLOWS.md       ← Build, test, deploy, Clauding, sub-agent patterns
│   └── CHANGELOG.md       ← Initialized empty, grows with project
```

### Multi-Platform Project — Option D: Independent Platform Scaffolds

**Use when:** Desktop has >2x the features of mobile (typical for Opta apps).
**Evidence:** YJS Dashboard (51 pages, 301K lines, 89 services) vs YJS Mobile (11 views, 28K lines, 20 services) — **10:1 ratio**.

```
project/
├── APP.md                 ← SHARED: Brand, purpose, "why this exists"
├── SHARED.md              ← SHARED: Backend, data models, API contracts, design language
├── macos/
│   ├── PLATFORM.md        ← macOS feature manifest (extensive — the Command Center)
│   ├── CLAUDE.md          ← macOS-specific coding rules
│   ├── ARCHITECTURE.md    ← macOS-specific system design
│   └── docs/
│       ├── ROADMAP.md     ← macOS-specific development phases
│       ├── GUARDRAILS.md  ← Inherited compliance + macOS-specific rules
│       └── FEATURES.md    ← Full feature list with per-feature status
├── ios/
│   ├── PLATFORM.md        ← iOS feature manifest (focused — the Quick Draw)
│   ├── CLAUDE.md          ← iOS-specific coding rules
│   ├── ARCHITECTURE.md    ← iOS-specific system design
│   └── docs/
│       ├── ROADMAP.md     ← iOS-specific development phases
│       ├── GUARDRAILS.md  ← Inherited compliance + iOS-specific rules
│       └── FEATURES.md    ← Full feature list with per-feature status
├── docs/
│   ├── INDEX.md           ← Master index across ALL docs
│   ├── DECISIONS.md       ← Shared decisions (append-only)
│   ├── ECOSYSTEM.md       ← Shared ecosystem map
│   ├── KNOWLEDGE.md       ← Shared AI26/AIALL resources
│   ├── WORKFLOWS.md       ← Shared + per-platform build/test/deploy
│   └── CHANGELOG.md       ← Unified changelog (tagged [macOS] / [iOS])
```

### When to Use Which Structure

```
IF single platform              → Standard scaffold (11 files)
IF multi-platform, <2x diverge  → Standard + platforms/ profiles (13 files)
IF multi-platform, >2x diverge  → Option D independent scaffolds (18 files)
```

### Multi-Platform Philosophy

**macOS = "Command Center"**
- Full expansion: everything iOS has + dozens of desktop-exclusive features
- Information density: multi-panel, sidebars, inspectors — show more, scroll less
- Keyboard-first: every action has a shortcut
- Multi-window: ⌘N for independent side-by-side workflows
- Pro features: advanced settings, debug panels, bulk operations, terminal

**iOS = "Quick Draw"**
- Convenience-first: most common action in 1-2 taps
- Thumb zone: primary actions in bottom-third of screen
- Gesture-rich: swipe, pull, long-press
- Progressive disclosure: summary → detail → advanced
- Platform integrations: Siri, Widgets, Live Activities, Shortcuts

### Read Order for AI Agents

```
Working on macOS:
  1. APP.md → 2. SHARED.md → 3. macos/PLATFORM.md → 4. macos/CLAUDE.md → 5. docs/

Working on iOS:
  1. APP.md → 2. SHARED.md → 3. ios/PLATFORM.md → 4. ios/CLAUDE.md → 5. docs/

Working on shared code/backend:
  1. APP.md → 2. SHARED.md → 3. Both PLATFORM.md files → 4. docs/
```

### Feature Parity Matrix (in SHARED.md)

```markdown
| Feature | macOS | iOS | Notes |
|---------|-------|-----|-------|
| Core chat | ✅ Full | ✅ Full | Identical |
| Multi-window | ✅ ⌘N | ❌ N/A | Desktop power feature |
| Siri intents | ❌ N/A | ✅ Intents | iOS-exclusive |
| Bot switching | ✅ Sidebar | ✅ Swipe/tab | Same function, different UX |
```

---

## The Process: Stage 0 → Stage 5

### Stage 0: Automated Analysis (Modes 2-6 only)

**Greenfield (Mode 1) skips this stage entirely.**

For all other modes, the AI performs thorough analysis BEFORE asking a single question. The goal: extract everything the code/docs already tell us, then only ask about gaps.

#### Mode 2: Brownfield — Codebase Analysis

```
1. SCAN   — File structure, directories, naming patterns, organization
2. COUNT  — Files, lines of code, languages, frameworks detected
3. READ   — Key files: README, CLAUDE.md, package manifests, entry points, configs
4. MAP    — Architecture: major modules, how they communicate, external services
5. LIST   — All views/pages/routes, services/managers, models/types
6. DETECT — Design patterns, state management, networking, error handling
7. ASSESS — What works, what's broken, what's stubbed, build status, test coverage
8. DRAFT  — Generate preliminary OPIS scaffold from findings
9. GAPS   — Identify what the code doesn't tell us (vision, priorities, decisions)
```

**Output to Matthew:** "Here's what I found in your codebase: [summary]. Here's what I'm missing. Let me ask about the gaps."

#### Mode 3: Companion App — Existing App Analysis

```
1. RUN Mode 2 analysis on existing app
2. EXTRACT shared identity: purpose, audience, brand, design language
3. EXTRACT backend/API contracts, shared data models
4. BUILD draft Feature Parity Matrix from existing features
5. MAP what transfers vs what's platform-specific
6. DRAFT APP.md + SHARED.md from existing app
7. GAPS — What's unknown: which features go to new platform, UX philosophy
```

**Output:** "I've analyzed [existing app]. Here's the shared identity. Now I need to know how [new platform] should differ."

#### Mode 4: Migration — Old → New Stack Analysis

```
1. RUN Mode 2 analysis on old app
2. MAP old stack → new stack (React→SwiftUI, Redux→Combine, etc.)
3. IDENTIFY what stays, what changes, what gets dropped
4. FLAG technical risks (hard-to-migrate patterns)
5. DRAFT OPIS scaffold with migration annotations
```

**Output:** "Here's the current app. Here's what maps cleanly to [new stack] and what doesn't."

#### Mode 5: Ecosystem Addition — Gap Analysis

```
1. READ APP.md files from all related Opta projects
2. MAP ecosystem dependencies and gaps
3. IDENTIFY the gap this new app fills
4. EXTRACT integration points (APIs, data contracts, ports)
5. CHECK AIALL for relevant research
6. DRAFT APP.md with ecosystem context pre-filled
```

**Output:** "Based on the ecosystem, this app fills [gap]. It connects to [apps] via [contracts]."

#### Mode 6: Fork — Parent Analysis

```
1. COPY parent app's OPIS scaffold
2. IDENTIFY divergence points
3. DRAFT variant OPIS with inherited + divergent sections marked
```

**Output:** "I've inherited [parent]'s docs. What specifically diverges?"

---

### Stage 1: Questions (Mode-Specific)

#### Mode 1: Greenfield — Vision Capture (10 questions)

1. **What's the app called and what does it do in one sentence?**
2. **Why does this need to exist? What's broken/missing/frustrating without it?**
3. **Who uses it and how? Walk me through a typical session.**
4. **What existing tools does this replace or complement? What's wrong with them?**
5. **What are the 3-5 things it MUST do on day one?**
6. **What should this app NEVER do? What's out of scope?**
7. **What platform, language, and tech stack? Any hard constraints?**
7b. **[Multi-platform] How should each platform's experience differ?** *(Think YJS pattern: Dashboard=51 pages, Mobile=11 views. What's the equivalent split?)*
8. **How does this connect to other Opta apps?**
9. **What should the experience FEEL like?**
10. **What does "done" look like? When is v1.0 shipped?**

#### Mode 2: Brownfield — Gap-Filling (10 questions)

*Prefixed with Stage 0 analysis summary.*

1. **Is my analysis accurate?** Anything I got wrong or missed?
2. **What's the vision beyond what's built?** Where is this heading that the code doesn't show?
3. **What are the non-negotiables?** Which existing features are core vs experimental?
4. **What's broken or incomplete?** What needs fixing/rebuilding?
5. **What's the priority order?** If I create a roadmap from what exists, what comes first?
6. **What should this app NEVER become?** Anti-scope not obvious from code.
7. **Are there undocumented decisions?** Choices you made that aren't in comments or docs.
8. **How does this connect to the ecosystem?** Relationships the code doesn't show.
9. **What should the experience FEEL like?** Design intent beyond what the UI shows.
10. **What does "done" look like?** When is this app finished enough?

#### Mode 3: Companion — Platform-Focused (10 questions)

*Prefixed with existing app analysis + shared identity extraction.*

1. **Is my extraction of the shared identity accurate?** Anything wrong?
2. **What features go to [new platform]?** Walk me through the parity matrix.
3. **What's [new platform]-exclusive?** Features only on this platform.
4. **What gets simplified?** Features on both but reduced on [new platform].
5. **What's the navigation model?** How does the user move through the app?
6. **What platform integrations matter?** (Siri/Widgets for iOS, Menu bar/Spotlight for macOS)
7. **What's the UX philosophy?** Command Center vs Quick Draw positioning.
8. **Same backend or different?** Does it connect to the same services?
9. **Development priority?** Feature parity or start with MVP?
10. **What should [new platform] NEVER have?** Features that don't belong here.

#### Mode 4: Migration — Transition-Focused (10 questions)

*Prefixed with old→new stack mapping.*

1. **Is the migration scope right?** Full rewrite or partial?
2. **What gets dropped?** Features you DON'T want in the new version.
3. **What gets added?** New features enabled by the new stack.
4. **What's the migration order?** Which modules first?
5. **Data migration?** How do existing data/configs transfer?
6. **Parallel operation?** Will old and new run simultaneously?
7. **Breaking changes?** Will existing integrations change?
8. **Quality bar change?** Same polish or upgrading?
9. **Timeline pressure?** Is the old stack dying or is this optional?
10. **What was wrong with the old approach?** What drove this decision?

#### Mode 5: Ecosystem Addition — Gap-Focused (10 questions)

*Prefixed with ecosystem gap analysis.*

1. **Is my gap analysis right?** Is this the problem you're solving?
2. **Who are the primary consumers?** Which apps/bots/users use this most?
3. **What's the API contract?** How should consumers talk to this?
4. **What's the migration path?** How do existing tools transition?
5. **What are the 3-5 non-negotiable capabilities?**
6. **What should this NEVER do?** Scope boundaries vs existing apps.
7. **Platform and tech stack?** Constraints from ecosystem?
8. **What does autonomous operation look like?** Can bots use this without humans?
9. **What's the deployment model?** Where, how, when?
10. **What does success look like?** When can we retire the old tool?

#### Mode 6: Fork — Divergence-Focused (5 questions)

*Prefixed with parent scaffold copy.*

1. **What's different about this variant?** The core divergence.
2. **Different audience?** Same users or new target?
3. **Different features?** Added, removed, modified?
4. **Shared codebase or independent?** Fork and diverge or stay linked?
5. **When does this become its own product?** Or stay a variant?

---

### Stage 2: Analysis & Extraction

After Matthew's answers (or after Stage 0 for non-greenfield modes), the AI:

1. **Drafts all scaffold files** from answers + Stage 0 analysis
2. **Identifies gaps** — areas that are vague, contradictory, or missing
3. **Identifies implicit decisions** — choices embedded in answers that should be explicit
4. **Cross-references ecosystem** — reads existing APP.md files, checks for overlap
5. **Maps to AI26/AIALL** — finds relevant skills, MCPs, research, workflows
6. **Flags contradictions** — things that don't align
7. **Prepares Stage 3 questions** — targeted, specific, based on gap analysis

---

### Stage 3: Refinement (10+ Targeted Questions)

Questions generated from gap analysis. Organized by category:

**A: Clarification** — Ambiguous answers need precision
**B: Architecture** — Implied but unstated structural decisions
**C: Edge Cases** — Unconsidered scenarios
**D: Ecosystem** — Cross-project implications
**E: Priority** — When everything seems equally important
**F: Knowledge** — Connecting to existing AI26/AIALL resources

**Rules:**
- Minimum 10 questions, maximum 20
- Group by category
- Count scales with ambiguity (clear vision = fewer questions)

---

### Stage 4: Update & Iterate

1. Integrate new answers into draft scaffold
2. Identify remaining gaps or new contradictions
3. If gaps remain → ask 5-10 more questions
4. If no gaps → proceed to Stage 5

**Convergence signal:** AI can fully populate all files without guessing.

**Typical:** 2-3 rounds total. Complex projects: 4-5 rounds.

---

### Stage 5: Review, Enhance & Lock

1. **Present complete scaffold** — each file with key sections highlighted
2. **Run enhancement pipeline** (see Skill Integration section)
3. **Matthew reviews** — approves, requests changes, or flags new questions
4. **Write files to project directory** — all files created atomically
5. **Update APPS-INDEX.md** — monorepo-level index
6. **Announce to bot fleet** — inbox doc for cross-bot awareness

---

## APP.md Format

```yaml
---
app: project-name
type: service|cli|macos-app|ios-app|web-app|library
platforms: [macos, ios]  # or single: platform: macos
language: python|swift|typescript|rust
status: concept|planning|development|beta|production
version: 1
depends_on: [dep1, dep2]
depended_on_by: [app1, app2]
port: 1234
opis_version: 2.0
opis_mode: greenfield|brownfield|companion|migration|ecosystem|fork
---

<!-- AI-SUMMARY (50 words max)
Project-name: Description for small-context models. -->

# [App Name] — APP.md

> [One-line tagline]

## 1. Identity (table)
## 2. Purpose (what / problem / different / NOT)
## 3. Target Audience (who / scenarios / experience)
## 4. Non-Negotiable Capabilities (numbered table)
## 5. Key Characteristics (philosophy / performance / quality)
## 6. Architecture Overview (components / flow / deps)
## 7. Ecosystem Context (depends on / depended by / shares)
## 8. Development Rules (coding / AI / testing / deployment)
## 9. Current Phase (1 line + "see ROADMAP.md")
## 10. Open Questions
```

**Read Protocol:**
```
IF context > 32K:  Full APP.md → CLAUDE.md → docs/
IF context 8-32K:  Frontmatter + AI-SUMMARY + CLAUDE.md → specific sections on-demand
IF context < 8K:   AI-SUMMARY only → request sections when needed
```

---

## Skill Integration Pipeline

| Stage | Skill/Resource | How Used |
|-------|---------------|----------|
| **Stage 0** | Codebase scanning | Automated analysis for brownfield/companion/migration |
| **Stage 2** | AIALL cross-reference | Scan for relevant research, configs, guides |
| **Stage 2** | Ecosystem scan | Read existing APP.md files, detect overlap |
| **Stage 2** | Security/Compliance | Auto-inject C01-C06 into GUARDRAILS.md |
| **Stage 2** | MCP discovery | Recommend MCPs based on project type |
| **Stage 5** | CLAUDE.md Best Practices | Enhance with community patterns |
| **Stage 5** | Brainstorming skill | Explore architecture alternatives |
| **Stage 5** | Planning with Files | Create tasks/todo.md from ROADMAP.md |
| **Post** | Conductor/Agent Teams | Team compositions for implementation |
| **Post** | Sleep-to-Ship pipeline | Overnight autonomous work |
| **Post** | Code Review team | Review against GUARDRAILS.md |
| **Post** | Fix Logging | Auto-setup in WORKFLOWS.md |

**Full integration details:** See `SKILL-INTEGRATION-MAP.md`

---

## APPS-INDEX.md (Monorepo Root)

Auto-generated from YAML frontmatter across all APP.md files:

```markdown
# Opta Ecosystem — Apps Index

| App | Type | Platform | Language | Status | OPIS | Depends On |
|-----|------|----------|----------|--------|------|------------|
| opta-lmx | service | macOS | Python | planning | ✅ | mlx, fastapi |
| optaplus | native | macOS+iOS | Swift | dev | ⬜ | openclaw |
```

**Generator:** `~/Synced/Opta/scripts/generate-apps-index.sh`

---

## Health Check (Quarterly / Per-Phase)

1. Is APP.md Section 2 (Purpose) still accurate?
2. Have any non-negotiables changed?
3. Biggest gap between docs and reality?
4. New ecosystem dependencies?
5. Undocumented decisions?
6. KNOWLEDGE.md up to date with AIALL?
7. New skills/MCPs to reference?
8. Do WORKFLOWS.md patterns match reality?

---

## OPIS as an OpenClaw Skill

```
~/.openclaw/skills/opis/
├── SKILL.md              ← Instructions (references this doc)
├── templates/            ← All templates (15 files)
├── scripts/
│   └── generate-apps-index.sh
└── questionnaire.md      ← Mode-specific questions
```

**Triggers:** "Initialize a new project", "Run OPIS", "Set up project docs", "Retrofit OPIS"

---

*This document is the authoritative specification for OPIS v2.0. All implementations derive from this.*
