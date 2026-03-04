import argparse
import asyncio
import sys

from opta_lmx.main import create_app

app = create_app()

async def _run_quantize(
    model: str, 
    output: str | None, 
    bits: int, 
    group_size: int, 
    mode: str
) -> None:
    """Execute quantization in the foreground, tailing logs to stdout."""
    from opta_lmx.manager.quantize import start_quantize, get_job
    from opta_lmx.monitoring.events import EventBus
    
    print(f"Starting quantization for: {model}")
    print(f"Config: {bits}-bit {mode}, group size {group_size}")
    
    bus = EventBus()
    job = await start_quantize(
        source_model=model,
        output_path=output,
        bits=bits,
        group_size=group_size,
        mode=mode,
        event_bus=bus,
    )
    
    print(f"Job ID: {job.id}")
    print(f"Output path: {job.output_path}")
    print("-" * 50)
    
    # We poll the job status and read the underlying log file
    # This prevents us from needing to subscribe to SSE locally
    import os
    import time
    
    log_file = job.log_path
    last_pos = 0
    
    while True:
        current_job = await get_job(job.id)
        if not current_job:
            print("\nError: Job vanished.")
            sys.exit(1)
            
        if os.path.exists(log_file):
            with open(log_file, "r") as f:
                f.seek(last_pos)
                new_logs = f.read()
                if new_logs:
                    sys.stdout.write(new_logs)
                    sys.stdout.flush()
                last_pos = f.tell()
                
        if current_job.status in {"completed", "failed", "cancelled"}:
            print("\n" + "-" * 50)
            print(f"Status: {current_job.status.upper()}")
            if current_job.error:
                print(f"Error: {current_job.error}")
            sys.exit(0 if current_job.status == "completed" else 1)
            
        await asyncio.sleep(0.5)

def _main() -> None:
    parser = argparse.ArgumentParser(
        description="Opta LMX - Local Model Inference Server & Utilities"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Quantize command
    q_parser = subparsers.add_parser("quantize", help="Quantize a HuggingFace model for MLX")
    q_parser.add_argument("--model", required=True, help="HuggingFace repo ID or local path")
    q_parser.add_argument("--output", help="Output path (auto-generated if omitted)")
    q_parser.add_argument("--bits", type=int, default=4, help="Quantization bits (default 4)")
    q_parser.add_argument("--group-size", type=int, default=64, help="Quantization group size (default 64)")
    q_parser.add_argument(
        "--mode", 
        default="affine", 
        choices=["affine", "mxfp4", "mxfp8", "nvfp4"], 
        help="Quantization mode (default affine)"
    )
    
    args, unknown = parser.parse_known_args()
    
    if args.command == "quantize":
        try:
            asyncio.run(_run_quantize(
                model=args.model,
                output=args.output,
                bits=args.bits,
                group_size=args.group_size,
                mode=args.mode,
            ))
        except KeyboardInterrupt:
            print("\nOperation cancelled by user.")
            sys.exit(130)
    else:
        # If no custom command is passed, assume uvicorn wants to run this file
        # This preserves backwards compatibility with `uvicorn run:app`
        pass

if __name__ == "__main__":
    _main()
