# Research Gaps - Ready for Gemini Deep Research

**Status**: 5 tabs ready | Generated: 2025-01-18

---

## How to Use These Tabs

For each tab:
1. Paste `GEMINI_CONTEXT.md` first (establishes Opta context)
2. Paste the domain-specific prompt (GPU, CPU, Memory, Thermal, or Storage)
3. Click "Start Research"

The prompts have been updated with "Already Established" sections to prevent duplicate research.

---

## Priority Research Gaps by Domain

### Tab 1: GPU Deep Dive (HIGH PRIORITY)
**Prompt**: `prompts/41-01-gpu-architecture.md`

| Gap | Why It Matters | Data Format Needed |
|-----|----------------|-------------------|
| Tile sizes by generation | Explains TBDR behavior differences | Table: M1/M2/M3/M4 tile dimensions |
| Settings impact tables | Core optimization lever | Table: Setting level → FPS cost % |
| Ray tracing overhead (M3+) | RT decisions | % performance penalty by scene |
| GPU bottleneck thresholds | Optimization triggers | Load % where FPS drops significantly |

---

### Tab 2: Thermal Timing (HIGH PRIORITY)
**Prompt**: `prompts/41-04-thermal-management.md`

| Gap | Why It Matters | Data Format Needed |
|-----|----------------|-------------------|
| Throttle timing by form factor | Gaming session planning | Table: Device → Minutes to throttle |
| Throttled performance % | User expectations | % of peak sustained when throttled |
| Recovery timing | Workload management | Seconds/minutes to full recovery |
| Ambient temperature impact | Environment advice | Table: Ambient temp → Performance delta |

---

### Tab 3: Memory Pressure Curves (MEDIUM PRIORITY)
**Prompt**: `prompts/41-03-memory-architecture.md`

| Gap | Why It Matters | Data Format Needed |
|-----|----------------|-------------------|
| Pressure → FPS curves | Warning thresholds | Graph/table: Utilization % → FPS % |
| VRAM equivalence | Recommendation accuracy | Formula: Unified GB → Effective VRAM |
| 8GB/16GB game compatibility | Configuration advice | Table: Game → Min unified memory |

---

### Tab 4: CPU Scheduling (MEDIUM PRIORITY)
**Prompt**: `prompts/41-02-cpu-architecture.md`

| Gap | Why It Matters | Data Format Needed |
|-----|----------------|-------------------|
| QoS → Core mapping | Process tuning | Table: QoS class → Core type |
| Rosetta 2 overhead | x86 game expectations | % overhead range |
| CPU-limited games list | Bottleneck identification | List with thread counts |

---

### Tab 5: Storage Performance (LOWER PRIORITY)
**Prompt**: `prompts/41-05-storage-optimization.md`

| Gap | Why It Matters | Data Format Needed |
|-----|----------------|-------------------|
| 256GB vs 1TB speeds | Purchase advice | Table: Capacity → Read/Write MB/s |
| External storage viability | Game library management | TB4 vs USB-C gaming performance |
| Loading time formulas | User expectations | Formula: Size + speed → load time |

---

## Research Output Integration

When you get research results:

1. **T2 Architecture Facts** → Add to `.planning/research/knowledge/t2-architecture/`
2. **T3 Specs** → Add to `.planning/research/knowledge/t3-specs/`
3. **T4 Benchmarks** → Add to `.planning/research/knowledge/t4-benchmarks/`
4. **T5 Recommendations** → Add to `.planning/research/knowledge/t5-dynamic/`

Use the format from `EXTRACTION_GUIDE.md` for JSON entries.

---

## Quick Start Commands

```bash
# View prompts directory
ls .planning/research/prompts/

# Copy context to clipboard (macOS)
cat .planning/research/GEMINI_CONTEXT.md | pbcopy

# After research, archive the report
cp ~/Downloads/gemini-report.md .planning/research/archive/gemini-2025-01-{topic}.md
```
