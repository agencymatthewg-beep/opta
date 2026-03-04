#!/usr/bin/env python3
"""
Opta-LMX Performance Matrix Runner

Runs a matrix of requests across different serving lanes, backends, and 
speculative configurations to generate a comparative performance report.
"""

import argparse
import asyncio
import json
import sys
import time
from typing import Any

import httpx

# Example prompts for the matrix
PROMPTS = {
    "short": "Explain what a binary search tree is in one sentence.",
    "code": "Write a fast python function to compute the 1000th fibonacci number.",
    "reasoning": "A farmer has 17 sheep. All but 9 die. How many are left? Think step by step.",
}

LANES = ["interactive", "throughput"]

async def run_prompt(client: httpx.AsyncClient, prompt: str, lane: str, max_tokens: int = 150) -> dict[str, Any]:
    start_time = time.perf_counter()
    headers = {"x-serving-lane": lane}
    try:
        resp = await client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "stream": False,
            },
            headers=headers,
            timeout=60.0
        )
        resp.raise_for_status()
        data = resp.json()
        end_time = time.perf_counter()
        
        usage = data.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        
        # Extract telemetry if the endpoint provides it in extra fields (like benchmark endpoints)
        # or we calculate basic tokens/sec
        total_time = end_time - start_time
        tok_sec = completion_tokens / total_time if total_time > 0 else 0
        
        # Get extended telemetry from choices if injected (Opta specific)
        telemetry = {}
        choices = data.get("choices", [])
        if choices and "telemetry" in choices[0].get("message", {}):
            telemetry = choices[0]["message"]["telemetry"]
        
        return {
            "ok": True,
            "lane": lane,
            "total_time_s": round(total_time, 3),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "tok_sec": round(tok_sec, 2),
            "telemetry": telemetry
        }
    except Exception as e:
        return {
            "ok": False,
            "lane": lane,
            "error": str(e)
        }

async def run_matrix(base_url: str, api_key: str):
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    results = []
    
    async with httpx.AsyncClient(base_url=base_url, headers=headers) as client:
        # Check health
        try:
            r = await client.get("/readyz")
            r.raise_for_status()
        except Exception:
            print(f"Error: Could not connect to {base_url}/readyz")
            sys.exit(1)
            
        print("Starting performance matrix run...")
        
        for name, prompt in PROMPTS.items():
            for lane in LANES:
                print(f"Running [{name}] prompt on lane [{lane}]...")
                res = await run_prompt(client, prompt, lane)
                res["prompt_type"] = name
                results.append(res)
                
                # Small pause between runs
                await asyncio.sleep(1)
                
    print("\n--- MATRIX RESULTS ---")
    print(json.dumps(results, indent=2))
    
    # Simple guardrails
    failed = [r for r in results if not r["ok"]]
    if failed:
        print(f"\nWARNING: {len(failed)} requests failed!")
        
    for r in results:
        if r["ok"] and r["tok_sec"] < 10.0:
            print(f"WARNING: Low throughput on {r['prompt_type']} / {r['lane']}: {r['tok_sec']} tok/s")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:1234", help="LMX Base URL")
    parser.add_argument("--key", default="", help="Inference API Key")
    args = parser.parse_args()
    
    asyncio.run(run_matrix(args.url, args.key))
