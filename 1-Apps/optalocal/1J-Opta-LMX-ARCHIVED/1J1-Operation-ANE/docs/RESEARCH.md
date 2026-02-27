# Operation ANE — Research Findings

*Compiled: 2026-02-19 from extensive web research and codebase analysis*

---

## 1. ANE Hardware Performance

### ANEMLL-Bench Community Data

| Chip | ANE Bandwidth (GB/s) | Inference Time (ms) | vs M1 |
|------|----------------------|--------------------:|-------|
| M1 | 60.87 | 7.52 | 1.0x |
| M1 Pro | 54.90 | 7.45 | 1.0x |
| M1 Max | 54.62 | 7.61 | 1.0x |
| M1 Ultra | 54.72 | 7.58 | **1.0x (no scaling)** |
| M2 | 60.45 | 8.67 | 0.9x |
| M2 Max | 62.01 | 6.64 | 1.1x |
| M2 Ultra | 61.68 | 6.70 | **1.1x (no scaling over Max)** |
| M3 | 63.10 | 6.95 | 1.1x |
| M3 Max | 120.22 | 3.98 | **2.0x (major jump)** |
| **M3 Ultra** | **UNKNOWN** | **UNKNOWN** | **Needs benchmarking** |
| M4 | 64.18 | 6.45 | 1.2x |
| M4 Pro | 126.36 | 3.85 | 2.0x |
| M4 Max | 118.88 | 3.87 | 2.0x |

**Key finding:** Ultra chips show ZERO ANE scaling over Max counterparts (M1, M2). M3 generation was a 2x jump. M3 Ultra is untested — we could be first.

### ANE vs GPU Memory Bandwidth

| Silicon | ANE Bandwidth | GPU Bandwidth | Ratio |
|---------|--------------|---------------|-------|
| M3 Max | ~120 GB/s | ~400 GB/s | 3.3x GPU |
| M3 Ultra (est.) | ~120 GB/s | ~800 GB/s | 6.7x GPU |

LLM inference is memory-bandwidth bound → GPU always wins for large models. ANE wins for small concurrent workloads.

---

## 2. Apple's Research (ml-ane-transformers)

**Source:** https://github.com/apple/ml-ane-transformers

### Results (DistilBERT, 66M params)
- Up to **10x faster** on ANE vs baseline
- **14x lower peak memory** consumption
- Tested on iPhone 13 (A15), applicable to M-series

### Required Optimizations for ANE
1. **Channels-first 4D format:** (B, C, 1, S) not (B, S, C)
2. **Conv2d instead of Linear:** ANE optimized for convolutions
3. **Split multi-head attention:** Explicit list of single-head ops
4. **No reshapes/transposes:** Memory copies kill ANE performance
5. **Last axis alignment:** Must be contiguous, aligned to 64 bytes
6. **Embedding lookups on CPU:** 4 of 606 ops fell back to CPU (expected)

### Implications for Custom Models
Building models ANE-first means following these patterns from architecture design, not converting afterward. Our custom models should use Conv1d/Conv2d throughout.

---

## 3. ANEMLL Project Assessment

**Source:** https://github.com/anemll/anemll (v0.3.5 Beta)

### What They've Achieved
- Full LLM inference on ANE: LLaMA (1B, 8B), Qwen (0.5B, 1.7B), Gemma 3 (270M, 1B, 4B)
- iOS/macOS/visionOS reference app on TestFlight
- Conversion pipeline from HuggingFace → CoreML
- ANE Profiler tool (no Xcode needed)
- Benchmark quality comparable to HuggingFace FP16 (within ±1%)

### Limitations They've Hit
- **No block quantization on ANE** — LUT4 quality is "fairly low"
- **FP16 overflow** — bfloat16 models need scaling hacks for ANE's FP16
- **KV-cache workarounds** — Manual ping-pong/ring buffers, race conditions on iOS
- **Context limited to ~4K** — 512-2048 recommended for optimal ANE performance
- **Multi-turn re-runs prefill** — No persistent KV-cache like MLX
- **M1/A14 limitations** — Older ANE can't handle non-uniform state shapes

### Relevant Tools for Us
- **ANEMLL-bench:** Benchmark our M3 Ultra (first submission!)
- **ANE Profiler:** Test if our models actually run on ANE
- **Conversion pipeline:** Reference for CoreML conversion patterns

---

## 4. CoreML from Python (No Swift Needed)

### Python API for CoreML Prediction
```python
import coremltools as ct

# Load model
model = ct.models.MLModel("model.mlpackage")

# Run prediction (automatically uses ANE if model is compatible)
result = model.predict({"input": data})
```

### Controlling Compute Unit Placement
```python
# Force ANE + CPU only (no GPU)
model = ct.models.MLModel("model.mlpackage",
    compute_units=ct.ComputeUnit.CPU_AND_NE)

# All available units (ANE preferred)
model = ct.models.MLModel("model.mlpackage",
    compute_units=ct.ComputeUnit.ALL)
```

### Conversion Pipeline
```python
import torch
import coremltools as ct

# 1. Define PyTorch model (ANE-optimized architecture)
# 2. Train
# 3. Trace
traced = torch.jit.trace(model, sample_input)

# 4. Convert
mlmodel = ct.convert(traced,
    convert_to="mlprogram",
    inputs=[ct.TensorType("input", shape=input_shape)],
    compute_units=ct.ComputeUnit.ALL)

# 5. Save
mlmodel.save("model.mlpackage")
```

### Verification: Is it Running on ANE?
- Use `asitop` CLI tool — shows ANE power draw in real-time
- Use `powermetrics --samplers npu_power` — direct ANE telemetry
- ANEMLL ANE Profiler — CoreML compute plan analysis

---

## 5. Custom Model Architecture for ANE

### Template: ANE-Native Classifier
```python
class ANEClassifier(nn.Module):
    """ANE-optimized: channels-first, Conv1d, no reshapes"""
    def __init__(self, vocab_size, embed_dim, hidden, num_classes):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.conv1 = nn.Conv1d(embed_dim, hidden, 3, padding=1)
        self.conv2 = nn.Conv1d(hidden, hidden, 3, padding=1)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Conv1d(hidden, num_classes, 1)  # Conv1d not Linear!
    
    def forward(self, x):
        x = self.embed(x).transpose(1, 2)  # → (B, C, S) channels-first
        x = torch.relu(self.conv1(x))
        x = torch.relu(self.conv2(x))
        x = self.pool(x)
        return self.fc(x).squeeze(-1)
```

### Template: ANE-Native Embedding Model
```python
class ANEEmbedder(nn.Module):
    """ANE-optimized sentence embedder"""
    def __init__(self, vocab_size, embed_dim=256, hidden=512, out_dim=384):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.encoder = nn.Sequential(
            nn.Conv1d(embed_dim, hidden, 3, padding=1),
            nn.ReLU(),
            nn.Conv1d(hidden, hidden, 3, padding=1),
            nn.ReLU(),
            nn.Conv1d(hidden, hidden, 5, padding=2),
            nn.ReLU(),
        )
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.project = nn.Conv1d(hidden, out_dim, 1)
    
    def forward(self, x):
        x = self.embed(x).transpose(1, 2)
        x = self.encoder(x)
        x = self.pool(x)
        x = self.project(x)
        return nn.functional.normalize(x.squeeze(-1), dim=-1)
```

---

## 6. Self-Improving Feedback Loop Design

### Concept
1. ANE context engine selects context chunks for main LLM
2. Main LLM generates response
3. Analyzer checks: which chunks were actually referenced in the response?
4. Referenced chunks → positive training signal for relevance model
5. Ignored chunks → negative training signal
6. Periodically retrain relevance model (GPU, overnight, minutes)
7. Convert to CoreML, hot-swap on ANE

### Data Collection
- Log all (query, selected_chunks, response) triples
- Use simple heuristic: chunk text appears in response → referenced
- Build training dataset over days/weeks
- Retrain weekly or when accuracy drops

---

## 7. Risks & Unknowns

| Risk | Severity | Mitigation |
|------|----------|------------|
| M3 Ultra ANE doesn't scale over M3 Max | Medium | Still viable for small models at 120 GB/s |
| CoreML conversion fails for custom architectures | Medium | Follow ANE-native patterns from design phase |
| Multiple concurrent CoreML models cause contention | Medium | Test with 2, then 4, then 6 models |
| FP16 precision insufficient for embeddings | Low | Embeddings work well in FP16 |
| Python CoreML prediction overhead too high | Low | ANEMLL proves Python→ANE works |
| Training data insufficient for custom models | Medium | Start with fine-tuning existing models |

---

*Next step: Phase 0 — Run ANEMLL-bench on M3 Ultra, convert first model to CoreML*
