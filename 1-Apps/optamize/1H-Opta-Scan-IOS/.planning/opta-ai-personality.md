# Opta AI Personality & Adaptive Learning

## Overview

The `opta-optimizer` Claude agent is being trained and refined to eventually become the AI personality embedded in the Opta application itself. Beyond personality, Opta will implement **Adaptive Intelligence**—learning each user's unique context to deliver increasingly personalized optimizations while keeping ALL data local.

## Current State

**Training Location**: `.claude/agents/opta-optimizer.md`
**Training Data**: `.claude/agents/opta-optimizer-training.md`

The agent is actively learning through:
- User corrections and feedback
- Captured good examples
- Explicit preference rules

## Porting Strategy

### Phase 1: Refinement (Current)
- Use opta-optimizer agent during Opta development
- Log corrections and good patterns
- Build up training data organically

### Phase 2: Pattern Extraction
- Analyze training data for consistent patterns
- Convert implicit behaviors to explicit rules
- Create structured personality config

### Phase 3: Implementation
- Create `src/ai/opta-personality.ts` (or similar)
- Encode learned behaviors as:
  - System prompt templates
  - Response format rules
  - Contextual awareness logic
  - Few-shot examples from training data

### Phase 4: Integration
- Connect personality module to hybrid LLM router
- Local Llama 3 uses personality for routine queries
- Cloud Claude uses personality for complex reasoning
- Same "Opta" feel regardless of backend

## Key Behaviors to Port

| Behavior | Implementation Approach |
|----------|------------------------|
| Dual-mode output (thorough + TL;DR) | Response post-processor |
| Contextual awareness | Context analyzer before LLM call |
| Proactive clarification | Question detection + prompt injection |
| Idea generation | Template + examples in system prompt |
| Never miss details | Checklist validation on output |

## Dependencies

- Requires Phase 5 (Local LLM) and Phase 6 (Cloud LLM) to be complete
- Training data should have 20+ entries before porting
- User (Matthew) approval that behavior is "optimal"

## Success Criteria

The Opta app's AI should:
1. Feel like the same "Opta" personality as the Claude agent
2. Maintain quality across local/cloud backends
3. Apply all learned preferences automatically
4. Provide thorough + concise output by default

---

## Adaptive Learning Architecture

### What Opta Learns (All Local)

| Category | Data Captured | Purpose |
|----------|--------------|---------|
| **Hardware Profile** | CPU/GPU specs, RAM, storage, temps | Tailor recommendations to actual hardware |
| **Gaming Habits** | Games played, play times, session lengths | Optimize for actual usage patterns |
| **Optimization Preferences** | Accepted/rejected recommendations, manual tweaks | Learn user's risk tolerance and priorities |
| **Performance History** | Benchmark results over time, FPS patterns | Track improvement, detect regressions |
| **Interaction Style** | Detail level preferred, features used, questions asked | Adapt UI complexity to user |

### Privacy Guarantees

1. **Local-Only Storage**: All profile data in local SQLite/JSON, NEVER transmitted
2. **Full Transparency**: User can view everything stored (Transparency Panel)
3. **Complete Control**: User can edit/delete any learned data at any time
4. **No Cloud Learning**: Cloud LLM queries are anonymized via `anonymizer.py`
5. **Export/Import**: User owns their data, can migrate between devices

### Learning Pipeline

```
User Action → Pattern Detector → Local Profile Store → Recommendation Engine
                                        ↓
                              Privacy Anonymizer (for cloud queries)
```

### Storage Schema (Draft)

```json
{
  "hardware": {
    "cpu": { "model": "...", "cores": 8, "detected": "2026-01-15" },
    "gpu": { "model": "...", "vram": "8GB", "driver": "..." },
    "ram": "32GB",
    "storage": [{ "type": "SSD", "size": "1TB" }]
  },
  "preferences": {
    "riskTolerance": "medium",
    "priorityAxis": "fps-over-quality",
    "autoApprove": false,
    "detailLevel": "curious"
  },
  "history": {
    "optimizationsAccepted": 42,
    "optimizationsRejected": 3,
    "benchmarkResults": [...]
  },
  "games": {
    "mostPlayed": ["Cyberpunk 2077", "Elden Ring"],
    "totalOptimized": 5
  }
}
```

### Minimal Viable Adaptive Learning (Phase 8.1)

1. Store hardware profile automatically (from existing telemetry)
2. Track optimization acceptance/rejection with reasons
3. Adjust recommendation aggressiveness based on history
4. Transparency panel to view/edit/delete stored data

### Full Vision Adaptive Learning (Phase 10+)

1. Gaming habit analysis (when do they play, which games, session patterns)
2. Performance trend tracking over time with visualizations
3. Proactive recommendations based on detected patterns
4. User expertise level detection (adjust explanation depth automatically)
5. Cross-device profile sync (user-initiated, encrypted, optional)

### Connection to Agent Porting

The opta-optimizer Claude agent already:
- Reads `.personal/` context files (hardware, workflows, goals, profile)
- Logs corrections and preferences to training data
- Adapts behavior based on accumulated context

**Key insight**: The agent's context-reading pattern becomes the user profile schema. What works for training the agent becomes the foundation for how the app learns users.

| Agent Pattern | App Implementation |
|--------------|-------------------|
| `.personal/hardware.md` | `profile.hardware` in local storage |
| `.personal/goals.md` | `profile.preferences.priorities` |
| `opta-optimizer-training.md` | `profile.history.corrections` |
| Contextual awareness logic | Recommendation personalization engine |
