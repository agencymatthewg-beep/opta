# Opta LMX

Private AI inference engine for Apple Silicon — MLX-native, OpenAI-compatible.

Opta LMX serves local MLX models via an OpenAI-compatible API on port 1234 (drop-in LM Studio replacement). Designed for Mac Studio / MacBook Pro with Apple Silicon.

## Requirements

- macOS 14+ on Apple Silicon (M1/M2/M3/M4)
- Python 3.12+

## Install

```bash
pip install opta-lmx
```

## Quick Start

```bash
# 1. Copy the config template
mkdir -p ~/.opta-lmx
# (from the repo) cp config/config.yaml.template ~/.opta-lmx/config.yaml
# Or create from scratch — see config/default-config.yaml for all options

# 2. Start the server
opta-lmx

# 3. Load a model (in another terminal or via Opta CLI)
opta-lmx load mlx-community/Llama-3.2-3B-Instruct-4bit

# 4. Chat (OpenAI-compatible API at localhost:1234)
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mlx-community/Llama-3.2-3B-Instruct-4bit","messages":[{"role":"user","content":"Hello"}]}'
```

## Configuration

Copy `config/config.yaml.template` to `~/.opta-lmx/config.yaml` and customize.
Environment variables override config values with the `LMX_` prefix:

```bash
LMX_SERVER__PORT=8080 opta-lmx          # Override port
LMX_MODELS__DEFAULT_MODEL=mlx-community/... opta-lmx
```

## Models

Opta LMX loads MLX-format models from HuggingFace. Download models first:

```bash
pip install huggingface-hub
huggingface-cli download mlx-community/Llama-3.2-3B-Instruct-4bit
```

Recommended models:
- `mlx-community/Llama-3.2-3B-Instruct-4bit` — fast, 2GB RAM
- `mlx-community/Llama-3.3-70B-Instruct-4bit` — quality, ~40GB RAM
- `mlx-community/Kimi-K2.5-3bit` — best quality, ~260GB RAM (requires 512GB Mac)

## Used With

Pairs with [Opta CLI](https://github.com/optaops/opta-cli) for an end-to-end local AI coding assistant.

## License

MIT
