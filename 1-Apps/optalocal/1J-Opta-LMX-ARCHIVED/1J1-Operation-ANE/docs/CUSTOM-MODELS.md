# Operation ANE — Custom Model Specifications

## Model Fleet Overview

All models designed ANE-first: channels-first tensors, Conv1d/Conv2d, no reshapes.

---

### opta-intent-v1 — Intent Classifier
**Purpose:** Classify user query into intent category
**Output:** code | chat | search | task | question | command
**Params:** 2-5M | **Size:** ~5MB | **Latency:** ~2ms
**Training:** Chat history with labeled intents
**Architecture:** Embedding → Conv1d×2 → Pool → Conv1d classifier

### opta-router-v1 — Context Source Router  
**Purpose:** Given intent, select which context sources to query
**Output:** Bitmask of sources [memory, code, calendar, email, recent_chat, tools]
**Params:** 5-10M | **Size:** ~10MB | **Latency:** ~2ms
**Training:** (intent, query) → source selections from our history
**Architecture:** Dual-input Conv1d encoder → multi-label classifier

### opta-embed-v1 — Custom Embedding Model
**Purpose:** Embed queries and chunks into vector space for similarity search
**Output:** 384-dim normalized vector
**Params:** 20-50M | **Size:** ~50MB | **Latency:** ~5ms
**Training:** Fine-tune from all-MiniLM-L6-v2 on our data (memory, code, sessions)
**Architecture:** Embedding → Conv1d×6 → Pool → Project → L2 normalize

### opta-relevance-v1 — Relevance Scorer
**Purpose:** Score (query, chunk) pair for relevance
**Output:** Float 0.0-1.0
**Params:** 10-30M | **Size:** ~30MB | **Latency:** ~5ms
**Training:** Labeled pairs from LLM feedback loop (which chunks were referenced)
**Architecture:** Cross-encoder: concat(query_embed, chunk_embed) → Conv1d → score

### opta-compress-v1 — Context Compressor
**Purpose:** Extract key sentences from verbose context chunks
**Output:** Sentence importance scores
**Params:** 10-20M | **Size:** ~20MB | **Latency:** ~8ms
**Training:** Documents with human-highlighted key sentences
**Architecture:** Per-sentence Conv1d encoder → importance classifier

### opta-urgency-v1 — Urgency Scorer
**Purpose:** Score incoming message urgency for prioritization
**Output:** Float 0.0-1.0
**Params:** 1-2M | **Size:** ~2MB | **Latency:** ~1ms
**Training:** Our messages labeled by urgency (time-sensitive vs routine)
**Architecture:** Embedding → Conv1d → Pool → sigmoid

---

## Training Pipeline

```
1. Collect data (automated from session logs)
2. Label (heuristic + manual review)
3. Train (PyTorch, minutes on GPU)
4. Validate (accuracy, F1 on held-out set)
5. Convert (coremltools → .mlpackage)
6. Verify ANE placement (asitop / powermetrics)
7. Deploy to LMX config directory
8. Hot-swap via /admin/ane/reload
```

## Retraining Schedule
- **opta-relevance-v1:** Weekly (feedback loop data)
- **opta-embed-v1:** Monthly (when data distribution shifts)
- **Others:** As needed (stable tasks, infrequent retraining)
