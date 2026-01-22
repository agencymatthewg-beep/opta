# Opta Scan

## What This Is

Opta Scan is a native iOS app with one powerful feature: **capture anything, optimize everything**. Take a photo or write a prompt, answer a few clarifying questions, and get an optimized answer beautifully visualized — all processed locally on your device with Llama 3.2 11B Vision.

## Core Value

**Private optimization in your pocket.** Unlike cloud-based AI chatbots, Opta Scan processes everything on-device. Your photos and prompts never leave your phone. It's easier to use, more thorough when needed, and presents information in a way that makes decisions obvious.

## Current State (v2.0 Local Intelligence)

**Shipped:** 2026-01-22

**Tech Stack:**
- SwiftUI (iOS 17.2+)
- MLX Swift for on-device AI
- Llama 3.2 11B Vision model
- Core Data for history
- 68 Swift files, 13,132 LOC

**Key Capabilities:**
- Photo capture with instant local processing
- Text prompt input as alternative
- Smart question generation
- "Optamize" depth slider
- Visual result cards with rankings
- History persistence
- Offline operation (after model download)
- Battery optimization modes

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
| **Privacy** | Cloud processing | 100% on-device |
| **Ease** | Multi-step prompting | Photo + one sentence |
| **Thoroughness** | One-size-fits-all | "Optamize" depth slider |
| **Output** | Text walls | Visual cards, rankings, highlights |
| **Offline** | Requires internet | Works offline after download |

## Requirements

### Validated

- Camera capture with instant processing — v1.0
- Text prompt input as alternative to photo — v1.0
- Smart question generation based on context — v1.0
- "Optamize" slider (quick → thorough analysis) — v1.0
- Beautiful result visualization (cards, rankings, highlights) — v1.0
- Result history for reference — v1.0
- Advanced gestures (swipe, pinch, long-press) — v1.2
- Metal shader effects — v1.2
- Physics-based animations — v1.2
- Thermal and battery optimization — v1.2
- 100% on-device AI processing — v2.0
- Offline operation — v2.0
- Real-time generation progress — v2.0
- Cancel support for generations — v2.0

### Active

- [ ] Share optimized results
- [ ] App Store screenshots
- [ ] Privacy policy URL
- [ ] TestFlight distribution
- [ ] iPad-specific layouts

### Out of Scope

- Account system / cloud sync — local-first approach
- Social features — focused single-user experience
- Apple Watch companion — mobile-first
- Android version — iOS exclusive for v2.x

## Context

**Why local AI?**
- Privacy: Photos and prompts never leave device
- Offline: Works anywhere after model download
- Speed: No network latency for inference
- Cost: No per-request API fees

**Technical approach:**
- MLX Swift for Apple Silicon optimization
- Llama 3.2 11B Vision for multimodal understanding
- Streaming token generation with progress
- Thermal-aware quality adaptation
- Battery mode selection

## Constraints

- **Privacy-first**: All processing on-device
- **Model size**: ~6GB download required
- **Device requirements**: iOS 17.2+, sufficient storage
- **Speed**: Depends on device capability
- **Simplicity**: Maximum 3 clarifying questions
- **Visual**: Every result must be scannable

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Local AI (MLX) | Privacy-first, offline-capable | Validated v2.0 |
| Llama 3.2 11B Vision | Best balance of quality and size | Validated v2.0 |
| Photo-first UX | Lowest friction for real-world optimization | Validated v1.0 |
| "Optamize" slider | User controls depth vs. speed tradeoff | Validated v1.0 |
| Card-based results | Scannable, shareable, beautiful | Validated v1.0 |
| iOS 17.2+ minimum | MLX Swift requirement | Validated v2.0 |
| Spring-only animations | Natural, premium feel | Validated v1.2 |
| OLED background #09090b | Prevents smear on scroll | Validated v1.0 |
| Battery mode selection | User control over speed vs battery | Validated v2.0 |

---
*Last updated: 2026-01-22 after v2.0 Local Intelligence milestone*
