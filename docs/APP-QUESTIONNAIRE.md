# APP.md Questionnaire

**Purpose:** Ask these questions to fill out a complete APP.md for any project.
**Usage:** Any AI starting a new project or discovering a project without APP.md should work through this questionnaire with Matthew.

---

## Instructions for AI

1. Present questions one section at a time (don't dump all 30+ questions at once)
2. Start with Section A (Identity) — these are quick facts
3. Move to Section B (Purpose) — this is the most important section
4. Skip questions Matthew has already answered in conversation
5. If Matthew gives a short answer, ask a follow-up to get specifics
6. After all sections, generate the APP.md and ask for review

---

## Section A: Identity (Quick Facts)

1. **What's the app called?** (Name and any working titles)
2. **Describe it in one sentence.** (The tagline)
3. **What type of app is it?** (CLI, macOS app, iOS app, web app, API service, library, etc.)
4. **What platform(s)?** (macOS, iOS, web, cross-platform, server-side)
5. **What language/framework?** (Swift, TypeScript, Python, Rust, React, SwiftUI, etc.)
6. **What's the current status?** (Idea, planning, in development, beta, production)

---

## Section B: Purpose (Most Important)

7. **In 2-3 sentences, what does this app DO?** (Not what it is — what it does for the user)
8. **What problem does it solve?** (What pain, gap, or frustration does this address?)
9. **Why can't you just use [existing tool X]?** (What makes this necessary vs. alternatives?)
10. **What's the ONE thing this app must do better than anything else?** (The differentiator)
11. **What does this app explicitly NOT do?** (What's out of scope? What's another app's job?)

---

## Section C: Target Audience

12. **Who is the primary user?** (You? Your bots? Developers? General public?)
13. **Give me 3 specific scenarios where someone uses this app.** (Concrete use cases)
14. **What should the experience FEEL like?** (Fast? Powerful? Simple? Premium? Invisible?)

---

## Section D: Non-Negotiable Capabilities

15. **List every capability the app MUST have before you'd consider it "working."** (The minimum viable feature set)
16. **For each capability, why is it non-negotiable?** (What breaks if it's missing?)
17. **Are there any hard technical requirements?** (Speed targets, memory limits, compatibility, etc.)

---

## Section E: Design & Quality

18. **What's the design philosophy?** (Minimalist? Feature-rich? Power-user? Friendly? Premium?)
19. **Any specific design references?** (Apps you want it to look/feel like)
20. **What's the quality bar?** (Quick prototype? Solid beta? Polished product? Premium release?)
21. **Any branding requirements?** (Opta design system, specific colors, fonts, etc.)

---

## Section F: Architecture & Dependencies

22. **At a high level, how should this be structured?** (Monolith? Client-server? Library? Microservices?)
23. **What does this app depend on?** (APIs, databases, other Opta apps, external services)
24. **What depends on THIS app?** (Other apps that use it, bots that connect to it)
25. **Any shared code with other Opta apps?** (Design system, networking layer, etc.)

---

## Section G: Development Approach

26. **Any specific coding rules?** (No external deps, pure SwiftUI, specific patterns)
27. **Special instructions for AI agents?** (Things to always/never do when working on this)
28. **How should this be tested?** (Unit tests, integration tests, manual testing, simulator)
29. **How is it deployed?** (App Store, npm publish, launchd service, manual install)

---

## Section H: Roadmap

30. **What's being worked on RIGHT NOW?** (Current priority)
31. **What comes next after that?** (Near-term plan)
32. **Any ideas you want to explore later?** (Backlog items)
33. **Anything you've explicitly decided NOT to build?** (Anti-features, rejected ideas)

---

## Section I: Open Questions

34. **What are you unsure about?** (Unresolved technical decisions, design questions)
35. **What do you need to research before deciding?** (Unknowns that need investigation)

---

## After the Questionnaire

1. Generate the full APP.md from answers
2. Present it to Matthew for review
3. Ask: "Anything I missed or got wrong?"
4. Save to `<project>/APP.md`
5. If CLAUDE.md exists, check for conflicts and reconcile
