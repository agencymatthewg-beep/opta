# Opta CLI - Windows Profile

This folder is the Windows-labeled home for platform-specific guidance so Windows and macOS workflows do not get mixed.

## Recommended Mode

- Provider: Anthropic (cloud)
- Local model host: not required
- Shell runtime: `cmd.exe` / PowerShell

## Current Support Summary

- Works: `opta chat`, `opta tui`, daemon, file tools, `run_command`, LSP, key copy/show/create (with `--no-remote`)
- Not supported locally on Windows: `opta serve`, `opta update` (POSIX-only operations)

## Quick Setup

```powershell
opta config set provider.active anthropic
opta config set connection.host localhost
opta config set connection.port 1234
opta chat
```

## Notes

- If you need LMX management commands, run them from a macOS/Linux machine.
- If your goal is coding-agent use only (no local model runtime), Windows can provide near-full CLI functionality.
