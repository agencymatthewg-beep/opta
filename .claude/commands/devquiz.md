# /devquiz — Dev Investigation & Optimisation Quiz

Investigate any Opta feature/system in depth, verify it matches original intent, benchmark it against industry standards, and produce a scored optimisation report as a `/gu` visual guide.

## Purpose

This skill exists to:
1. Verify that features are being developed as Matthew intended
2. Identify gaps between intent and implementation
3. Benchmark against industry best practices and comparable systems
4. Produce an actionable optimisation score with specific next steps

## When Invoked

Run `/devquiz <topic>` to trigger a deep investigation of that feature/system.

---

## Investigation Protocol

### Step 1 — Locate & Read Source
- Find all source files related to the topic using Glob/Grep
- Read the implementation files (commands, runners, types, schemas)
- Read the corresponding test files
- Check for any design docs, DECISIONS.md, or planning docs in the area
- Read the relevant app CLAUDE.md for declared intent

### Step 2 — Map Intent vs Reality
- What was this feature designed to do? (from comments, naming, design docs, session context)
- What does it actually do today?
- List: what's correct ✓, what's missing ✗, what's misaligned ⚠

### Step 3 — Industry Research
- What are comparable systems doing? (cite real products/frameworks by name)
- What are the best-practice patterns for this category?
- What does the industry benchmark look like (e.g., test count, feature completeness, performance norms)?

### Step 4 — Score Across 6 Dimensions (each 0–10)

| Dimension | What it measures |
|-----------|-----------------|
| **Design Alignment** | Does implementation match declared intent and original design? |
| **Completeness** | Are all required features built? Edge cases handled? |
| **Code Quality** | Architecture, patterns, TypeScript safety, readability |
| **Test Coverage** | Test depth, unit vs integration, edge case coverage |
| **Industry Parity** | How does it compare to best-in-class equivalents? |
| **Scalability** | Can it grow? Is the structure correct for future expansion? |

**Overall Score** = weighted average (Industry Parity × 1.5, Completeness × 1.2, others × 1.0)

### Step 5 — Generate /gu Output

Produce the full investigation as a `/gu` branded HTML guide:
- Title: `DevQuiz: [Topic Name]`
- Write to project root as `gu-devquiz-[topic].html`
- Open in default browser

---

## Output Structure (in the HTML)

1. **What It Is** — concise explanation of the feature/system
2. **Intent vs Reality** — side-by-side: what was planned vs what exists
3. **Score Radar** — 6-dimension score display with visual bars
4. **Strengths** — what's genuinely well-built
5. **Gaps** — specific missing pieces with severity (critical / moderate / nice-to-have)
6. **Industry Comparison** — named comparables, gap analysis
7. **Optimisation Roadmap** — prioritised fixes to raise the score
8. **Overall Verdict** — summary sentence + overall score badge

---

## Example Usage

```
/devquiz opta-ceo-benchmark
/devquiz daemon-session-manager
/devquiz browser-automation-safety
/devquiz vault-sync-pipeline
```

The argument is the topic. If none provided, ask the user what to investigate.
