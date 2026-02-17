# Opta CLI — Competitive Scan Protocol

**Purpose:** Keep Opta CLI always pushing to be the most feature-rich, capable, and competitive AI coding CLI.

**Owner:** Opta Max (automated via cron)
**Frequency:** Weekly scan + monthly deep dive
**Output:** Updated COMPETITIVE-MATRIX.md + auto-generated task files

---

## 1. Weekly Scan (Cron Job)

**Schedule:** Every Sunday 22:00 AEST
**Type:** Isolated agentTurn
**Duration:** ~15-20 minutes

### Scan Checklist

1. **GitHub Release Check** — Fetch latest releases:
   - `gh release list -R anthropics/claude-code --limit 3`
   - `gh release list -R anomalyco/opencode --limit 3`
   - `gh release list -R MoonshotAI/kimi-cli --limit 3`
   - `gh release list -R Aider-AI/aider --limit 3`
   - `gh release list -R google/gemini-cli --limit 3`

2. **Changelog Diff** — Compare current version features against our matrix:
   - Fetch each repo's CHANGELOG.md (last 2 entries)
   - Extract new features/tools added
   - Check if any new feature isn't in our matrix → add it

3. **Web Search** — Search for:
   - "AI coding CLI new features 2026"
   - "Claude Code update" / "OpenCode update" / "Kimi Code update"
   - "AI coding agent comparison"
   - r/LocalLLaMA, r/ClaudeAI, HackerNews for new CLI launches

4. **Matrix Update** — For each new feature found:
   - Add row to COMPETITIVE-MATRIX.md
   - Assign priority (CRITICAL/HIGH/MEDIUM/LOW)
   - Calculate gap score
   - Flag if 3+ competitors have it (= industry standard, MUST implement)

5. **Report** — Deliver to Telegram:
   - New features discovered (if any)
   - Updated gap scores
   - Any competitor that leapfrogged us in a category

---

## 2. Monthly Deep Dive (1st of month)

**Schedule:** 1st of each month, 23:00 AEST
**Type:** Isolated agentTurn (spawns sub-agents)

### Deep Dive Process

1. **Full Feature Audit**
   - Re-read all competitor docs (not just changelogs)
   - Check for features we missed in weekly scans
   - Update all gap scores

2. **Benchmark Refresh**
   - Check SWE-bench, LiveCodeBench, Terminal-Bench for new results
   - Update bar charts in comparison HTML
   - Note any model improvements relevant to Opta CLI

3. **Auto-Generate Implementation Plans**
   - For each CRITICAL or HIGH gap with score ≥ 3:
     - Generate a Claude Code task file at `tasks/plans/auto-<feature-name>.md`
     - Follow the standard Clauding v2 format
     - Include: context files, instructions, constraints, test checklist
     - Reference competitor implementations for design inspiration
   - Sort tasks by: (gap_score × priority_weight) descending
     - CRITICAL = 3×, HIGH = 2×, MEDIUM = 1×, LOW = 0.5×

4. **Priority Reassessment**
   - If a feature moves from 1 competitor to 3+ → escalate to CRITICAL
   - If a feature is deprecated by all competitors → mark ❌
   - If we implement a feature → mark ✅, recalculate summary

5. **Roadmap Update**
   - Update docs/ROADMAP.md with new priorities
   - Update docs/FEATURE-PLAN.md
   - Ensure V2/V3 design docs reflect latest competitive landscape

---

## 3. Autonomous Implementation Rules

### Auto-Implement (No Matthew Approval Needed)
Features that are:
- Pure additions (no breaking changes)
- Under 200 lines of new code
- Have 3+ competitors implementing them
- Score ≥ 3 on gap matrix
- Have a clear spec from competitor docs

**Examples:**
- JSON output flag (`--format json`)
- Token usage display
- Auto-compact trigger
- Web fetch tool

### Plan-Only (Needs Matthew's Claude Code Session)
Features that are:
- Architectural changes (new module pattern)
- Over 200 lines
- Involve new dependencies
- Score ≥ 5 (CRITICAL)

**Examples:**
- Sub-agent system
- MCP protocol integration
- LSP integration
- Hook/lifecycle system

### Skip (Not Worth Implementing)
Features that:
- Only 1 competitor has
- Score ≤ 1
- Conflict with Opta CLI's philosophy (local-first, minimal deps)

---

## 4. Competitive Advantage Protection

### Features Where We Lead — PROTECT
| Feature | Our Advantage | Threat Level |
|---------|--------------|-------------|
| Model management (load/unload) | Only CLI with this | LOW — competitors are cloud-only |
| OPIS project docs | Richest project awareness | MEDIUM — others may copy CLAUDE.md pattern |
| Shell completions | Only CLI with this | LOW — easy for others to add |
| Zero-cost local inference | Hardware moat | MEDIUM — cloud prices dropping |
| Routing aliases | Only CLI with this | LOW — niche feature |

### Watch List — Competitors May Catch Up
- If Claude Code adds local model support → our biggest moat erodes
- If OpenCode adds OPIS-like project docs → our awareness lead shrinks
- If any CLI adds model management → differentiation lost

---

## 5. Scoring System

### Gap Score Calculation
```
gap_score = competitors_with_feature × quality_multiplier

competitors_with_feature:
  1 competitor = 1
  2 competitors = 2
  3+ competitors = 3 (industry standard)

quality_multiplier:
  Basic implementation = 1
  Best-in-class somewhere = 1.5
  Multiple best-in-class = 2
```

### Priority Weights
```
CRITICAL = gap_score ≥ 5 (industry standard + best-in-class)
HIGH = gap_score = 3 (multiple competitors, clear value)
MEDIUM = gap_score = 2 (some competitors, nice to have)
LOW = gap_score ≤ 1 (rare feature, low impact)
```

---

## 6. File Locations

| File | Purpose |
|------|---------|
| `docs/competitive/COMPETITIVE-MATRIX.md` | Master feature tracking (this is THE source of truth) |
| `docs/competitive/SCAN-PROTOCOL.md` | This file — how scans work |
| `docs/competitive/scans/YYYY-MM-DD-weekly.md` | Weekly scan reports |
| `docs/competitive/scans/YYYY-MM-DD-monthly.md` | Monthly deep dive reports |
| `tasks/plans/auto-*.md` | Auto-generated implementation plans |
| `docs/ROADMAP.md` | Updated roadmap reflecting competitive priorities |
