---
scope: Documentation index
purpose: Read order for AI agents
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus Documentation — INDEX.md

> **Read order for AI agents starting work on OptaPlus.** Every document listed with 1-line description. Start at #1, read sequentially until you reach your target layer.

---

## 📖 Read Order for Developers

### Phase 1: Understand the Product (Start Here)

1. **APP.md** (product vision, 15 min)
   - What OptaPlus is, why it exists, business model, ecosystem position
   - Read this first, no exceptions

2. **SHARED.md** (cross-platform architecture, 15 min)
   - Data models (Bot, ChatMessage, CronJob), sync strategy, design language
   - Shared between macOS and iOS

3. **docs/INDEX.md** (this file, 5 min)
   - Read order, document map, entry points

### Phase 2: Learn Your Platform (Choose One)

**For macOS Development:**
4a. **macOS/PLATFORM.md** (features, layout, UI, 20 min)
   - macOS-exclusive features: multi-window, command palette, keyboards
   - Actual code paths, window management patterns

4a2. **macOS/CLAUDE.md** (coding rules, 20 min)
   - Pure SwiftUI patterns, AppKit avoid, keyboard shortcut implementation
   - Copy-paste ready code snippets, reference existing files

**For iOS Development:**
4b. **iOS/PLATFORM.md** (features, UI, iOS-specific, 20 min)
   - iOS-exclusive features: Siri, Widgets, Live Activities, haptics
   - Actual code paths, gesture patterns

4b2. **iOS/CLAUDE.md** (coding rules, 20 min)
   - Pure SwiftUI navigation with NavigationStack, App Intents, WidgetKit
   - Copy-paste ready code snippets

### Phase 3: Architecture & Decisions (Reference as Needed)

5. **docs/GUARDRAILS.md** (safety rules, compliance, 10 min)
   - Non-negotiable rules, C01-C06 compliance, dependencies policy
   - Read before writing code

6. **docs/DECISIONS.md** (decision log, settled architecture, 10 min)
   - Why NWConnection over URLSession, why zero deps, design choices
   - Reference when questioning architecture

7. **docs/ECOSYSTEM.md** (broader context, 10 min)
   - How OptaPlus fits with Opta CLI, Opta Life, Opta-LMX, bots
   - Data flows, gateway infrastructure

### Phase 4: Resources & Workflows (Use During Development)

8. **docs/KNOWLEDGE.md** (references, skills, infrastructure, 10 min)
   - OpenClaw docs path, Gateway Protocol v3, bot infrastructure
   - External resources, Cloudflare tunnel config

9. **docs/ROADMAP.md** (version targets, milestones, 10 min)
   - v0.9 (current) → v1.0 (Telegram replacement) → v2.0
   - Feature groups, estimated effort, release dates

10. **docs/WORKFLOWS.md** (development practices, 15 min)
    - How to add a feature, how to add a bot, testing workflow
    - Build script, git conventions, Clauding workflow

---

## 🗺️ Document Map by Purpose

### "I want to understand the product"
→ Start with APP.md, then SHARED.md, then ECOSYSTEM.md

### "I'm coding a feature for macOS"
→ macOS/PLATFORM.md → macOS/CLAUDE.md → GUARDRAILS.md

### "I'm coding a feature for iOS"
→ iOS/PLATFORM.md → iOS/CLAUDE.md → GUARDRAILS.md

### "I'm adding a new bot"
→ ECOSYSTEM.md → docs/WORKFLOWS.md → docs/KNOWLEDGE.md

### "I'm debugging a crash"
→ macOS/CLAUDE.md or iOS/CLAUDE.md (testing section) → WORKFLOWS.md

### "I'm about to merge a PR"
→ GUARDRAILS.md (code review) → macOS/CLAUDE.md or iOS/CLAUDE.md (checklist)

### "I'm planning the next version"
→ ROADMAP.md → DECISIONS.md → APP.md

---

## 📋 File Summaries (Quick Reference)

| File | Purpose | Audience | Length |
|------|---------|----------|--------|
| **APP.md** | Product vision, business model, ecosystem | Everyone | 15 min |
| **SHARED.md** | Cross-platform models, sync, design tokens | All developers | 15 min |
| **macOS/PLATFORM.md** | macOS features, multi-window, UI layout | macOS devs | 20 min |
| **macOS/CLAUDE.md** | macOS coding patterns, keyboard shortcuts | macOS devs | 20 min |
| **iOS/PLATFORM.md** | iOS features, Siri, Widgets, gestures | iOS devs | 20 min |
| **iOS/CLAUDE.md** | iOS coding patterns, App Intents, navigation | iOS devs | 20 min |
| **docs/INDEX.md** | This file — read order, document map | Everyone | 10 min |
| **docs/GUARDRAILS.md** | Safety rules, compliance, dependencies | All developers | 10 min |
| **docs/DECISIONS.md** | Why we chose each architecture | Decision makers | 10 min |
| **docs/ECOSYSTEM.md** | How OptaPlus fits in Opta ecosystem | System architects | 10 min |
| **docs/KNOWLEDGE.md** | External resources, infrastructure reference | Ops, infrastructure | 10 min |
| **docs/ROADMAP.md** | Version targets, milestones, effort | Project managers | 10 min |
| **docs/WORKFLOWS.md** | Development practices, git, build scripts | All developers | 15 min |

---

## 🎯 Entry Points by Role

### Developer (Starting Fresh)
1. APP.md (15 min)
2. SHARED.md (15 min)
3. macOS/PLATFORM.md OR iOS/PLATFORM.md (20 min)
4. macOS/CLAUDE.md OR iOS/CLAUDE.md (20 min)
5. GUARDRAILS.md (10 min)
6. Start coding

**Total: 80 minutes to ready**

### Code Reviewer
1. macOS/CLAUDE.md or iOS/CLAUDE.md (20 min)
2. GUARDRAILS.md (10 min)
3. Review PR against checklist

**Total: 30 minutes**

### Project Manager
1. APP.md (15 min)
2. ROADMAP.md (10 min)
3. Understand timelines

**Total: 25 minutes**

### Infrastructure / Bot Ops
1. ECOSYSTEM.md (10 min)
2. KNOWLEDGE.md (10 min)
3. docs/WORKFLOWS.md (15 min)

**Total: 35 minutes**

### New Bot Developer
1. ECOSYSTEM.md (10 min)
2. docs/WORKFLOWS.md (15 min)
3. SHARED.md (15 min)

**Total: 40 minutes**

---

## 🔍 How to Find Things

### I need to know [X]. Which document?

| Question | Answer |
|----------|--------|
| What is OptaPlus? | APP.md |
| How does the app structure work? | SHARED.md |
| How do I build a macOS feature? | macOS/PLATFORM.md + macOS/CLAUDE.md |
| How do I build an iOS feature? | iOS/PLATFORM.md + iOS/CLAUDE.md |
| What are the rules? | GUARDRAILS.md |
| Why did we choose [architecture]? | DECISIONS.md |
| How do the bots connect? | ECOSYSTEM.md |
| What external tools do we use? | KNOWLEDGE.md |
| What's the schedule? | ROADMAP.md |
| How do I test? Deploy? Add a bot? | WORKFLOWS.md |

---

## ✅ Pre-Work Checklist

Before starting ANY coding work:

- [ ] Read APP.md
- [ ] Read SHARED.md
- [ ] Read `<platform>/PLATFORM.md` (macOS or iOS)
- [ ] Read `<platform>/CLAUDE.md` (macOS or iOS)
- [ ] Read GUARDRAILS.md
- [ ] Skim DECISIONS.md (know why we chose NWConnection, zero deps, etc.)
- [ ] Reference WORKFLOWS.md for build/test process

---

## 🔄 Update This Document When...

- [ ] A new documentation file is created
- [ ] A document is renamed or moved
- [ ] Read order changes
- [ ] A new entry point (role) is added
- [ ] Average read time for any document changes by >5 minutes

---

## 📚 Cross-References (By Document)

### From APP.md
→ SHARED.md (data models, design tokens)
→ macOS/PLATFORM.md (macOS-specific features)
→ iOS/PLATFORM.md (iOS-specific features)
→ ECOSYSTEM.md (broader context)

### From SHARED.md
→ APP.md (product vision)
→ macOS/CLAUDE.md (implementation patterns)
→ iOS/CLAUDE.md (implementation patterns)
→ GUARDRAILS.md (compliance)

### From macOS/PLATFORM.md
→ macOS/CLAUDE.md (coding rules)
→ SHARED.md (shared models)
→ GUARDRAILS.md (safety rules)

### From iOS/PLATFORM.md
→ iOS/CLAUDE.md (coding rules)
→ SHARED.md (shared models)
→ GUARDRAILS.md (safety rules)

### From GUARDRAILS.md
→ macOS/CLAUDE.md (code review checklist)
→ iOS/CLAUDE.md (code review checklist)
→ DECISIONS.md (why these rules)

### From DECISIONS.md
→ SHARED.md (technical architecture)
→ GUARDRAILS.md (compliance rules)

### From ECOSYSTEM.md
→ APP.md (product context)
→ KNOWLEDGE.md (infrastructure)
→ WORKFLOWS.md (how to add a bot)

### From KNOWLEDGE.md
→ ECOSYSTEM.md (bot infrastructure)
→ WORKFLOWS.md (build, test, deploy)

### From ROADMAP.md
→ APP.md (product goals)
→ DECISIONS.md (architectural decisions)

### From WORKFLOWS.md
→ macOS/CLAUDE.md (build, test)
→ iOS/CLAUDE.md (build, test)
→ GUARDRAILS.md (compliance)
→ KNOWLEDGE.md (external tools)

---

## 💾 Document Metadata

All docs follow YAML frontmatter:
```yaml
---
parent: <reference doc>
scope: <product area: APP, macOS, iOS, docs>
purpose: <one-line purpose>
version: <version number>
updated: <date>
---
```

When reading, check the frontmatter to understand where a doc fits.

---

## 📞 Questions?

- **"Where do I find [X]?"** → Check the "How to Find Things" table above
- **"Which doc should I read?"** → Check your role in "Entry Points by Role"
- **"Is this document up-to-date?"** → Check the `updated:` field in frontmatter

---

