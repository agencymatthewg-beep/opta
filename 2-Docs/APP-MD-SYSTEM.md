# The APP.md System

**Created:** 2026-02-15
**Author:** Matthew Byrden
**Purpose:** Standardized project identity document for AI-assisted development.

---

## What Is APP.md?

A single canonical file at the root of every Opta project that gives any AI (Claude Code, Opta Max, sub-agents, future collaborators) everything it needs to understand, build, and extend the app correctly.

**Every AI session starts by reading `APP.md`.** Period.

---

## Why It Matters

Without APP.md, AI agents:
- Make assumptions about the app's purpose
- Build features that don't align with the vision
- Duplicate work or contradict earlier decisions
- Don't understand the target user or their problems
- Can't distinguish "must-have" from "nice-to-have"
- Build generic solutions instead of ones tailored to the app's identity

With APP.md, AI agents:
- Understand the WHY before touching code
- Make intuitive feature decisions that align with the vision
- Know what makes this app DIFFERENT from alternatives
- Can proactively suggest features that enhance the core purpose
- Maintain consistency across sessions, agents, and time

---

## APP.md Template

```markdown
# [App Name] — APP.md

> [One-line tagline that captures the essence]

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | |
| **Tagline** | |
| **Type** | (CLI / macOS app / iOS app / web app / service / library) |
| **Platform** | (macOS 14+ / iOS 17+ / Web / Cross-platform / etc.) |
| **Language** | (Swift / TypeScript / Python / Rust / etc.) |
| **Location** | (path in monorepo) |
| **Status** | (Concept / Planning / In Development / Beta / Production) |

---

## 2. Purpose

### What It Does
(2-3 sentences. What does this app DO for the user?)

### What Problem It Solves
(What pain point, gap, or opportunity does this address?)

### What Makes It Different
(Why build this instead of using existing tools? What's the unique angle?)

### What It Does NOT Do
(Explicit boundaries. What's out of scope? What's another app's job?)

---

## 3. Target Audience

### Primary User
(Who is the main user? Be specific.)

### Use Cases
(3-5 concrete scenarios where someone uses this app)

### User Expectations
(What does the user expect the experience to be like?)

---

## 4. Core Capabilities (Non-Negotiable)

(Numbered list of capabilities that MUST exist. The app is incomplete without these.)

| # | Capability | Why Non-Negotiable |
|---|-----------|-------------------|
| 1 | | |
| 2 | | |
| ... | | |

---

## 5. Key Characteristics

### Design Philosophy
(What principles guide the UX/UI? Minimalist? Feature-rich? Power-user? Friendly?)

### Performance Requirements
(Speed targets, memory limits, startup time, response time)

### Quality Bar
(What level of polish is expected? MVP? Production? Premium?)

---

## 6. Architecture Overview

(High-level description of how the app is structured. Not detailed — just enough for an AI to understand the shape.)

### Key Components
(List the major modules/layers and what each does)

### Data Flow
(How does data move through the app? Input → Processing → Output)

### Dependencies
(What does this app depend on? APIs, services, other Opta apps)

---

## 7. Ecosystem Context

(How does this app relate to other Opta apps and infrastructure?)

### Depends On
(What other apps/services does this need?)

### Depended On By
(What other apps/services use this?)

### Shares With
(Shared libraries, design systems, APIs)

---

## 8. Development Rules

### Coding Conventions
(Language-specific rules, formatting, naming, etc.)

### AI Development Guidelines
(Special instructions for AI agents working on this project)

### Testing Requirements
(What must be tested? What level of coverage?)

### Deployment
(How is this app built, deployed, and updated?)

---

## 9. Roadmap Priorities

### Now (Current Sprint)
(What's being worked on RIGHT NOW?)

### Next (Planned)
(What's coming after current work?)

### Later (Backlog)
(Ideas that are validated but not scheduled)

### Never (Anti-Features)
(Things we've explicitly decided NOT to build)

---

## 10. Open Questions

(Unresolved decisions, things that need Matthew's input, unknowns)

---

*Last updated: YYYY-MM-DD*
*This file is the source of truth for what this app is. Update it as the app evolves.*
```

---

## Companion: APP-QUESTIONNAIRE.md

When starting a new project or when an AI needs to fill out APP.md, use this questionnaire to extract all needed information from Matthew.

---

## Location Convention

```
~/Synced/Opta/1-Apps/<project>/APP.md              — The identity document
~/Synced/Opta/1-Apps/<project>/CLAUDE.md            — AI coding instructions (existing)
~/Synced/Opta/1-Apps/<project>/README.md            — Public-facing description
```

**Read order for any AI session:**
1. `APP.md` — Understand what this is
2. `CLAUDE.md` — Understand how to work on it
3. Then start working

---

## Rollout Plan

Create APP.md for all existing Opta projects:

| Project | Location | Priority |
|---------|----------|----------|
| **Opta-LMX** | `1M-Opta-LMX/APP.md` | 🔴 Now (new project) |
| **OptaPlus** | `1I-OptaPlus/APP.md` | 🔴 High (active development) |
| **Opta CLI** | `1D-Opta-CLI-TS/APP.md` | 🔴 High (needs migration clarity) |
| **Opta Life iOS** | `1E-Opta-Life-IOS/APP.md` | 🟡 Medium |
| **Opta Life Web** | `1F-Opta-Life-Web/APP.md` | 🟡 Medium |
| **Optamize macOS** | `1A-Optamize-macOS/APP.md` | 🟡 Medium |
| **Opta+** (design system) | `OptaPlus/APP.md` | 🟢 Low |
