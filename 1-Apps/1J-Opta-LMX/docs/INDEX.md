---
title: INDEX.md — Read Order for AI Agents
created: 2026-02-15
updated: 2026-02-15
type: navigation
audience: All AI agents (researchers, coders, debuggers)
status: Active
---

# INDEX.md — Read Order for Opta-LMX

**When you first encounter this project, read files in this order.** It maximizes context efficiency and prevents redundant research.

---

## 🟥 CRITICAL (Required First)

### 1. `APP.md` — Project Identity & Purpose
**Status:** ✓ Complete
**Read time:** 10 min
**What you get:**
- What Opta-LMX IS and what it is NOT
- The 12 non-negotiable capabilities
- Target audience (bots, Opta CLI, Matthew)
- Key characteristics and performance requirements
- Ecosystem context (what it depends on, what depends on it)

**Key sections to internalize:**
- §1 Identity (table)
- §4 Core Capabilities (§4 lists all 12)
- §6 Architecture Overview (data flow diagram)
- §8 Development Rules (if you're coding)

**Next steps:** If you're debugging → go to phase-specific docs. If you're researching → go to §2 below. If you're coding → read CLAUDE.md next.

---

## 🟧 FOUNDATIONS (Read Second)

### 2. `CLAUDE.md` — Coding Rules (CODING AGENTS ONLY)
**Status:** ✓ Complete
**Read time:** 15 min
**What you get:**
- How Claude Code should write Python for this project
- Project structure and dependencies
- Code patterns (async, Pydantic, error handling)
- Testing strategy and commands
- Build/run commands

**When to read:** Before any coding work. Before code review. When debugging unfamiliar code.

**Skip if:** You're pure research or pure infrastructure.

---

### 3. `docs/plans/MASTER-PLAN.md` — Development Roadmap
**Status:** ✓ Complete (Phase 0 underway)
**Read time:** 15 min
**What you get:**
- What phase we're in (currently Phase 0: Research)
- What each phase delivers
- Sub-agent assignments for research
- Success criteria for each milestone
- Development philosophy ("research before code")

**Key sections:**
- §0 Research Phase (current — don't skip this)
- §1-5 Future phases (design, implementation, features, integration)
- Success Criteria (what v0.1, v0.5, v1.0 look like)

**Skip if:** You only need the current task (then just read your specific research task).

---

## 🟨 PROJECT CONTEXT (Read Based on Role)

### For Researchers (0A-0E Tasks)
Read in this order:
1. `APP.md` → understand scope
2. `MASTER-PLAN.md` → understand your research task
3. Task-specific output file (see table below)
4. Existing research docs (to avoid duplication)

| Research Task | Phase | Output File | Input Docs |
|---------------|-------|-------------|-----------|
| **0A: Existing MLX servers** | 0 | `docs/research/existing-mlx-servers.md` | None yet |
| **0B: MLX capabilities** | 0 | `docs/research/mlx-capabilities.md` | None yet |
| **0C: OpenAI API spec** | 0 | `docs/research/openai-api-spec.md` | None yet |
| **0D: Competitor analysis** | 0 | `docs/research/competitor-analysis.md` | None yet |
| **0E: Apple Silicon optimization** | 0 | `docs/research/apple-silicon-optimization.md` | None yet |

### For Architects (Phase 1 Tasks)
Read in this order:
1. `APP.md` (§4 capabilities, §6 architecture)
2. `MASTER-PLAN.md` (§1 Design & Architecture)
3. All Phase 0 research outputs (to ground decisions)
4. `docs/DECISIONS.md` (existing architectural choices)
5. `docs/GUARDRAILS.md` (non-negotiable constraints)

Then create:
- `docs/plans/ARCHITECTURE.md`
- `docs/plans/TECH-DECISIONS.md`
- `docs/plans/API-SPEC.md` (OpenAPI)

### For Coders (Phase 2+ Tasks)
Read in this order:
1. `APP.md` (§8 development rules)
2. `CLAUDE.md` (§1-5 coding patterns)
3. `MASTER-PLAN.md` (§2 implementation phase)
4. `docs/plans/ARCHITECTURE.md` (when available)
5. `docs/plans/API-SPEC.md` (when available)
6. `docs/GUARDRAILS.md` (safety rules before committing)

Before coding each module:
- Check `docs/DECISIONS.md` for why we chose certain technologies
- Check `docs/KNOWLEDGE.md` for reference documentation
- Check `docs/WORKFLOWS.md` for testing/deployment procedures

### For Integrators (Phase 5)
Read in this order:
1. `APP.md` (§7 ecosystem context)
2. `docs/ECOSYSTEM.md` (data flow, who depends on LMX)
3. `docs/OPTA-CLI-MIGRATION.md` (how CLI connects)
4. `docs/plans/MASTER-PLAN.md` (§5 integration phase)
5. `CLAUDE.md` (if integrating with code)

---

## 📚 DEEP REFERENCE (Read as Needed)

### Strategy & Philosophy
- `docs/DECISIONS.md` — Why we chose MLX over llama.cpp, FastAPI over Flask, etc.
- `docs/GUARDRAILS.md` — Non-negotiable safety rules (C01-C06 + LMX-specific)
- `docs/ECOSYSTEM.md` — How LMX fits into the larger Opta ecosystem

### Knowledge Base
- `docs/KNOWLEDGE.md` — Curated list of external resources (MLX docs, FastAPI docs, OpenAI spec, etc.)
- `docs/WORKFLOWS.md` — How to add new models, test, benchmark, deploy

### Research Artifacts
- `docs/research/existing-mlx-servers.md` — Competitive landscape of MLX servers
- `docs/research/mlx-capabilities.md` — What MLX can and cannot do
- `docs/research/openai-api-spec.md` — Full OpenAI API specification
- `docs/research/competitor-analysis.md` — LM Studio, Ollama, llama.cpp, Jan.ai analysis
- `docs/research/apple-silicon-optimization.md` — M3 Ultra optimization techniques

### Project Context
- `docs/PROJECT-DEFINITION.md` — Original project scope and constraints
- `docs/OPTA-CLI-MIGRATION.md` — How Opta CLI will integrate with LMX
- `docs/context/CONVERSATION-CONTEXT.md` — Previous conversations and decisions

---

## 🎯 Quick Reference by Task Type

| Your Task | Start Here | Then Read |
|-----------|-----------|-----------|
| **Understand the project** | `APP.md` | `MASTER-PLAN.md` |
| **Research MLX servers** | `MASTER-PLAN.md` (§0A) | External MLX docs, GitHub |
| **Design architecture** | `MASTER-PLAN.md` (§1) + `APP.md` (§4,6) | Phase 0 research outputs |
| **Write Python code** | `CLAUDE.md` (§1-7) | Project structure in CLAUDE.md |
| **Review a pull request** | `CLAUDE.md` (§2-6) | `GUARDRAILS.md`, `DECISIONS.md` |
| **Debug a bug** | `APP.md` (§8 rules) | Test checklist in `CLAUDE.md` |
| **Deploy to Mac Studio** | `CLAUDE.md` (§5) | `docs/WORKFLOWS.md` |
| **Integrate with Opta CLI** | `docs/OPTA-CLI-MIGRATION.md` | `docs/ECOSYSTEM.md`, API spec |
| **Add a new model** | `docs/WORKFLOWS.md` | `docs/research/mlx-capabilities.md` |

---

## 📊 Document Status

| File | Status | Last Updated | Completeness |
|------|--------|--------------|--------------|
| `APP.md` | ✓ Complete | 2026-02-15 | 100% |
| `CLAUDE.md` | ✓ Complete | 2026-02-15 | 100% |
| `MASTER-PLAN.md` | ✓ Complete | 2026-02-15 | 100% |
| `DECISIONS.md` | ✓ Complete | 2026-02-15 | 100% |
| `GUARDRAILS.md` | ✓ Complete | 2026-02-15 | 100% |
| `ECOSYSTEM.md` | ✓ Complete | 2026-02-15 | 100% |
| `KNOWLEDGE.md` | ✓ Complete | 2026-02-15 | 100% |
| `WORKFLOWS.md` | ✓ Complete | 2026-02-15 | 100% |
| `docs/plans/ARCHITECTURE.md` | ⏳ Pending | — | Phase 1 |
| `docs/plans/API-SPEC.md` | ⏳ Pending | — | Phase 1 |
| `docs/plans/TECH-DECISIONS.md` | ⏳ Pending | — | Phase 1 |
| Phase 0 research outputs (0A-0E) | 🔄 In Progress | — | Variable |

---

## 🔄 Navigation Tips

**From any file:**
- Look for references like `[APP.md §4]` → go to that section
- See `docs/research/existing-mlx-servers.md` → read that research output
- See `CLAUDE.md §5` → jump to section 5 of coding rules

**To file sections:**
- Each .md has §N (section numbers) for easy cross-referencing
- Frontmatter shows: title, created, updated, type, audience, status
- Table of contents at top (for long files)

---

## 🛠️ For Maintenance

**When you add a new document:**
1. Add YAML frontmatter (title, created, type, status)
2. Update this INDEX.md with:
   - New section in the appropriate category
   - Entry in the Document Status table
   - Link in Quick Reference (if relevant)
3. Cross-reference from related documents (e.g., if you create ARCHITECTURE.md, link it from MASTER-PLAN.md §1A)

**When you update a document:**
- Update the frontmatter `updated:` field
- Update INDEX.md status if it changes (e.g., "In Progress" → "Complete")

---

*Last built: 2026-02-15*
*This index is your navigation guide. Keep it current.*
