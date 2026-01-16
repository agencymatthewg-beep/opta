"""MCP server for Opta hardware telemetry and process management."""

import asyncio
import json
from dataclasses import asdict
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
        Tool(
            name="detect_games",
            description="Detect installed games across all supported launchers (Steam, Epic Games, GOG)",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_game_info",
            description="Get detailed information for a specific game by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game identifier (e.g., 'steam_730', 'epic_Fortnite')",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_game_optimization",
            description="Get optimization settings for a specific game from community database",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game identifier (Steam app ID or 'steam_XXX' format)",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_optimization_tips",
            description="Get optimization tips - game-specific if game_id provided, otherwise generic tips",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Optional game identifier for game-specific tips",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="ai_optimize_game",
            description="Generate AI-based optimization recommendations for a game based on system specs",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_name": {
                        "type": "string",
                        "description": "Name of the game to optimize",
                    },
                    "system_specs": {
                        "type": "object",
                        "description": "System specifications (cpu, gpu, memory info)",
                    },
                },
                "required": ["game_name"],
            },
        ),
        Tool(
            name="apply_optimization",
            description="Apply optimization settings to a game with automatic backup for rollback",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID (e.g., '730' for CS2)",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="revert_optimization",
            description="Revert a game to its original settings before optimization",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID to revert",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_optimization_history",
            description="Get optimization history for a specific game or all optimized games",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Optional game ID. Omit for all games summary.",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="start_benchmark",
            description="Start a benchmark session to measure performance",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID being benchmarked",
                    },
                    "game_name": {
                        "type": "string",
                        "description": "Game display name",
                    },
                    "phase": {
                        "type": "string",
                        "enum": ["before", "after"],
                        "description": "Benchmark phase",
                    },
                },
                "required": ["game_id", "game_name", "phase"],
            },
        ),
        Tool(
            name="capture_benchmark_sample",
            description="Capture a single benchmark sample (call periodically during benchmark)",
            inputSchema={
                "type": "object",
                "properties": {
                    "benchmark_id": {
                        "type": "string",
                        "description": "Active benchmark ID",
                    },
                },
                "required": ["benchmark_id"],
            },
        ),
        Tool(
            name="end_benchmark",
            description="End a benchmark session and get metrics",
            inputSchema={
                "type": "object",
                "properties": {
                    "benchmark_id": {
                        "type": "string",
                        "description": "Benchmark ID to end",
                    },
                },
                "required": ["benchmark_id"],
            },
        ),
        Tool(
            name="get_benchmark_results",
            description="Get benchmark results for a game or all games",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Optional game ID",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="quick_benchmark",
            description="Run a quick system benchmark without game context",
            inputSchema={
                "type": "object",
                "properties": {
                    "duration_seconds": {
                        "type": "integer",
                        "description": "Benchmark duration (default 10)",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="calculate_score",
            description="Calculate optimization score for a game based on optimization actions and benchmark improvements",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID to calculate score for",
                    },
                    "game_name": {
                        "type": "string",
                        "description": "Optional game display name",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_score",
            description="Get the current optimization score for a game",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID to get score for",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_leaderboard",
            description="Get leaderboard of all game optimization scores",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_score_history",
            description="Get score history over time for a game",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID to get history for",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="get_global_stats",
            description="Get global scoring statistics across all optimized games",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_user_profile",
            description="Get user profile with preferences, hardware signature, and optimization statistics",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="update_user_profile",
            description="Update user preferences (userMode, optimizationDepth, communicationStyle)",
            inputSchema={
                "type": "object",
                "properties": {
                    "userMode": {
                        "type": "string",
                        "enum": ["simple", "standard", "power"],
                        "description": "UI complexity level",
                    },
                    "optimizationDepth": {
                        "type": "string",
                        "enum": ["efficient", "thorough", "optimised"],
                        "description": "Analysis thoroughness level",
                    },
                    "communicationStyle": {
                        "type": "string",
                        "enum": ["informative", "concise"],
                        "description": "AI response verbosity",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="delete_user_profile",
            description="Delete all user profile data",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="record_optimization_choice",
            description="Record user's choice on an optimization for pattern learning",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game identifier",
                    },
                    "game_name": {
                        "type": "string",
                        "description": "Game display name",
                    },
                    "setting_category": {
                        "type": "string",
                        "description": "Category: graphics, launch_options, priority",
                    },
                    "setting_key": {
                        "type": "string",
                        "description": "Specific setting key",
                    },
                    "original_value": {
                        "description": "Original value before change",
                    },
                    "new_value": {
                        "description": "New value after change",
                    },
                    "action": {
                        "type": "string",
                        "enum": ["accepted", "reverted"],
                        "description": "User action on this optimization",
                    },
                },
                "required": ["game_id", "game_name", "setting_category", "action"],
            },
        ),
        Tool(
            name="analyze_patterns",
            description="Analyze user choices and return detected patterns",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_user_patterns",
            description="Get current detected patterns for the user",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_choice_stats",
            description="Get statistics about recorded optimization choices",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_recommendations",
            description="Get personalized optimization recommendations for a game based on learned user patterns",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game identifier (e.g., '730' for CS2)",
                    },
                    "game_name": {
                        "type": "string",
                        "description": "Game display name",
                    },
                },
                "required": ["game_id", "game_name"],
            },
        ),
        # V2 Enhanced Scoring Tools
        Tool(
            name="calculate_enhanced_score",
            description="Calculate comprehensive game score with three dimensions (Performance, Experience, Competitive) and wow factors for viral sharing",
            inputSchema={
                "type": "object",
                "properties": {
                    "game_id": {
                        "type": "string",
                        "description": "Game ID to calculate enhanced score for",
                    },
                    "game_name": {
                        "type": "string",
                        "description": "Optional game display name",
                    },
                },
                "required": ["game_id"],
            },
        ),
        Tool(
            name="calculate_opta_score",
            description="Calculate user's overall Opta Score across all optimized games - the main shareable metric",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="get_hardware_tier",
            description="Detect and return current hardware tier (budget/midrange/highend/enthusiast) with signature and price range",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        # Badge Tools
        Tool(
            name="check_badges",
            description="Check all badges and return current state with progress",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="mark_badge_seen",
            description="Mark a badge as seen (remove 'new' indicator)",
            inputSchema={
                "type": "object",
                "properties": {
                    "badge_id": {
                        "type": "string",
                        "description": "ID of the badge to mark as seen",
                    },
                },
                "required": ["badge_id"],
            },
        ),
        # Investigation Mode Tool
        Tool(
            name="get_investigation_report",
            description="Get full transparency report for an optimization - shows exact registry keys, config files, commands, dependencies, and rollback info",
            inputSchema={
                "type": "object",
                "properties": {
                    "optimization_id": {
                        "type": "string",
                        "description": "ID of the optimization to investigate (e.g., 'game_730', 'stealth_mode')",
                    },
                    "optimization_name": {
                        "type": "string",
                        "description": "Display name of the optimization",
                    },
                },
                "required": ["optimization_id"],
            },
        ),
        # Expertise Detection Tools
        Tool(
            name="get_expertise_profile",
            description="Get current expertise profile with level, confidence, signals, and history",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="record_expertise_signal",
            description="Record a behavioral signal for expertise detection (e.g., shortcut usage, technical details expanded)",
            inputSchema={
                "type": "object",
                "properties": {
                    "signal_name": {
                        "type": "string",
                        "description": "Signal name (e.g., 'uses_shortcuts', 'expands_technical_details')",
                    },
                    "value": {
                        "type": "number",
                        "description": "Signal value (0-100 for rates, raw numbers for counts)",
                    },
                },
                "required": ["signal_name", "value"],
            },
        ),
        Tool(
            name="set_expertise_override",
            description="Set or clear manual expertise level override",
            inputSchema={
                "type": "object",
                "properties": {
                    "level": {
                        "type": ["string", "null"],
                        "description": "Expertise level ('simple', 'standard', 'power') or null to clear override",
                    },
                },
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
    elif name == "detect_games":
        from opta_mcp import games
        result = games.detect_all_games()
    elif name == "get_game_info":
        from opta_mcp import games
        game_id = arguments.get("game_id", "")
        result = games.get_game_info(game_id)
    elif name == "get_game_optimization":
        from opta_mcp import game_settings
        game_id = arguments.get("game_id", "")
        optimization = game_settings.get_game_settings(game_id)
        if optimization:
            result = optimization
        else:
            # Return generic tips if game not in database
            result = {
                "name": "Unknown Game",
                "settings": {},
                "tips": game_settings.get_generic_optimization_tips(),
                "source": "generic",
                "confidence": "low"
            }
    elif name == "get_optimization_tips":
        from opta_mcp import game_settings
        game_id = arguments.get("game_id")
        if game_id:
            optimization = game_settings.get_game_settings(game_id)
            if optimization:
                result = {
                    "tips": optimization.get("tips", []),
                    "source": "database",
                    "game_name": optimization.get("name")
                }
            else:
                result = {
                    "tips": game_settings.get_generic_optimization_tips(),
                    "source": "generic"
                }
        else:
            result = {
                "tips": game_settings.get_generic_optimization_tips(),
                "source": "generic"
            }
    elif name == "ai_optimize_game":
        from opta_mcp import game_settings
        from opta_mcp import telemetry
        game_name = arguments.get("game_name", "Unknown")
        system_specs = arguments.get("system_specs")
        # If no specs provided, get current system telemetry
        if not system_specs:
            snapshot = telemetry.get_system_snapshot()
            system_specs = {
                "cpu": snapshot.get("cpu", {}),
                "gpu": snapshot.get("gpu", {}),
                "memory": snapshot.get("memory", {})
            }
        result = game_settings.generate_ai_recommendations(game_name, system_specs)
    elif name == "apply_optimization":
        from opta_mcp import optimizer
        from opta_mcp import game_settings
        from dataclasses import asdict
        game_id = arguments.get("game_id", "")
        optimization = game_settings.get_game_settings(game_id)
        if not optimization:
            optimization = {
                "name": "Unknown Game",
                "settings": {},
                "tips": game_settings.get_generic_optimization_tips(),
                "source": "generic"
            }
        opt_result = optimizer.apply_game_optimization(game_id, optimization)
        result = asdict(opt_result)
    elif name == "revert_optimization":
        from opta_mcp import optimizer
        from dataclasses import asdict
        game_id = arguments.get("game_id", "")
        opt_result = optimizer.revert_game_optimization(game_id)
        result = asdict(opt_result)
    elif name == "get_optimization_history":
        from opta_mcp import optimizer
        game_id = arguments.get("game_id")
        if game_id:
            result = optimizer.get_optimization_history(game_id)
        else:
            result = optimizer.get_all_optimized_games()
    elif name == "start_benchmark":
        from opta_mcp import benchmark
        result = benchmark.start_benchmark(
            arguments.get("game_id", ""),
            arguments.get("game_name", "Unknown"),
            arguments.get("phase", "before")
        )
    elif name == "capture_benchmark_sample":
        from opta_mcp import benchmark
        sample = benchmark.capture_sample(arguments.get("benchmark_id", ""))
        result = sample or {"error": "Benchmark not found"}
    elif name == "end_benchmark":
        from opta_mcp import benchmark
        metrics = benchmark.end_benchmark(arguments.get("benchmark_id", ""))
        result = metrics or {"error": "Benchmark not found or insufficient samples"}
    elif name == "get_benchmark_results":
        from opta_mcp import benchmark
        game_id = arguments.get("game_id")
        if game_id:
            result = benchmark.get_benchmark_pair(game_id) or []
        else:
            result = benchmark.get_all_benchmarks()
    elif name == "quick_benchmark":
        from opta_mcp import benchmark
        duration = arguments.get("duration_seconds", 10)
        result = benchmark.run_quick_benchmark(duration)
    elif name == "calculate_score":
        from opta_mcp import scoring
        game_id = arguments.get("game_id", "")
        game_name = arguments.get("game_name", "Unknown")
        score = scoring.calculate_score(game_id, game_name)
        result = score or {"error": "No optimization history found for this game"}
    elif name == "get_score":
        from opta_mcp import scoring
        game_id = arguments.get("game_id", "")
        score = scoring.get_score(game_id)
        result = score or {"error": "No score found for this game"}
    elif name == "get_leaderboard":
        from opta_mcp import scoring
        result = scoring.get_all_scores()
    elif name == "get_score_history":
        from opta_mcp import scoring
        game_id = arguments.get("game_id", "")
        result = scoring.get_score_history(game_id)
    elif name == "get_global_stats":
        from opta_mcp import scoring
        result = scoring.get_global_stats()
    elif name == "get_user_profile":
        from opta_mcp import profile
        result = profile.get_or_create_profile()
    elif name == "update_user_profile":
        from opta_mcp import profile
        result = profile.update_profile(arguments)
    elif name == "delete_user_profile":
        from opta_mcp import profile
        deleted = profile.delete_profile()
        result = {"deleted": deleted}
    elif name == "record_optimization_choice":
        from opta_mcp import optimizer
        result = optimizer.record_optimization_choice(
            game_id=arguments.get("game_id", ""),
            game_name=arguments.get("game_name", ""),
            setting_category=arguments.get("setting_category", ""),
            setting_key=arguments.get("setting_key", ""),
            original_value=arguments.get("original_value"),
            new_value=arguments.get("new_value"),
            action=arguments.get("action", "accepted")
        )
    elif name == "analyze_patterns":
        from opta_mcp import patterns
        detected = patterns.analyze_patterns()
        result = [asdict(p) for p in detected]
    elif name == "get_user_patterns":
        from opta_mcp import patterns
        result = patterns.get_user_patterns()
    elif name == "get_choice_stats":
        from opta_mcp import patterns
        result = patterns.get_choice_stats()
    elif name == "get_recommendations":
        from opta_mcp import patterns
        game_id = arguments.get("game_id", "")
        game_name = arguments.get("game_name", "Unknown")
        result = patterns.get_recommendations_for_game(game_id, game_name)
    # V2 Enhanced Scoring Handlers
    elif name == "calculate_enhanced_score":
        from opta_mcp import scoring
        game_id = arguments.get("game_id", "")
        game_name = arguments.get("game_name", "Unknown")
        score = scoring.calculate_enhanced_score(game_id, game_name)
        result = score or {"error": "No optimization history found for this game"}
    elif name == "calculate_opta_score":
        from opta_mcp import scoring
        score = scoring.calculate_opta_score()
        result = score or {"error": "No optimized games found"}
    elif name == "get_hardware_tier":
        from opta_mcp import scoring
        result = scoring.get_hardware_tier()
    # Badge Handlers
    elif name == "check_badges":
        from opta_mcp import badges
        result = badges.check_badges()
    elif name == "mark_badge_seen":
        from opta_mcp import badges
        badge_id = arguments.get("badge_id", "")
        result = badges.mark_badge_seen(badge_id)
    # Investigation Mode Handler
    elif name == "get_investigation_report":
        from opta_mcp import investigation
        optimization_id = arguments.get("optimization_id", "")
        optimization_name = arguments.get("optimization_name", "Unknown Optimization")
        result = investigation.get_investigation_report(optimization_id, optimization_name)
    # Expertise Detection Handlers
    elif name == "get_expertise_profile":
        from opta_mcp import expertise
        result = expertise.get_expertise_profile()
    elif name == "record_expertise_signal":
        from opta_mcp import expertise
        signal_name = arguments.get("signal_name", "")
        value = arguments.get("value", 0)
        result = expertise.record_signal(signal_name, int(value))
    elif name == "set_expertise_override":
        from opta_mcp import expertise
        level = arguments.get("level")
        result = expertise.set_manual_override(level)
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
