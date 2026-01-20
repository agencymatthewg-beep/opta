# Opta Scan

## What This Is

Opta Scan is a native iOS app with one powerful feature: **capture anything, optimize everything**. Take a photo or write a prompt, answer a few clarifying questions, and get an optimized answer beautifully visualized.

## Core Value

**Optimization in your pocket.** Unlike generic AI chatbots, Opta Scan is purpose-built for optimization decisions. It's easier to use, more thorough when needed, and presents information in a way that makes decisions obvious.

## The One Feature

```
[Photo/Prompt] → [Questions] → [Optimized Answer]
```

**Example flows:**
- Photo of restaurant menu + "most filling for under $15" → highlighted items with nutrition breakdown
- Screenshot of product options + "best value long-term" → ranked list with cost analysis
- Photo of gym equipment + "full body workout in 20 min" → structured workout plan
- Text prompt "commute options downtown" + context → optimized route with tradeoffs

## Key Differentiators

| Aspect | Generic AI | Opta Scan |
|--------|-----------|-----------|
| **Ease** | Multi-step prompting | Photo + one sentence |
| **Thoroughness** | One-size-fits-all | "Optamize" depth slider |
| **Output** | Text walls | Visual cards, rankings, highlights |
| **Focus** | Everything | Optimization decisions |

## Requirements

### Active

- [ ] Camera capture with instant processing
- [ ] Text prompt input as alternative to photo
- [ ] Smart question generation based on context
- [ ] "Optamize" slider (quick → thorough analysis)
- [ ] Beautiful result visualization (cards, rankings, highlights)
- [ ] Result history for reference
- [ ] Share optimized results

### Out of Scope (v1.0)

- Account system / cloud sync
- Social features
- Offline AI processing
- Apple Watch companion
- iPad-specific layouts

## Context

**Why this approach?**
- Mobile-first: optimization decisions happen in the real world
- Photo capture removes friction of describing things
- Focused UX beats general-purpose chatbots
- Visual output makes decisions actionable

**Technical approach:**
- SwiftUI for native iOS experience
- Claude API for optimization intelligence
- Vision API for image understanding
- Local history storage (Core Data)
- iOS 17+ for modern SwiftUI features

## Constraints

- **Privacy-first**: Photos processed via API, not stored on servers
- **Speed**: Results in under 5 seconds for quick mode
- **Simplicity**: Maximum 3 clarifying questions
- **Visual**: Every result must be scannable, not a text wall

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Cloud AI (Claude) | Best optimization reasoning, no on-device ML complexity | Pending |
| Photo-first UX | Lowest friction for real-world optimization | Pending |
| "Optamize" slider | User controls depth vs. speed tradeoff | Pending |
| Card-based results | Scannable, shareable, beautiful | Pending |
| iOS 17+ minimum | Modern SwiftUI, simpler codebase | Pending |

---
*Last updated: 2026-01-20 — Opta Scan concept*
