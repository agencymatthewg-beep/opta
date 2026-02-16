# OptaPlus — OPIS Stage 1 Answers (Brownfield)

**Date:** 2026-02-15
**Mode:** Brownfield (existing codebase → OPIS retrofit)

---

## Q1: Is the codebase analysis accurate?
**Answer:** Yes, accurate.

## Q2: Vision beyond what's built?
**Answer:** OptaPlus iOS = THE single most convenient, feature-rich, efficient and holistically capable app for OpenClaw on iOS. Simple, intuitive, easy to switch to from Telegram/WhatsApp/Discord. Allows power users to configure and customize for:
1. Full OpenClaw operations and features on the go
2. Visually appealing with HD elements, animations, micro-animations for contextual status/indicators
3. Easy, stable, convenient communication + management of OpenClaw bots

## Q3: Non-negotiable vs experimental features?
**Answer (Core for BOTH platforms):**
- Automation management
- Bot debugging (restart, config scanning, connection checking, status, context clearing/compacting)
- Bot chatting with live thinking view, cross-channel message visibility, context inspection
- Replace the need for ANY other OpenClaw channel or app

**Differentiation strategy:** Get iOS working well as Telegram replacement first → then develop macOS extensively for heavy work.

## Q4: macOS vs iOS divergence?
**Answer:** macOS ~3-5x iOS features. iOS = replace Telegram. macOS = extensive daily-use work tool.

## Q5: iOS-exclusive features?
**Answer:** All mentioned (Siri, widgets, Live Activities). Siri specifically called out — "easy OpenClaw communication by using Siri on any device on the go."

## Q6: Priority platform?
**Answer:** macOS primary, but iOS is HIGH priority (needs to replace Telegram soon).

## Q7: Bot management capabilities?
**Answer:** Yes. Investigate current automation management foundations and app features — Matthew likes the direction so far.

## Q8: Design system ownership (OptaMolt vs Opta+)?
**Answer:** OptaMolt is legacy (from before OptaPlus existed). Was originally for adding OpenClaw to Opta Life. Extracted elements may be useful for Opta Life development but should NOT be prioritized — old and likely outdated for OptaPlus.

## Q9: Multi-window?
**Answer:** macOS = defining feature (simultaneous multi-window bot conversations). iOS = quick switching only (no split-screen, due to screen size).

## Q10: What does v1.0 look like?
**Answer:** Complete Telegram replacement.

---

## Key Takeaways

| Aspect | Decision |
|--------|----------|
| iOS identity | Single app for ALL OpenClaw on iOS |
| macOS identity | Extensive work tool for heavy OpenClaw use |
| Platform ratio | macOS ~3-5x iOS features |
| v1.0 bar | Replace Telegram completely |
| Multi-window | macOS only, defining feature |
| Siri | Cross-device, core feature |
| OptaMolt | Legacy, low priority, don't build on it |
| Design | HD elements, animations, micro-animations |
| Bot management | Core feature, not optional |
| Development order | iOS to usable Telegram replacement → macOS heavy development |
