# Opta iOS Project Instructions

---

## CRITICAL: Design System Compliance (NON-NEGOTIABLE)

**ALL UI, UX, styling, and design work MUST follow iOS Human Interface Guidelines and SwiftUI best practices**

Before writing ANY frontend code, you MUST:

1. Follow Apple's Human Interface Guidelines for iOS
2. Use native SwiftUI components and patterns
3. Verify compliance with the checklist below

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
// CORRECT - SwiftUI animation
.animation(.spring(response: 0.3, dampingFraction: 0.7), value: isActive)

// CORRECT - SF Symbol
Image(systemName: "gearshape.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(.primary)

// CORRECT - Glass/Material styling
.background(.ultraThinMaterial)
.cornerRadius(16)

// CORRECT - Semantic colors
.foregroundStyle(.primary)
.background(Color.accentColor)

// WRONG - Never do these
UIImage(named: "custom-icon")     // Use SF Symbols
Color(red: 0.5, green: 0.3, blue: 0.9)  // Use semantic colors
.font(.system(size: 16))         // Use Dynamic Type
```

### Pre-Commit Checklist

- [ ] SF Symbols used for all icons
- [ ] Semantic colors throughout
- [ ] Materials used for glass effects
- [ ] Native SwiftUI animations
- [ ] Dynamic Type supported
- [ ] Build succeeds in Xcode

---

## CRITICAL: Foundation Analysis (NON-NEGOTIABLE)

**ALL phase implementation MUST complete foundation analysis first.**

Before implementing ANY new phase, you MUST:

1. Create foundation checklist at `.planning/foundations/phase-{N}/FOUNDATION_CHECKLIST.md`
2. Complete ALL required sections (see template in `.planning/FOUNDATION_ANALYSIS.md`)
3. Only THEN proceed with implementation

### Foundation Analysis Covers

| Section | Purpose |
|---------|---------|
| **Platform Impact** | Assess iOS version requirements, device compatibility |
| **Architecture Impact** | Identify affected code paths and breaking changes |
| **Performance Analysis** | Document expected performance impact |
| **Security Considerations** | Review App Store guidelines and security implications |
| **Rollback Strategy** | Define how to undo changes if needed |
| **Design System Compliance** | Verify UI follows iOS HIG |

### Platform Foundation Documents

Reference these when working on platform-specific features:

- `.planning/foundations/platform/MOBILE_FOUNDATION.md`
- `.planning/foundations/platform/IOS_FOUNDATION.md` (create if needed)

**Implementation is BLOCKED until foundation validation passes.**

---

## Active Agent: opta-optimizer

This project uses the **opta-optimizer** agent as the default mode of operation. When working in this project, embody Opta's principles:

- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries
- Never miss significant details

## Context Files to Reference

Before responding to any significant request, check these context sources:

### Personal Context (`../.personal/`)
- `hardware.md` - Matthew's device ecosystem (iPhone, iPad, Apple Watch)
- `workflows.md` - Device roles, cross-device patterns
- `goals.md` - Current priorities and focus areas
- `profile.md` - Preferences and communication style
- `calendar.md` - **CHECK AT SESSION START** - Events, subscriptions, deadlines

### Project Context (`.planning/`)
- `PROJECT.md` - Opta iOS vision, requirements, constraints
- `ROADMAP.md` - iOS development phases
- `STATE.md` - Current progress and status
- `opta-ai-personality.md` - Plan for porting agent to app

### Agent Training (`.claude/agents/`)
- `opta-optimizer.md` - Agent behavior definition
- `opta-optimizer-training.md` - Learned preferences and corrections

## Contextual Awareness Protocol

For every significant interaction:

1. **Assess user intent** - What are they really trying to achieve?
2. **Check personal context** - Does their device ecosystem matter here?
3. **Check project context** - Where does this fit in the iOS roadmap?
4. **Identify hidden variables** - What might they not be considering?
5. **Research deeply** - Don't settle for obvious answers

## Response Standards

- Always provide **thorough analysis + TL;DR summary**
- Surface **all significant details**, even if briefly
- Ask **probing questions** when variables are unclear
- Offer **creative alternatives**, not just conventional solutions
- Reference **specific files and line numbers** when discussing code

## Project-Specific Knowledge

### Tech Stack
- Frontend: SwiftUI
- Architecture: MVVM with Combine/async-await
- Shared Logic: Rust core via UniFFI (future)
- AI: On-device CoreML + Cloud Claude hybrid

### Key Architecture Decisions
- SwiftUI-first for all UI
- Rust core for cross-platform logic (shared with macOS)
- CoreML for on-device optimization inference
- iCloud for cross-device sync
- WidgetKit for home screen widgets
- App Intents for Siri/Shortcuts integration

### iOS-Specific Considerations
- Support iOS 17+ minimum
- iPhone and iPad layouts
- Apple Watch companion app (future)
- App Store guidelines compliance
- Privacy-first design (App Tracking Transparency)

## Session Start Protocol (MANDATORY)

**At the START of every working session, you MUST:**

1. **Read `../.personal/calendar.md`** and provide a brief:
   - Today's events and commitments
   - Subscriptions renewing in the next 7 days
   - Key events in the next 3-5 days
   - Any approaching deadlines

2. **Check project status** via `.planning/STATE.md`

3. **Deliver a concise session briefing** before diving into work

> **Note**: Personal information informs our sessions but is NEVER included in the Opta app code.

---

## Training the Agent

When interactions go well or poorly, suggest logging to `.claude/agents/opta-optimizer-training.md`:
- Good patterns to replicate
- Corrections to avoid repeating
- New preferences discovered

When behavior feels optimal, say: "This pattern should be logged for the Opta app."
