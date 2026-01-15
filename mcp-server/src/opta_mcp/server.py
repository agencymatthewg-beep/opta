"""MCP server for Opta hardware telemetry."""

import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Create MCP server instance
server = Server("opta-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available telemetry tools."""
    return [
        Tool(
            name="get_cpu",
            description="Get CPU telemetry including usage, cores, and frequency",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_memory",
            description="Get memory (RAM) telemetry including total, used, and available",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_disk",
            description="Get disk telemetry including total, used, and free space",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_gpu",
            description="Get GPU telemetry if available, with graceful fallback",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_system_snapshot",
            description="Get complete system telemetry snapshot (CPU, memory, disk, GPU)",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls for telemetry data."""
    # Import telemetry module here to avoid circular imports
    from opta_mcp import telemetry

    if name == "get_cpu":
        result = telemetry.get_cpu_info()
    elif name == "get_memory":
        result = telemetry.get_memory_info()
    elif name == "get_disk":
        result = telemetry.get_disk_info()
    elif name == "get_gpu":
        result = telemetry.get_gpu_info()
    elif name == "get_system_snapshot":
        result = telemetry.get_system_snapshot()
    else:
        result = {"error": f"Unknown tool: {name}"}

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


def main():
    """Run the MCP server with stdio transport."""
    asyncio.run(run_server())


async def run_server():
    """Async entry point for the server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    main()
