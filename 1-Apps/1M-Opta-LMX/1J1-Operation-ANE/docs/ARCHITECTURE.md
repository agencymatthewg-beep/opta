# Operation ANE — Technical Architecture

## Integration with Opta LMX

### New Files in LMX
```
src/opta_lmx/
├── inference/
│   └── coreml_backend.py      ← CoreML/ANE model loader + predictor
├── rag/
│   └── context_engine.py      ← ANE-powered context assembly pipeline
├── monitoring/
│   └── ane_monitor.py         ← ANE power/bandwidth/utilization stats
└── config.py                  ← Add context_engine + ane config sections
```

### Config Schema Addition
```yaml
context_engine:
  enabled: true
  backend: "coreml"            # "coreml" (ANE) or "mlx" (GPU fallback)
  models_dir: "~/.opta-lmx/ane-models/"
  
  fleet:
    intent:
      model: "opta-intent-v1.mlpackage"
      enabled: true
    router:
      model: "opta-router-v1.mlpackage"
      enabled: true
    embedding:
      model: "opta-embed-v1.mlpackage"
      enabled: true
      fallback: "mlx"          # Fall back to MLX if CoreML fails
    relevance:
      model: "opta-relevance-v1.mlpackage"
      enabled: true
    compress:
      model: "opta-compress-v1.mlpackage"
      enabled: false            # Optional, enable when trained
    urgency:
      model: "opta-urgency-v1.mlpackage"
      enabled: false

  indexer:
    enabled: true
    watch_paths:
      - "~/.openclaw/workspace/memory/"
      - "~/.openclaw/sessions/"
    refresh: "on_change"
    
  budget:
    max_context_tokens: 150000
    max_pipeline_latency_ms: 50
```

### Request Flow
```
POST /v1/chat/completions
  ↓
API Server receives request
  ↓
Context Engine (ANE):
  1. intent_model.predict(query)     → "coding"
  2. router_model.predict(query)     → [code, memory]
  3. embed_model.predict(query)      → query_vector
  4. FAISS search(query_vector)      → 50 candidates
  5. relevance_model.predict(pairs)  → ranked top 10
  6. compress_model.predict(chunks)  → compressed chunks
  7. Assemble final context window
  ↓
Inference Engine (GPU):
  messages = system_prompt + ane_context + user_messages
  generate(messages, stream=True)
  ↓
SSE Stream → Client
```

### Admin API Additions
```
GET  /admin/ane/status     — ANE power, bandwidth, model list
GET  /admin/ane/models     — Loaded CoreML models + stats
POST /admin/ane/reload     — Hot-swap models without restart
GET  /admin/context/stats  — Context engine metrics (latency, cache hits)
```

## Fallback Strategy

| Failure | Action |
|---------|--------|
| CoreML model won't load | Fall back to MLX equivalent |
| ANE unavailable | Run on CPU (slower but works) |
| Context engine timeout (>50ms) | Pass raw context to LLM |
| No trained custom model yet | Use generic HuggingFace model |
| All ANE models fail | Disable context engine, LMX works normally |
