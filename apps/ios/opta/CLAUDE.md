# Opta Scan Project Instructions

---

## CRITICAL: Design System Compliance (NON-NEGOTIABLE)

**ALL UI, UX, styling, and design work MUST follow the Opta iOS Aesthetic Guide**

See: `.planning/IOS_AESTHETIC_GUIDE.md` (synced with macOS design system)

Before writing ANY frontend code, you MUST:

1. Read `.planning/IOS_AESTHETIC_GUIDE.md` for Opta-specific styling
2. Follow Apple's Human Interface Guidelines for iOS
3. Use native SwiftUI components and patterns
4. Verify compliance with the checklist below

### Mandatory Requirements

| Requirement | Rule |
|-------------|------|
| **Animations** | SwiftUI native animations (`.animation()`, `withAnimation`) |
| **Icons** | SF Symbols ONLY (never custom SVGs unless absolutely necessary) |
| **Colors** | Use semantic colors from Assets catalog |
| **Typography** | SF Pro (system font) with Dynamic Type support |
| **Styling** | Use SwiftUI modifiers and ViewModifiers |

### Quick Reference

```swift
// CORRECT - Opta spring animations (see IOS_AESTHETIC_GUIDE.md)
.animation(.optaSpring, value: isActive)  // response: 0.3, dampingFraction: 0.7

// CORRECT - SF Symbol with Opta styling
Image(systemName: "camera.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(Color.optaPurple)

// CORRECT - Glass depth system
.glassContent()  // ViewModifier from aesthetic guide

// CORRECT - Opta colors (OLED optimized)
.foregroundStyle(Color.optaTextPrimary)
.background(Color.optaBackground)  // #09090b, not #000000

// WRONG - Never do these
UIImage(named: "custom-icon")              // Use SF Symbols
Color(hex: "000000")                       // Use #09090b (OLED smear)
.animation(.easeInOut(duration: 0.3), ...) // Use spring physics
.font(.system(size: 16))                   // Use Dynamic Type
```

### Pre-Commit Checklist

- [ ] SF Symbols used for all icons
- [ ] Opta colors from aesthetic guide (`optaBackground`, `optaPurple`, etc.)
- [ ] Glass depth modifiers (`.glassSubtle()`, `.glassContent()`, `.glassOverlay()`)
- [ ] Spring animations only (`.optaSpring`, `.optaSpringGentle`, `.optaSpringPage`)
- [ ] Haptics implemented (`OptaHaptics.shared`)
- [ ] Dynamic Type supported
- [ ] Build succeeds in Xcode

---

## The One Feature

**Opta Scan**: Capture anything, optimize everything.

```
[Photo/Prompt] → [Questions] → [Optimized Answer]
```

**Examples:**
- Menu photo + "most filling under $15" → Visual recommendation
- Product screenshot + "best long-term value" → Ranked comparison
- Gym equipment + "20min full body workout" → Structured plan

**Key Differentiators:**
- **Easy**: Photo + one sentence (not multi-step prompting)
- **Thorough**: "Optamize" slider for depth control
- **Visual**: Cards, rankings, highlights (not text walls)

---

## Active Agent: opta-optimizer

This project uses the **opta-optimizer** agent. Embody Opta's principles:

- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries
- Never miss significant details

## Context Files to Reference

### Personal Context (`../../../3. Matthew x Opta/1. personal/`)
- `hardware.md` - Matthew's device ecosystem
- `workflows.md` - Device roles, cross-device patterns
- `goals.md` - Current priorities
- `profile.md` - Preferences and style
- `calendar.md` - **CHECK AT SESSION START**

### Project Context (`.planning/`)
- `PROJECT.md` - Opta Scan vision and requirements
- `ROADMAP.md` - Development phases
- `STATE.md` - Current progress
- `IOS_AESTHETIC_GUIDE.md` - **Design system** (colors, glass, animations, haptics)

## Project-Specific Knowledge

### Tech Stack
- **UI**: SwiftUI (iOS 17+)
- **Architecture**: MVVM with async/await
- **AI**: Claude API (vision + text)
- **Storage**: Core Data for history
- **Camera**: AVFoundation or PhotosUI

### Key Architecture Decisions
- SwiftUI-first for all UI
- Cloud AI via Claude API (no on-device ML complexity)
- Photo-first UX for lowest friction
- Card-based result visualization
- Local-only storage (no account system for v1.0)

### iOS-Specific Considerations
- iOS 17+ minimum
- iPhone-first (iPad later)
- App Store guidelines compliance
- Privacy: photos processed via API, not stored on servers
- Speed: results in <5 seconds for quick mode

## Response Standards

- Always provide **thorough analysis + TL;DR summary**
- Surface **all significant details**, even if briefly
- Ask **probing questions** when variables are unclear
- Offer **creative alternatives**, not just conventional solutions
- Reference **specific files and line numbers** when discussing code

## Session Start Protocol (MANDATORY)

**At the START of every working session:**

1. **Read `../../../3. Matthew x Opta/1. personal/calendar.md`** - today's events, upcoming deadlines
2. **Check `.planning/STATE.md`** - current phase and progress
3. **Deliver a concise session briefing**

---

## Training the Agent

Log interactions to `.claude/agents/opta-optimizer-training.md`:
- Good patterns to replicate
- Corrections to avoid repeating
- New preferences discovered
