# Phase 41.1: Knowledge Architecture System

**Status:** In Progress
**Priority:** High
**Dependencies:** Phase 41 (Knowledge Research Foundation)

---

## Overview

Implements Opta's 5-tier knowledge hierarchy system for storing, retrieving, and verifying optimization intelligence. This creates the foundation for Opta's "brain" - structured data that can be accessed programmatically with appropriate confidence levels.

---

## Knowledge Tier System

| Tier | Name | Stability | Verification | Location |
|------|------|-----------|--------------|----------|
| **T1** | Physics/Math | Immutable | Never | `t1-physics/` |
| **T2** | Architecture | Decade-stable | Rare | `t2-architecture/` |
| **T3** | Hardware Specs | Generation-stable | Per-release | `t3-specs/` |
| **T4** | Benchmarks | Year-stable | Quarterly | `t4-benchmarks/` |
| **T5** | Rankings/Trends | Month-stable | On-access | `t5-dynamic/` |

---

## Directory Structure

```
.planning/research/
├── archive/                    # Processed Gemini reports
├── knowledge/
│   ├── schema/
│   │   └── knowledge-schema.json
│   ├── t1-physics/
│   │   └── fundamentals.json
│   ├── t2-architecture/
│   │   └── apple-silicon.json
│   ├── t3-specs/
│   │   └── m-series.json
│   ├── t4-benchmarks/
│   │   └── game-performance.json
│   └── t5-dynamic/
│       └── recommendations.json
├── prompts/                    # Gemini research prompts
└── templates/                  # Knowledge extraction templates
```

---

## Implementation Tasks

### Completed
- [x] Create directory structure
- [x] Create JSON schema (`knowledge-schema.json`)
- [x] Create T1 physics fundamentals
- [x] Create T2 Apple Silicon architecture base
- [x] Create T3 M-series specifications
- [x] Create T4 benchmark data structure
- [x] Create T5 dynamic recommendations structure

### In Progress
- [ ] Process HIGH priority Gemini reports
- [ ] Extract and categorize knowledge by tier
- [ ] Archive processed reports

### Pending
- [ ] Create extraction methodology guide
- [ ] Update ROADMAP.md
- [ ] Update STATE.md

---

## Verification Strategy

### Tiers 1-3 (Static)
- No runtime verification needed
- Update manually when new hardware releases
- Flag entries for review when Apple announces new chips

### Tier 4 (Benchmarks)
- Quarterly verification cycle
- LLM verification query: "Is this benchmark data still representative of current performance?"
- Mark stale entries for re-testing

### Tier 5 (Dynamic)
- On-access verification via Cloud LLM
- Cache verified results for 24-48 hours
- Always include recency disclaimer in Opta's recommendations

---

## Access Patterns

### For Opta App
1. Load T1-T3 into memory at startup (static, cacheable)
2. Query T4 with staleness check (warn if > 90 days old)
3. Query T5 with live LLM verification

### For Development
- JSON files directly readable/editable
- Schema validation on commit (optional CI)
- Extract templates for adding new knowledge

---

## Success Criteria

1. All 5 tier directories populated with initial knowledge
2. Schema validates all knowledge files
3. 9 Gemini reports processed and archived
4. Clear extraction methodology documented
5. Access patterns defined for app integration

---

## Next Phase

Phase 42: Hardware Synergy Database - Uses this knowledge architecture to build the actual performance calculation models.
