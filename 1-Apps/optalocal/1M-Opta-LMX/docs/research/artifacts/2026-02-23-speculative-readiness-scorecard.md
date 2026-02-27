# Speculative Decoding Readiness Scorecard (Live)

- Date (UTC): `2026-02-23T02:33:38.184811+00:00`
- Model: `mlx-community/Qwen2.5-0.5B-Instruct-4bit`
- Draft model: `mlx-community/Qwen2.5-0.5B-Instruct-4bit`
- vllm-mlx: `0.2.6`
- mlx-lm: `0.30.7`
- Total run duration: `6.74s`

## Verdict
- Readiness score: **45/100**
- Verdict: **NOT READY (speculative blocked by backend capability mismatch)**

## Scenario Results
### interactive_spec_off
- status: `ok`
- load_time_sec: `1.833`
- short prompt: ttft_avg `72.41ms`, tps_avg `356.42`, spec `{'accepted_tokens': 0, 'rejected_tokens': 0, 'ignored_tokens': 0, 'acceptance_ratio': None, 'telemetry_modes': ['not_requested']}`
- long prompt: ttft_avg `85.12ms`, tps_avg `354.73`, spec `{'accepted_tokens': 0, 'rejected_tokens': 0, 'ignored_tokens': 0, 'acceptance_ratio': None, 'telemetry_modes': ['not_requested']}`
- parallel c=1: agg_tps `326.08`, ttft_p95 `72.96ms`, errors `0`
- parallel c=2: agg_tps `334.72`, ttft_p95 `68.93ms`, errors `0`

### interactive_spec_on
- status: `failed`
- error: `Failed to load model mlx-community/Qwen2.5-0.5B-Instruct-4bit: Speculative decoding requested but SimpleEngine does not support required constructor kwargs in this vllm-mlx version: ['speculative_model', 'num_speculative_tokens']. Disable speculative settings or update vllm-mlx.`

### throughput_spec_off
- status: `ok`
- load_time_sec: `0.354`
- short prompt: ttft_avg `13.05ms`, tps_avg `441.64`, spec `{'accepted_tokens': 0, 'rejected_tokens': 0, 'ignored_tokens': 0, 'acceptance_ratio': None, 'telemetry_modes': ['not_requested']}`
- long prompt: ttft_avg `12.30ms`, tps_avg `458.82`, spec `{'accepted_tokens': 0, 'rejected_tokens': 0, 'ignored_tokens': 0, 'acceptance_ratio': None, 'telemetry_modes': ['not_requested']}`
- parallel c=1: agg_tps `451.43`, ttft_p95 `10.21ms`, errors `0`
- parallel c=4: agg_tps `600.33`, ttft_p95 `228.43ms`, errors `0`

### throughput_spec_on
- status: `failed`
- error: `Failed to load model mlx-community/Qwen2.5-0.5B-Instruct-4bit: Speculative decoding requested but BatchedEngine does not support required constructor kwargs in this vllm-mlx version: ['speculative_model', 'num_speculative_tokens']. Disable speculative settings or update vllm-mlx.`

## Required Next Steps
1. Upgrade or fork `vllm-mlx` to expose speculative decoding hooks/counters in active constructor or runtime call path.
2. Re-run this same matrix with speculative enabled and acceptance telemetry non-zero.
3. Gate rollout on acceptance ratio + TTFT/tps improvement thresholds.
