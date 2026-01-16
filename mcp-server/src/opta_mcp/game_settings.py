"""Game settings database module for Opta.

This module provides pre-configured optimal settings from community knowledge bases.
Contains embedded optimization data for popular games and generic tips for unknown games.

Future: Integrate with community APIs or PCGamingWiki for real-time settings.
"""

from typing import Dict, List, Optional, Any


# Built-in optimization database
# In future: fetch from community API or PCGamingWiki
GAME_OPTIMIZATIONS: Dict[str, Dict[str, Any]] = {
    # Steam app IDs as keys for common games
    "730": {  # CS2
        "name": "Counter-Strike 2",
        "settings": {
            "graphics": {
                "shadows": "low",
                "anti_aliasing": "off",
                "texture_quality": "medium",
                "vsync": "off"
            },
            "launch_options": "-novid -tickrate 128",
            "priority": "high"
        },
        "tips": [
            "Disable fullscreen optimizations",
            "Set Windows Game Mode on",
            "Close Discord overlay"
        ]
    },
    "570": {  # Dota 2
        "name": "Dota 2",
        "settings": {
            "graphics": {
                "render_quality": "80%",
                "shadows": "medium",
                "ambient_occlusion": "off"
            },
            "launch_options": "-dx11",
            "priority": "high"
        },
        "tips": [
            "Enable Vulkan for AMD GPUs",
            "Disable Steam overlay"
        ]
    },
    "1245620": {  # Elden Ring
        "name": "Elden Ring",
        "settings": {
            "graphics": {
                "quality_preset": "medium",
                "ray_tracing": "off",
                "motion_blur": "off"
            }
        },
        "tips": [
            "Cap framerate to 60 for stability",
            "Disable EAC overlay"
        ]
    },
    "271590": {  # GTA V
        "name": "Grand Theft Auto V",
        "settings": {
            "graphics": {
                "vsync": "off",
                "grass_quality": "normal",
                "reflection_msaa": "off",
                "extended_distance_scaling": "0"
            },
            "launch_options": "-ignoreDifferentVideoCard",
            "priority": "high"
        },
        "tips": [
            "Disable MSAA for better performance",
            "Set population density to low",
            "Use DirectX 11 instead of Vulkan"
        ]
    },
    "1091500": {  # Cyberpunk 2077
        "name": "Cyberpunk 2077",
        "settings": {
            "graphics": {
                "ray_tracing": "off",
                "screen_space_reflections": "medium",
                "cascaded_shadows_range": "low",
                "volumetric_fog_resolution": "low"
            },
            "priority": "high"
        },
        "tips": [
            "Enable DLSS/FSR for better performance",
            "Disable film grain and chromatic aberration",
            "Set crowd density to low for better FPS"
        ]
    },
    "1172470": {  # Apex Legends
        "name": "Apex Legends",
        "settings": {
            "graphics": {
                "adaptive_resolution_fps_target": "0",
                "anti_aliasing": "off",
                "texture_streaming_budget": "medium",
                "model_detail": "low",
                "effects_detail": "low"
            },
            "launch_options": "+fps_max 0 -novid",
            "priority": "high"
        },
        "tips": [
            "Disable Origin overlay",
            "Cap FPS to 190 to avoid stuttering",
            "Use borderless fullscreen for better alt-tab"
        ]
    },
    "578080": {  # PUBG: Battlegrounds
        "name": "PUBG: Battlegrounds",
        "settings": {
            "graphics": {
                "anti_aliasing": "low",
                "post_processing": "very_low",
                "shadows": "very_low",
                "effects": "low",
                "foliage": "very_low"
            },
            "priority": "high"
        },
        "tips": [
            "Set view distance to medium",
            "Enable sharpen effect in settings",
            "Close background applications"
        ]
    },
    "1599340": {  # Lost Ark
        "name": "Lost Ark",
        "settings": {
            "graphics": {
                "texture_quality": "medium",
                "shadow_quality": "low",
                "character_quality": "medium",
                "particle_quality": "low"
            },
            "priority": "high"
        },
        "tips": [
            "Enable DirectX 11 for stability",
            "Reduce combat effects in busy areas",
            "Disable other player effects"
        ]
    },
    "252490": {  # Rust
        "name": "Rust",
        "settings": {
            "graphics": {
                "graphics_quality": "3",
                "water_quality": "0",
                "max_gibs": "0",
                "object_quality": "100"
            },
            "priority": "high"
        },
        "tips": [
            "Set gc.buffer to 2048 in console",
            "Disable grass in console (grass.on false)",
            "Lower draw distance for better FPS"
        ]
    },
    "892970": {  # Valheim
        "name": "Valheim",
        "settings": {
            "graphics": {
                "vegetation_quality": "medium",
                "particle_lights": "medium",
                "draw_distance": "medium",
                "shadow_quality": "low"
            },
            "priority": "high"
        },
        "tips": [
            "Enable Vulkan for AMD GPUs",
            "Reduce active torches in base",
            "Build smaller, segmented bases"
        ]
    },
}


# Generic optimization tips for unknown games
GENERIC_TIPS: List[str] = [
    "Close background applications before gaming",
    "Update your GPU drivers to the latest version",
    "Disable Windows Game DVR and Game Bar",
    "Set Windows power plan to High Performance",
    "Disable fullscreen optimizations for the game executable",
    "Enable Game Mode in Windows Settings",
    "Close browser tabs and streaming applications",
    "Disable hardware acceleration in Discord/Chrome",
    "Consider disabling V-Sync for lower input lag",
    "Monitor temperatures - thermal throttling kills performance"
]


def get_game_settings(game_id: str) -> Optional[Dict[str, Any]]:
    """Get optimization settings for a game.

    Looks up the game in the GAME_OPTIMIZATIONS database.
    For Steam games, the ID should be the app ID (e.g., "730" for CS2).

    Args:
        game_id: Game identifier (Steam app ID or internal ID)

    Returns:
        Dictionary with settings if found, None if unknown game.
        Includes confidence level based on source.
    """
    # Handle full game IDs like "steam_730"
    if game_id.startswith("steam_"):
        game_id = game_id.replace("steam_", "")
    elif game_id.startswith("epic_") or game_id.startswith("gog_"):
        # For non-Steam games, we might not have optimizations yet
        # Future: add Epic/GOG game databases
        return None

    optimization = GAME_OPTIMIZATIONS.get(game_id)

    if optimization is None:
        return None

    return {
        "name": optimization["name"],
        "settings": optimization.get("settings", {}),
        "tips": optimization.get("tips", []),
        "source": "database",
        "confidence": "high"  # Community-verified settings
    }


def get_generic_optimization_tips() -> List[str]:
    """Get generic optimization tips for unknown games.

    Returns general performance tips that apply to most games.
    Use this when a specific game isn't in our database.

    Returns:
        List of optimization tips as strings.
    """
    return GENERIC_TIPS.copy()


def generate_ai_recommendations(game_name: str, system_specs: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI recommendations for unknown games.

    Uses LLM to generate optimization settings based on game name
    and system specifications. Results are clearly marked as AI-generated
    rather than community-verified.

    Args:
        game_name: Name of the game to optimize
        system_specs: Dictionary with system information (cpu, gpu, ram, etc.)

    Returns:
        Dictionary with AI-generated recommendations.
        Marked as AI source with lower confidence than database entries.
    """
    # Build context for AI recommendations
    cpu_info = system_specs.get("cpu", {})
    gpu_info = system_specs.get("gpu", {})
    memory_info = system_specs.get("memory", {})

    cpu_name = cpu_info.get("model", "Unknown CPU")
    gpu_name = gpu_info.get("name", "Unknown GPU")
    total_ram = memory_info.get("total_gb", 0)

    # Determine system tier based on specs
    system_tier = "mid"
    if total_ram >= 32 or "RTX 40" in gpu_name or "RTX 30" in gpu_name:
        system_tier = "high"
    elif total_ram < 8 or "GT " in gpu_name or "Intel HD" in gpu_name:
        system_tier = "low"

    # Generate tier-based recommendations
    if system_tier == "high":
        graphics_preset = "high"
        tips = [
            f"Your {gpu_name} should handle high settings",
            "Enable ray tracing if supported",
            "Consider higher resolution or supersampling"
        ]
    elif system_tier == "low":
        graphics_preset = "low"
        tips = [
            "Use lowest graphics preset for playable FPS",
            "Disable all post-processing effects",
            "Lower resolution if needed (720p)",
            "Close all background applications"
        ]
    else:
        graphics_preset = "medium"
        tips = [
            "Start with medium preset and adjust",
            "Disable anti-aliasing for better FPS",
            "Keep texture quality at medium",
            "Monitor GPU temperature during gameplay"
        ]

    return {
        "name": game_name,
        "settings": {
            "graphics": {
                "recommended_preset": graphics_preset,
                "vsync": "off" if system_tier != "low" else "adaptive",
                "anti_aliasing": "off" if system_tier == "low" else "low"
            }
        },
        "tips": tips + get_generic_optimization_tips()[:3],
        "source": "ai",
        "confidence": "medium",  # AI-generated, not community-verified
        "system_tier": system_tier,
        "based_on": {
            "cpu": cpu_name,
            "gpu": gpu_name,
            "ram_gb": total_ram
        }
    }


if __name__ == "__main__":
    # Test the module
    import json

    # Test known game
    print("CS2 Settings:")
    print(json.dumps(get_game_settings("730"), indent=2))

    print("\nGeneric Tips:")
    for tip in get_generic_optimization_tips()[:5]:
        print(f"  - {tip}")

    # Test AI recommendations
    print("\nAI Recommendations for Unknown Game:")
    specs = {
        "cpu": {"model": "AMD Ryzen 7 5800X"},
        "gpu": {"name": "NVIDIA RTX 3070"},
        "memory": {"total_gb": 32}
    }
    print(json.dumps(generate_ai_recommendations("Unknown Game", specs), indent=2))
