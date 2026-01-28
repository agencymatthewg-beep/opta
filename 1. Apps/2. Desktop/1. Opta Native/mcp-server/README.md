# Opta MCP Server

Python MCP server providing hardware telemetry for the Opta desktop application.

## Features

- CPU monitoring (usage, cores, frequency)
- Memory monitoring (total, used, available)
- Disk monitoring (total, used, free)
- GPU monitoring (with graceful fallback if no GPU)

## Installation

```bash
pip install -e .
```

For GPU monitoring support (NVIDIA):

```bash
pip install -e ".[gpu]"
```

## Usage

The server uses stdio transport for communication with the Tauri application:

```bash
opta-mcp
```

## MCP Tools

- `get_cpu` - Returns CPU telemetry
- `get_memory` - Returns RAM telemetry
- `get_disk` - Returns disk telemetry
- `get_gpu` - Returns GPU telemetry (graceful fallback if unavailable)
- `get_system_snapshot` - Returns all telemetry at once
