# Must-Have Features

Ideas and requirements that MUST be implemented in Opta, regardless of current phase.

---

## Features

- **Opta Score System**: Comprehensive category-based sub-scores with before/after comparisons for every optimization. Categories span three dimensions:
  - **Performance**: FPS Potential, Stability (no stutters), Load Times
  - **Experience**: Visual Quality, Thermal Efficiency, System Responsiveness
  - **Competitive**: Input Lag, Network Latency, Background Interference
  Each score is derived from weighted hardware specs, configuration settings, and environment variables. Scores are comparable and shareable with friends.

- **Adaptive User Modes**: Three sophistication tiers that adapt the entire app experience:
  - **Simple Mode** (Elderly/Kids/Beginners): Plain language summaries, safer optimizations only, risky changes avoided
  - **Standard Mode** (Average user): Best ROI balance, transparent but not overwhelming, powerful improvements
  - **Power Mode** (Tech enthusiasts): Full control and visibility, 100% optimization potential, advanced options unlocked

- **Optimization Depth Levels**: Separate from User Mode - three levels of thoroughness the user can choose:
  - **Efficient**: Quick optimizations, minimal user input, infers where possible
  - **Thorough**: Balanced approach, moderate questions
  - **Optimised**: Maximum user input required, longest analysis time, guaranteed best possible result

- **Human-Readable Explanations**: Every optimization shows practical impact, not just technical changes. Example: Not "Resolution: 1440p → 1080p" but "Reduced pixels on your screen to boost FPS. Expect ~15% more frames in [game]. Advanced: GPU renders fewer pixels per frame, reducing load." Explanation depth adapts to User Mode.

- **Preference Presets**: Users can save their optimization priorities as reusable presets (e.g., "Fully Optimized for FPS", "Stream-friendly", "Quiet Mode"). Presets skip redundant questions during future optimizations by applying saved preferences automatically.

- **Personalized Learning AI**: Opta learns from user decisions over time. Communicates learning through:
  - Explicit callouts: "Based on your history, I'm prioritizing FPS over quality. Change this?"
  - Periodic summaries: "This month I learned: You prefer FPS, hate fan noise, don't care about load times"
  - Editable Profile page showing all learned preferences

- **Conversational Onboarding**: Quick quiz (3-5 questions) where Opta "talks" to the user with understated confidence. Voice: "I see what's happening here. Give me a moment to figure out your best path forward." Not a boring form - feels like meeting a capable expert.

- **Wow Factors**: Features that impress and drive sharing:
  - Live benchmark replay: Side-by-side video showing BEFORE vs AFTER gameplay smoothness
  - Money saved calculation: "This optimization gave you performance equivalent to a $200 GPU upgrade"
  - Percentile ranking: "Your system now performs better than 78% of similar builds"
  - Time-lapse improvement: Animated visualization showing score climbing as optimizations apply

- **Optimization History**: Combined dashboard + timeline view. Dashboard shows aggregate stats ("Total FPS gained: 47, Optimizations applied: 23") with drill-down to scrollable timeline ("Jan 15: +12 FPS in Valorant, Jan 10: Reduced input lag by 8ms").

- **Friend Comparisons**: Add friends, compare Opta Scores and setups, see what optimizations they've applied. Social competition to drive engagement.

- **Risky Option Handling**: For Simple Mode users, risky optimizations are visible but locked (greyed out with "Switch to Power Mode to unlock"). Creates curiosity and progression without hiding capabilities.

- **Pinpoint Optimization Mode**: Wizard-style focused sessions for a single goal. Example: "Let's maximize your FPS in Valorant" - walks through every relevant setting step-by-step, shows predicted impact, applies changes with approval. Different from general optimization - this is laser-focused on one metric.

- **Smart Error Recovery**: Full safety net when optimizations don't work as expected:
  - One-click rollback: "Undo last optimization" instantly reverts to previous state
  - Auto-detection: Opta monitors performance after changes - "I noticed your FPS dropped. Want me to revert?"
  - Report & learn: "This didn't work for me" button - Opta learns and improves recommendations for similar hardware setups

- **Milestone Badges**: Achievement system for major accomplishments (not streaks/challenges - keeps it professional):
  - "First 10 FPS gained", "System Optimized for 30 days", "Top 10% in your hardware tier"
  - Visible on profile, shareable with friends

---

## UX / Design

- **Opta Personality**: Precise, objective, NOT an AI trying to be the user's friend. No excessive praise, no unnecessary superlatives, no emoji overload. Professional, helpful, and direct.

- **Communication Style Preference**: User chooses between:
  - **Informative & Educational**: Explains the "why" behind optimizations, teaches the user
  - **Concise & Efficient**: Just the facts, minimal explanation, faster interactions

- **Opta Text Zone**: Central glassmorphic text area (top center) that dynamically translates what's happening into simple, contextual guidance. Key behaviors:
  - **Color-coded feedback**: Green for positive (gains, confirmations), red for warnings/decreases
  - **Dynamic indicators**: Green up arrows with % increase, red down arrows with % decrease
  - **Contextual hints**: Shows "Remember?" when hovering over preference-saving buttons
  - **Adaptive prominence**: Subtle by default, becomes bolder for important changes (warnings, big gains)
  - **Satisfying micro-animations**: Numbers count up, arrows animate in, smooth color transitions
  - **Disagreement handling**: Shows data/stats with visual impact representation, asks "Lock in?" with option to learn for future
  - The single source of truth for understanding the current state - always one place to look.

- **Core Emotional Goals**: Users should feel all four simultaneously:
  - Empowered & in control (like having a knowledgeable friend who lets YOU decide)
  - Relieved & trusting (like handing your car to a skilled mechanic)
  - Curious & learning (getting smarter about your PC over time)
  - Impressed & amazed (discovering what your PC can actually do)

---

## Technical

- **Privacy-First Data Storage**: User choice for data location:
  - Default: Local-only storage - all preferences, history, learned behaviors stay on device
  - Optional: Cloud sync for those who want cross-device access (requires account)
  - Clear messaging about what's stored where

- **Flexible Hardware Comparison**: For percentile rankings and friend comparisons, users can filter by:
  - Similar hardware: "RTX 4070 + Ryzen 7" tier (auto-detected)
  - Price tier: Budget / Mid-range / High-end / Enthusiast
  - Performance tier: Based on actual benchmark scores
  - Global: Compare against all Opta users

---

## Integrations

<!-- External tools, APIs, or services -->

---

## Future Vision

*Not for immediate implementation - long-term expansion of the "optimization" methodology:*

- **Business Optimization**: Apply Opta's systematic approach to business workflows, tool selection, productivity
- **Health Optimization**: Personalized recommendations for lifestyle, habits, routines based on goals
- **Shopping Optimization**: Best value calculations, timing recommendations, deal detection

*Core insight: Opta's value is the methodology - systematic analysis, weighted scoring, personalized learning, human-readable explanations. This could extend beyond PC optimization.*

---
