# Operation ANE — Roadmap

## Phase 0: Reconnaissance (1 day)
- [ ] Install ANEMLL-bench on Mono512
- [ ] Run benchmark — first M3 Ultra result in community database
- [ ] Convert `all-MiniLM-L6-v2` to CoreML
- [ ] Verify it runs on ANE (not CPU/GPU fallback)
- [ ] Document actual M3 Ultra ANE bandwidth

## Phase 1: CoreML Backend in LMX (3-5 days)
- [ ] Create `coreml_backend.py` in LMX inference module
- [ ] Modify `embedding_engine.py` — add CoreML backend option
- [ ] Config: `embedding_backend: "coreml" | "mlx"` in YAML
- [ ] Test `/v1/embeddings` endpoint with CoreML backend
- [ ] Benchmark: CoreML/ANE vs MLX embedding speed

## Phase 2: Context Engine MVP (1 week)
- [ ] Create `context_engine.py` — query embed + chunk score + rank
- [ ] Wire into `/v1/chat/completions` pre-processing
- [ ] Add `/admin/ane/status` endpoint
- [ ] Test end-to-end: query → ANE context → GPU generation

## Phase 3: Always-On Indexer (1 week)
- [ ] Background file watcher for configured paths
- [ ] Pre-embed on ANE as files change
- [ ] Persistent vector index
- [ ] Config: watched paths, refresh strategy

## Phase 4: Custom Model Fleet (2-4 weeks)
- [ ] Build opta-intent-v1 (query classifier, simplest)
- [ ] Build opta-embed-v1 (custom embedder, most impactful)
- [ ] Build opta-relevance-v1 (reranker)
- [ ] Build opta-router-v1 (context source selector)
- [ ] Build opta-compress-v1 (key sentence extractor)
- [ ] Build opta-urgency-v1 (message urgency scorer)
- [ ] Training data collection pipeline
- [ ] CoreML conversion + deployment pipeline

## Phase 5: Self-Improving Feedback Loops (2 weeks)
- [ ] Log (query, context, response) triples
- [ ] Analyze which context was actually referenced
- [ ] Auto-retrain relevance model on feedback data
- [ ] Hot-swap retrained models on ANE

## Phase 6: Opta Local iOS Integration (2 weeks)
- [ ] Native CoreML Whisper for voice input
- [ ] Local embeddings for offline chat search
- [ ] Small on-device model for offline mode
- [ ] ANE status in iOS dashboard

---

*Created: 2026-02-19*
