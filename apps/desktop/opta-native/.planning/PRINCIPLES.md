# Opta Principles

These principles guide every decision in Opta's development.

## The Three Pillars

### 1. Unified Optimization
**"One tool to replace them all."**

- Replace fragmented optimization tools with one coherent solution
- Detect conflicts between competing tools
- Provide measurable, verifiable performance gains
- Work across all hardware, not locked to vendors

### 2. Adaptive Intelligence
**"Opta learns you, locally."**

- Learn each user's unique context over time
- ALL learning data stored locally, NEVER transmitted
- Full transparency about what's learned
- User has complete control over their data
- Adapt recommendations based on accumulated patterns

### 3. Educational Empowerment
**"Understand, don't just accept."**

- Every optimization can be explained
- Power users can dig as deep as they want
- Casual users get clear, visual explanations
- Opta makes users smarter about their systems
- Knowledge transfer, not just blind fixes

---

## Privacy Principles

1. **Local by Default**: Sensitive data never leaves the device
2. **Cloud is Anonymized**: Any cloud queries strip PII and hardware identifiers
3. **Transparency Always**: Users can see everything Opta knows about them
4. **User Control**: Edit, delete, export—data belongs to users
5. **No Hidden Collection**: If it's stored, it's visible in the Transparency Panel

---

## User Experience Principles

1. **Progressive Disclosure**: Simple by default, depth on demand
2. **Human-in-the-Loop**: System changes require explicit approval
3. **Explain Everything**: Never make black-box changes
4. **Power User Ready**: Don't dumb down for experts
5. **Immersive Design**: Futuristic, focused, engaging

---

## Learning Philosophy

### What Opta Learns (All Local)

| Category | Examples | Purpose |
|----------|----------|---------|
| **Hardware Profile** | CPU/GPU specs, RAM, storage | Tailor recommendations to actual hardware |
| **Gaming Habits** | Games played, session patterns | Optimize for actual usage |
| **Optimization Preferences** | Accepted/rejected recommendations | Learn user's risk tolerance |
| **Performance History** | Benchmark results over time | Track improvement, detect regressions |
| **Interaction Style** | Detail level preferred, features used | Adapt UI complexity |

### How Users Learn from Opta

| Level | Experience |
|-------|------------|
| **Casual** | Clear summaries, visual before/after, "it just works" |
| **Curious** | "Why?" tooltips, expandable explanations, Learn Mode |
| **Power User** | Investigation mode, full logs, deep-dive analysis |

---

## Design Principles

See: `/DESIGN_SYSTEM.md` for visual design requirements

1. **Glassmorphism**: Consistent frosted glass aesthetic
2. **Animation-Rich**: Framer Motion throughout
3. **Purple & Violet**: Cohesive color palette
4. **Sora Typography**: Clean, modern font
5. **Lucide Icons**: Consistent icon language

---

## Platform Strategy

| Priority | Platform | Status |
|----------|----------|--------|
| 1 | **macOS** | Primary development platform |
| 2 | **Windows** | After macOS is polished |
| 3 | Linux | Deferred to v2 |
| 4 | Mobile | After desktop platforms optimal (different feature set) |

**Rationale**: Focus resources on getting one platform excellent before expanding. macOS is the development environment, so it gets priority for rapid iteration.

---

*These principles are non-negotiable. Every feature, every UI decision, every data handling choice must align with them.*
