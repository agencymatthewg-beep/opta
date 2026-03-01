# Opta CLI - macOS Profile

This folder is the macOS-labeled home for platform-specific guidance so macOS and Windows workflows stay clearly separated.

## Recommended Mode

- Provider: local LMX primary, Anthropic fallback
- Local model host: Apple Silicon / MLX stack supported
- Shell runtime: POSIX (`sh`, `bash`, `zsh`)

## Current Support Summary

- Works: full CLI workflow including `opta serve`, `opta update`, remote Studio sync paths, daemon, TUI, LSP, browser runtime tooling

## Quick Setup

```bash
opta config set provider.active lmx
opta serve start
opta status
opta chat
```

## Notes

- macOS is the canonical platform for local Opta LMX operations.
- Use this profile whenever local model lifecycle management is required.
