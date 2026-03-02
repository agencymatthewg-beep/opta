import sys

def update_cli():
    with open("1M-Opta-LMX/src/opta_lmx/main.py", "r") as f:
        content = f.read()

    old_parser = """    parser = argparse.ArgumentParser(
        prog="opta-lmx",
        description="Opta-LMX — Private AI inference engine for Apple Silicon",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to config.yaml (default: ~/.opta-lmx/config.yaml)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Override server host",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Override server port (default: 1234)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Override log level",
    )
    args = parser.parse_args()"""

    new_parser = """    parser = argparse.ArgumentParser(
        prog="opta-lmx",
        description="Opta-LMX — Private AI inference engine for Apple Silicon",
    )
    subparsers = parser.add_subparsers(dest="command")
    
    # Quantize Subcommand
    quantize_parser = subparsers.add_parser("quantize", help="Quantize a HuggingFace model for MLX")
    quantize_parser.add_argument("--model", type=str, required=True, help="HF repo ID or local path")
    quantize_parser.add_argument("--output", type=str, default=None, help="Output directory path")
    quantize_parser.add_argument("--bits", type=int, default=4, choices=[2, 4, 8], help="Quantization bits")
    quantize_parser.add_argument("--group-size", type=int, default=64, help="Quantization group size")
    quantize_parser.add_argument("--mode", type=str, default="affine", help="Quantization mode (affine, mxfp4, etc)")
    
    # Global args for default serve behavior
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Path to config.yaml (default: ~/.opta-lmx/config.yaml)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Override server host",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Override server port (default: 1234)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default=None,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Override log level",
    )
    
    args, unknown = parser.parse_known_args()
    
    if args.command == "quantize":
        import asyncio
        from opta_lmx.manager.quantize import _do_quantize
        # Run it synchronously since it's a CLI tool
        out_path = args.output
        if not out_path:
            safe_name = args.model.replace("/", "--")
            out_path = str(Path.home() / ".opta-lmx" / "quantized" / f"{safe_name}-{args.bits}bit")
        print(f"Starting quantization of {args.model} -> {out_path} ({args.bits}-bit)")
        try:
            size = _do_quantize(args.model, out_path, args.bits, args.group_size, args.mode)
            print(f"Quantization complete. Saved {size / 1024 / 1024 / 1024:.2f} GB to {out_path}")
        except Exception as e:
            print(f"Quantization failed: {e}", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)"""

    if old_parser in content:
        content = content.replace(old_parser, new_parser)
        with open("1M-Opta-LMX/src/opta_lmx/main.py", "w") as f:
            f.write(content)
        print("Replaced CLI successfully.")
    else:
        print("Failed to match old parser string.")

if __name__ == "__main__":
    update_cli()
