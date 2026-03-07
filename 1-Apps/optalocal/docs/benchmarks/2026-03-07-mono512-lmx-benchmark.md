# Opta LMX Benchmark — Mono512

**Date:** 2026-03-07 19:25 AEDT  
**Hardware:** Mac Studio M3 Ultra (512GB Unified Memory)  
**Model:** MiniMax M2.5 4-bit (`mlx-community/MiniMax-M2.5-4bit`)  
**Server:** Opta LMX (Python, port 1234)  
**Client:** SSH from MacBook Pro M4 Max → Mono512 (LAN)

## Results

| Test | Prompt Tokens | Completion Tokens | Wall Time | Speed (tok/s) |
|------|--------------|-------------------|-----------|---------------|
| Simple math | 8 | 10 | 2,589ms | 3.9 |
| Medium reasoning | 18 | 300 | 6,555ms | 45.8 |
| Code generation | 13 | 400 | 8,706ms | 45.9 |
| Long output | 22 | 500 | 10,700ms | 46.7 |
| Translation | 17 | 100 | 2,575ms | 38.8 |

## Analysis

- **Sustained throughput:** ~46 tok/s for medium-to-long outputs
- **Short prompt overhead:** ~2.5s (includes SSH round-trip + model warm-up)
- **Memory utilization:** 23.6% of 512GB (~120GB) — model fits comfortably with room for larger models
- **Consistency:** Very stable throughput across different task types

## Notes

- Wall time includes SSH round-trip latency (LAN, ~1-2ms)
- First-token latency is higher for short outputs due to fixed overhead
- MiniMax M2.5 4-bit is the auto-loaded default model
- Embedding model (BAAI/bge-base-en-v1.5) also loaded but not benchmarked here
