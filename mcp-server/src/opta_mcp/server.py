"""MCP server for Opta hardware telemetry and process management."""

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
        Tool(
            name="get_processes",
            description="Get list of running processes with CPU/memory usage and categorization (system, user, safe-to-kill)",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="terminate_process",
            description="Terminate a process by PID. Uses graceful termination first, then force kill if needed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pid": {
                        "type": "integer",
                        "description": "Process ID to terminate",
                    },
                },
                "required": ["pid"],
            },
        ),
        Tool(
            name="stealth_mode",
            description="Execute Stealth Mode - terminate all safe-to-kill processes to free up system resources. Only kills processes categorized as 'safe-to-kill', never system or user processes.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="detect_conflicts",
            description="Detect competitor optimization tools (GeForce Experience, Razer Cortex, MSI Afterburner, OMEN Hub, etc.) that may conflict with Opta's optimizations.",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="llm_status",
            description="Check if Ollama LLM service is running and list available models",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="llm_chat",
            description="Send a chat message to local LLM (Ollama) for optimization advice",
            inputSchema={
                "type": "object",
                "properties": {
                    "messages": {
                        "type": "array",
                        "description": "Array of message objects with role and content",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {
                                    "type": "string",
                                    "enum": ["system", "user", "assistant"],
                                },
                                "content": {
                                    "type": "string",
                                },
                            },
                            "required": ["role", "content"],
                        },
                    },
                    "model": {
                        "type": "string",
                        "description": "Model to use (default: llama3:8b)",
                    },
                },
                "required": ["messages"],
            },
        ),
        Tool(
            name="llm_models",
            description="List available LLM models installed in Ollama",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="llm_chat_optimized",
            description="Send a chat message to local LLM with automatic system prompt and telemetry context. Simpler API - just send your message.",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "User message or question about PC optimization",
                    },
                    "model": {
                        "type": "string",
                        "description": "Model to use (default: llama3:8b)",
                    },
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="llm_quick_prompts",
            description="Get available quick prompt templates for common optimization questions",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="claude_status",
            description="Check if Claude API is configured and available for cloud AI queries",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="claude_chat",
            description="Send a chat message to Claude API for complex reasoning and optimization advice",
            inputSchema={
                "type": "object",
                "properties": {
                    "messages": {
                        "type": "array",
                        "description": "Array of message objects with role and content",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {
                                    "type": "string",
                                    "enum": ["user", "assistant"],
                                },
                                "content": {
                                    "type": "string",
                                },
                            },
                            "required": ["role", "content"],
                        },
                    },
                    "system_prompt": {
                        "type": "string",
                        "description": "Optional system prompt to guide Claude's behavior",
                    },
                },
                "required": ["messages"],
            },
        ),
        Tool(
            name="smart_chat",
            description="Smart chat with automatic routing between local Ollama and cloud Claude. Uses query complexity to choose the best backend - free local for simple queries, Claude for complex reasoning.",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "User message or question about PC optimization",
                    },
                    "prefer": {
                        "type": "string",
                        "enum": ["auto", "local", "cloud"],
                        "description": "Routing preference: auto (default) uses classifier, local forces Ollama, cloud forces Claude",
                    },
                    "model": {
                        "type": "string",
                        "description": "Model override for local backend (default: llama3:8b)",
                    },
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="routing_stats",
            description="Get routing statistics showing how many queries went to each backend (local vs cloud)",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls for telemetry and process data."""
    # Import modules here to avoid circular imports
    from opta_mcp import telemetry
    from opta_mcp import processes
    from opta_mcp import conflicts
    from opta_mcp import llm

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
    elif name == "get_processes":
        result = processes.get_process_list()
    elif name == "terminate_process":
        pid = arguments.get("pid")
        if pid is None:
            result = {"error": "Missing required parameter: pid"}
        else:
            result = processes.terminate_process(pid)
    elif name == "stealth_mode":
        result = processes.stealth_mode()
    elif name == "detect_conflicts":
        result = conflicts.get_conflict_summary()
    elif name == "llm_status":
        result = llm.check_ollama_status()
    elif name == "llm_chat":
        messages = arguments.get("messages", [])
        model = arguments.get("model", "llama3:8b")
        result = llm.chat_completion(messages, model)
    elif name == "llm_models":
        result = llm.get_available_models()
    elif name == "llm_chat_optimized":
        message = arguments.get("message", "")
        model = arguments.get("model", "llama3:8b")
        result = llm.chat_optimized(message, model)
    elif name == "llm_quick_prompts":
        from opta_mcp.prompts import get_quick_prompts
        result = get_quick_prompts()
    elif name == "claude_status":
        from opta_mcp import claude
        result = claude.check_claude_status()
    elif name == "claude_chat":
        from opta_mcp import claude
        messages = arguments.get("messages", [])
        system_prompt = arguments.get("system_prompt")
        result = claude.chat_completion(messages, system_prompt)
    elif name == "smart_chat":
        from opta_mcp import router
        message = arguments.get("message", "")
        prefer = arguments.get("prefer", "auto")
        model = arguments.get("model")
        result = router.smart_chat(message, prefer, model)
    elif name == "routing_stats":
        from opta_mcp import router
        result = router.get_routing_stats()
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
