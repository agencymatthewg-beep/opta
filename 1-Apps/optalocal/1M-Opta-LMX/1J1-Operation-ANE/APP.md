---
app: operation-ane
type: research-project + library
platforms: [macOS]
language: python, swift
status: research
version: 0
depends_on: [opta-lmx]
depended_on_by: [opta-local]
opis_version: 2.0
opis_mode: greenfield
---

# Operation ANE — APP.md

> Turn idle silicon into intelligent context.

## 1. Identity

| Field | Value |
|-------|-------|
| Name | Operation ANE |
| Type | Research Project + Python Library |
| Platform | macOS (Apple Silicon — M3 Ultra primary) |
| Language | Python (CoreML/coremltools), Swift (iOS) |
| Status | Research |
| Owner | Matthew Byrden / Opta Operations |
| Parent | Opta LMX (1J) |

## 2. Purpose

Builds a fleet of custom tiny ML models running exclusively on Apple's Neural Engine (ANE) for context management — embeddings, reranking, intent classification, relevance scoring, compression — freeing the GPU entirely for main LLM inference.

**Problem:** M3 Ultra's 32-core ANE sits at 0.0W while GPU handles everything.
**Solution:** Move all context intelligence to purpose-built ANE models (~120MB total, ~2W).

## 3. The ANE Model Fleet

| Model | Purpose | Params | Size | Latency |
|-------|---------|--------|------|---------|
| opta-embed-v1 | Vector embeddings for search | 20-50M | ~50MB | ~5ms |
| opta-router-v1 | Query → context source classifier | 5-10M | ~10MB | ~2ms |
| opta-relevance-v1 | (query, chunk) relevance scorer | 10-30M | ~30MB | ~5ms |
| opta-compress-v1 | Key sentence extraction | 10-20M | ~20MB | ~8ms |
| opta-intent-v1 | User intent classifier | 2-5M | ~5MB | ~2ms |
| opta-urgency-v1 | Message urgency scorer | 1-2M | ~2MB | ~1ms |

Total: ~120MB, ~1-3W, ~15-28ms full pipeline.

## 4. Architecture

```
User Message
  ↓
┌─ ANE Fleet (always-on, ~2W) ───────────────┐
│  intent → router → embed → relevance →      │
│  compress → assemble context                 │ ~15ms
└──────────────┬──────────────────────────────┘
               ↓ Curated context
┌─ GPU: Main LLM ────────────────────────────┐
│  Full 800 GB/s bandwidth, zero contention    │
└─────────────────────────────────────────────┘
```

## 5. Research Findings

See docs/RESEARCH.md for full analysis including:
- ANEMLL-bench community data (ANE bandwidth by chip)
- Apple ml-ane-transformers research (10x speedup for optimized models)
- M3 Ultra ANE status (unknown — needs benchmarking)
- CoreML Python API viability

## 6. Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Recon — ANEMLL-bench + first CoreML test | Not started |
| 1 | CoreML backend in LMX | Not started |
| 2 | Context engine MVP | Not started |
| 3 | Always-on indexer | Not started |
| 4 | Custom model fleet | Not started |
| 5 | Self-improving feedback loops | Not started |
| 6 | Opta Local iOS integration | Not started |

See .planning/ROADMAP.md for detailed phase plans.

---

*Created: 2026-02-19 by Opta512*
