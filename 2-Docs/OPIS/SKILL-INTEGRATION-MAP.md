# OPIS — Skill & Resource Integration Map

> How OPIS connects to every available AI enhancement resource.

**Purpose:** Ensure AIs using OPIS-generated docs don't just read rules — they leverage the full AI26/AIALL ecosystem.

---

## The Integration Philosophy

Most project documentation tells AI *what* to do. OPIS tells AI *what to do AND where to find help doing it*. Every OPIS-generated KNOWLEDGE.md is a **live map** to skills, MCPs, workflows, research, and tools that make AI development faster and higher quality.

**Principle:** No AI working on an Opta project should ever build something from scratch when a skill, MCP, or AIALL resource already solves it.

---

## Integration Points by OPIS Stage

### Stage 0: Automated Analysis (Modes 2-6)

| Action | Resource | Mode | Purpose |
|--------|----------|------|---------|
| Codebase scanning | File system + read tools | Brownfield, Companion, Migration | Extract architecture, features, patterns from existing code |
| Existing APP.md analysis | Other projects' APP.md | Companion, Ecosystem | Extract shared identity, detect overlap |
| Stack mapping | Language/framework knowledge | Migration | Map old→new stack equivalents |
| AIALL gap check | `~/Documents/AI26/AIALL/` | Ecosystem | Find research relevant to the gap being filled |
| Parent scaffold copy | Parent project OPIS docs | Fork | Inherit docs, identify divergence points |

### Stage 2: Analysis & Extraction

| Action | Resource | Path | Purpose |
|--------|----------|------|---------|
| Scan for research | AIALL folders | `~/Documents/AI26/AIALL/` | Find existing knowledge before creating new |
| Check ecosystem overlap | Existing APP.md files | `~/Synced/Opta/1-Apps/*/APP.md` | Detect feature overlap between apps |
| Map available MCPs | MCP inventory | `AIALL/MCPS/top-mcp-servers-opta-stack-2026-02.md` | Know what tools are available |
| Map available skills | Skill inventory | `~/.openclaw/skills/` | Know what OpenClaw skills exist |
| Check compliance | Global rules | `~/Synced/AI26/2-Bot-Ops/2A-Compliance/RULES-GLOBAL.md` | Auto-inject into GUARDRAILS.md |
| Check credentials | Master keys | `~/Synced/AI26/1-SOT/1C-Accounts/MASTER-KEYS.md` | Ensure no hardcoded keys |

### Stage 5: Enhancement Pipeline

| Action | Resource | Trigger | Expected Output |
|--------|----------|---------|-----------------|
| Enhance CLAUDE.md | CLAUDE.md Best Practices | Always | Improved coding rules using community patterns |
| Architecture exploration | Brainstorming skill | When >1 valid approach | 2-3 options evaluated, best selected |
| Execution planning | Planning with Files | Always | tasks/todo.md, lessons.md, code.md |
| Agent team planning | Agent Teams guide | Complex projects | Team compositions for parallel work |
| Security hardening | Security framework | Always | GUARDRAILS.md security section |
| Fix log setup | Fix logging system | Always | WORKFLOWS.md includes fix log instructions |

### Post-OPIS: Development Phase

| Action | Resource | Trigger | Expected Output |
|--------|----------|---------|-----------------|
| Overnight automation | Sleep-to-Ship pipeline | When phases are ready | Autonomous nightly implementation |
| Parallel implementation | Conductor workflow | Multi-feature sprints | Git worktree isolation |
| Code review | Agent Teams (review pattern) | PR/implementation complete | Quality gate before merge |
| Research tasks | Sub-agent spawning | When knowledge gaps found | Research docs in docs/research/ |
| Cost analytics | Claude Code analytics tools | Monthly | Usage and cost tracking |

---

## AIALL Category → OPIS File Mapping

Shows how each AIALL category feeds into specific OPIS files:

| AIALL Category | Path | Feeds Into | How |
|----------------|------|-----------|-----|
| **skills/** | `AIALL/skills/` | KNOWLEDGE.md | Lists relevant OpenClaw skills for this project |
| **MCPS/** | `AIALL/MCPS/` | KNOWLEDGE.md, WORKFLOWS.md | Maps available MCPs; adds install commands to workflows |
| **agents/** | `AIALL/agents/` | WORKFLOWS.md | Agent team patterns for implementation |
| **workflows/** | `AIALL/workflows/` | WORKFLOWS.md | Clauding, Sleep-to-Ship, Conductor patterns |
| **llm-configs/** | `AIALL/llm-configs/` | KNOWLEDGE.md | Model configs for local inference projects |
| **system-prompts/** | `AIALL/system-prompts/` | CLAUDE.md | Best practices for AI instructions |
| **plugins/** | `AIALL/plugins/` | KNOWLEDGE.md | Available plugins for development tools |
| **features/** | `AIALL/features/` | KNOWLEDGE.md | AI capabilities research |

---

## Resource Discovery Protocol

**Every AI working on an OPIS-initialized project should follow this before starting work:**

```
1. Read APP.md (identity)
2. Read CLAUDE.md (coding rules)
3. Read docs/GUARDRAILS.md (what NOT to do)
4. Read docs/KNOWLEDGE.md (available resources)
   ├── Check "Relevant Skills" → load any that apply to current task
   ├── Check "Relevant MCPs" → install any not yet set up
   ├── Check "Relevant Workflows" → follow established patterns
   └── Check "Prior Art" → don't rebuild what exists
5. Read docs/DECISIONS.md (don't re-open settled decisions)
6. Start working
```

**When discovering a new useful resource during work:**
1. Add to this project's KNOWLEDGE.md
2. Create `~/Documents/AI26/AIALL/inbox/YYYY-MM-DD-{topic}-from-{bot}.md` for cross-bot distribution
3. If it's a reusable pattern → consider adding to AIALL/workflows/ or AIALL/skills/

---

## Skill-Specific Integration Details

### 1. CLAUDE.md Best Practices (Opta512 Research)

**Status:** Research assigned to Opta512 (Item #3 in Feb 14 research plan)
**Expected output:** `AIALL/system-prompts/claude-md-agents-md-best-practices.md`

**Integration with OPIS:**
- Once available, OPIS Stage 5 reads this doc
- Compares drafted CLAUDE.md against curated patterns
- Adds framework-specific rules (SwiftUI, TypeScript, Python, Rust)
- Adds proven anti-patterns from open-source community

**Until researched:** OPIS generates CLAUDE.md from APP.md answers + existing conventions. Enhancement deferred to when research lands.

### 2. Brainstorming Skill (Claude Code)

**Location:** Built into Claude Code
**Trigger:** Architecture decisions with multiple valid approaches

**OPIS integration:**
```
IF Stage 5 ARCHITECTURE.md has >1 valid approach for a key decision:
    1. Present to Matthew as brainstorm: "2-3 approaches, pros/cons each"
    2. Matthew picks direction
    3. Record in DECISIONS.md: {decision, alternatives, reasoning}
    4. Update ARCHITECTURE.md with chosen approach
```

**Example brainstorm outputs for OPIS:**
- "Single FastAPI process vs parent/child model for Opta-LMX"
- "REST-only vs REST+WebSocket for OptaPlus gateway connection"
- "Monolith vs feature-sliced architecture for Opta CLI"

### 3. Planning with Files (Manus Pattern)

**Location:** `~/.openclaw/skills/planning-with-files/`
**Trigger:** Always, post-OPIS

**OPIS creates the bridge:**
```
OPIS Output:
  ROADMAP.md (phases with acceptance criteria)
    ↓
Planning with Files creates:
  tasks/todo.md (Phase 1 checklist from ROADMAP.md)
  tasks/lessons.md (empty, grows during dev)
  tasks/code.md (key patterns from ARCHITECTURE.md)
```

### 4. Conductor + Agent Teams

**Location:** `AIALL/workflows/conductor-claude-code-production-workflow.md`
**Trigger:** Multi-feature implementation phases

**OPIS creates the bridge:**
```
OPIS Output:
  WORKFLOWS.md → "Agent Team Patterns" section
    ↓
Conductor uses:
  Team compositions per ROADMAP.md phase
  File isolation rules from ARCHITECTURE.md
  Quality gates from GUARDRAILS.md
```

**Team composition templates added to WORKFLOWS.md:**
```markdown
### Phase 2: Core Implementation
Team: Feature Development
- Lead (Opus): Architecture + coordination
- Worker 1 (Sonnet): [Component A] implementation
- Worker 2 (Sonnet): [Component B] implementation
- Worker 3 (Sonnet): Test writing

### Phase 3: Integration
Team: Integration + Review
- Lead (Opus): Integration strategy + review
- Worker 1 (Sonnet): API integration
- Worker 2 (Sonnet): Regression testing
```

### 5. MCP Auto-Discovery

**Source:** `AIALL/MCPS/top-mcp-servers-opta-stack-2026-02.md`
**Trigger:** Stage 2, project type analysis

**OPIS logic:**
```
IF project.type == "any":
    Add: GitHub MCP, File System MCP, SQLite MCP
    
IF project.type == "web-app":
    Add: Puppeteer MCP, Brave Search MCP
    
IF project.type == "service" AND project.language == "python":
    Add: Claude Context MCP (semantic code search)
    
IF project has database:
    Add: SQLite MCP or PostgreSQL MCP
    
IF project.ecosystem.shares_with.length > 2:
    Add: Memory MCP (knowledge graph for cross-project context)
```

### 6. Security & Compliance Auto-Injection

**Source:** `~/Synced/AI26/2-Bot-Ops/2A-Compliance/RULES-GLOBAL.md`
**Trigger:** Stage 2, always applied

**OPIS auto-generates in GUARDRAILS.md:**
```markdown
## Global Compliance (Inherited — Do Not Modify)

These rules apply to ALL Opta projects (from RULES-GLOBAL.md):

- **C01:** No data exfiltration without approval
- **C02:** No destructive commands without "yes, delete"
- **C03:** No external posts/emails without approval
- **C04:** No modifying RULES-GLOBAL.md
- **C05:** No bypassing authentication
- **C06:** No executing untrusted code without review

## Credential Management
- NEVER hardcode API keys, tokens, or passwords
- Source of truth: ~/Synced/AI26/1-SOT/1C-Accounts/MASTER-KEYS.md
- Use environment variables or config files (gitignored)
```

### 7. Fix Logging Auto-Setup

**Source:** `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/`
**Trigger:** Always included in WORKFLOWS.md

**OPIS auto-generates:**
```markdown
## Fix Logging (Mandatory)

When a bug fix requires >1 attempt OR causes downtime:
1. Create `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/YYYY-MM-DD-{project}-{issue-slug}.md`
2. Use template: `~/Synced/AI26/2-Bot-Ops/2D-Fix-Logs/templates/FIX-TEMPLATE.md`
3. Update INDEX.md
4. Cross-reference in this project's docs/CHANGELOG.md
```

---

## Future Enhancements

### As AIALL Grows
Every new AIALL entry becomes available to OPIS-initialized projects. The KNOWLEDGE.md in each project should be periodically refreshed:
- **Nightly:** Bots scan AIALL for new entries relevant to their projects
- **On research completion:** New inbox docs trigger KNOWLEDGE.md updates
- **On skill installation:** New OpenClaw skills added to KNOWLEDGE.md

### OPIS v2.0 Ideas
1. **Auto-generate APPS-INDEX.md** on every OPIS run
2. **Conflict detection** — warn if new project overlaps with existing project scope
3. **Dependency graph visualization** — auto-generate from YAML frontmatter
4. **Health check cron** — quarterly automated audit of all OPIS docs vs reality
5. **Cross-project DECISIONS.md search** — find similar decisions across all projects

---

*This map ensures OPIS isn't just a documentation generator — it's an AI development accelerator that grows with the AI26/AIALL knowledge base.*
