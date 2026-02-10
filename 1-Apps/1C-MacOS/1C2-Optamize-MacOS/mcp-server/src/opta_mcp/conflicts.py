"""Competitor tool detection for Opta.

Identifies conflicting optimization software (GeForce Experience, Razer Cortex,
MSI Afterburner, OMEN Hub, etc.) that may interfere with Opta's optimizations.

Uses the existing process listing from processes.py to detect running competitors.
Cross-platform support: Windows, macOS, and Linux.
"""

import platform
from typing import Dict, List
from opta_mcp.processes import get_process_list


def get_current_platform() -> str:
    """Get the current platform identifier.

    Returns:
        Platform string: 'windows', 'darwin', or 'linux'
    """
    system = platform.system().lower()
    if system == "darwin":
        return "darwin"
    elif system == "windows":
        return "windows"
    else:
        return "linux"


# Known competitor optimization tools and their characteristics
# Cross-platform with platform-specific entries
COMPETITOR_TOOLS: Dict[str, Dict] = {
    # === Windows-only tools ===
    "geforce_experience": {
        "name": "NVIDIA GeForce Experience",
        "process_names": ["nvcontainer", "nvidia share", "nvidia web helper"],
        "description": "NVIDIA's game optimization and driver updater",
        "conflict_severity": "high",
        "recommendation": "GeForce Experience optimizes the same settings. Consider disabling its auto-optimization.",
        "platforms": ["windows"],
    },
    "razer_cortex": {
        "name": "Razer Cortex",
        "process_names": ["razer cortex", "rzsynapse", "razer central"],
        "description": "Razer's game booster and system optimizer",
        "conflict_severity": "high",
        "recommendation": "Razer Cortex's Game Booster may conflict. Disable it while using Opta.",
        "platforms": ["windows"],
    },
    "msi_afterburner": {
        "name": "MSI Afterburner",
        "process_names": ["msiafterburner", "rtss"],
        "description": "GPU overclocking and monitoring tool",
        "conflict_severity": "medium",
        "recommendation": "Afterburner's OSD and monitoring can coexist, but avoid conflicting GPU settings.",
        "platforms": ["windows"],
    },
    "omen_hub": {
        "name": "HP OMEN Gaming Hub",
        "process_names": ["omen command center", "omen gaming hub"],
        "description": "HP's optimization suite for OMEN devices",
        "conflict_severity": "high",
        "recommendation": "OMEN Hub's performance modes may conflict. Use one optimizer at a time.",
        "platforms": ["windows"],
    },
    "xbox_game_bar": {
        "name": "Xbox Game Bar",
        "process_names": ["gamebar", "gamebarftsvc"],
        "description": "Windows built-in game overlay",
        "conflict_severity": "low",
        "recommendation": "Game Bar's overlay can impact performance. Consider disabling if not needed.",
        "platforms": ["windows"],
    },
    # === macOS-only tools ===
    "cleanmymac": {
        "name": "CleanMyMac",
        "process_names": ["cleanmymac", "macpaw", "cmmhlpr"],
        "description": "macOS system cleaner and optimizer",
        "conflict_severity": "medium",
        "recommendation": "CleanMyMac's optimization features may conflict with Opta. Avoid running simultaneously.",
        "platforms": ["darwin"],
    },
    "parallels_toolbox": {
        "name": "Parallels Toolbox",
        "process_names": ["prl_disp_service", "parallels"],
        "description": "Parallels system utilities and optimization tools",
        "conflict_severity": "low",
        "recommendation": "Parallels Toolbox utilities may run in background. Close if not needed.",
        "platforms": ["darwin"],
    },
    "appcleaner": {
        "name": "AppCleaner",
        "process_names": ["appcleaner"],
        "description": "macOS app uninstaller with cleanup features",
        "conflict_severity": "low",
        "recommendation": "AppCleaner is generally safe but close during optimization sessions.",
        "platforms": ["darwin"],
    },
    # === Linux-only tools ===
    "gamemode": {
        "name": "Feral GameMode",
        "process_names": ["gamemoded", "gamemode"],
        "description": "Linux game performance optimizer daemon",
        "conflict_severity": "high",
        "recommendation": "GameMode provides similar optimizations. Consider disabling GameMode while using Opta.",
        "platforms": ["linux"],
    },
    "mangohud": {
        "name": "MangoHud",
        "process_names": ["mangohud", "mangoappmenu"],
        "description": "Vulkan/OpenGL overlay for monitoring FPS and performance",
        "conflict_severity": "low",
        "recommendation": "MangoHud overlay can coexist. Consider disabling if you see performance issues.",
        "platforms": ["linux"],
    },
    "goverlay": {
        "name": "GOverlay",
        "process_names": ["goverlay"],
        "description": "Linux graphics card management and overlay tool",
        "conflict_severity": "low",
        "recommendation": "GOverlay provides overlays similar to Opta. Close if conflicting visuals occur.",
        "platforms": ["linux"],
    },
    "corectrl": {
        "name": "CoreCtrl",
        "process_names": ["corectrl"],
        "description": "Linux AMD GPU control and overclocking utility",
        "conflict_severity": "medium",
        "recommendation": "CoreCtrl manages GPU settings. Avoid conflicting GPU profiles with Opta.",
        "platforms": ["linux"],
    },
    # === Cross-platform tools ===
    "discord": {
        "name": "Discord (Game Activity)",
        "process_names": ["discord", "discordptb", "discordcanary"],
        "description": "Discord's game activity detection",
        "conflict_severity": "low",
        "recommendation": "Discord's overlay may use resources. Disable overlay if not needed.",
        "platforms": ["windows", "darwin", "linux"],
    },
    "steam_overlay": {
        "name": "Steam Overlay",
        "process_names": ["steamwebhelper", "steam_osx", "steam"],
        "description": "Steam's in-game overlay",
        "conflict_severity": "low",
        "recommendation": "Steam overlay uses minimal resources but can be disabled in Steam settings if needed.",
        "platforms": ["windows", "darwin", "linux"],
    },
}


def detect_running_conflicts() -> List[Dict]:
    """Detect competitor optimization tools that are currently running.

    Uses the process list from processes.py and matches against known
    competitor tools by process name (case-insensitive).
    Only checks tools relevant to the current platform.

    Returns:
        List of detected conflicts, each containing:
        - tool_id: Internal identifier (e.g., "geforce_experience")
        - name: Display name (e.g., "NVIDIA GeForce Experience")
        - description: Brief description of the tool
        - severity: "high", "medium", or "low"
        - recommendation: Actionable advice for the user
        - detected_processes: List of matching process names found
    """
    # Get current process list (already categorized)
    processes = get_process_list()

    # Get current platform for filtering
    current_platform = get_current_platform()

    # Extract all process names (lowercase for comparison)
    running_names = set()
    for proc in processes:
        name = proc.get("name", "").lower()
        if name:
            running_names.add(name)

    detected_conflicts = []

    # Check each competitor tool (filtered by platform)
    for tool_id, tool_info in COMPETITOR_TOOLS.items():
        # Skip tools not relevant to this platform
        tool_platforms = tool_info.get("platforms", ["windows", "darwin", "linux"])
        if current_platform not in tool_platforms:
            continue

        detected_processes = []

        for process_pattern in tool_info["process_names"]:
            pattern_lower = process_pattern.lower()
            # Check if any running process contains this pattern
            for running_name in running_names:
                if pattern_lower in running_name:
                    detected_processes.append(running_name)

        # If any processes matched, add to conflicts
        if detected_processes:
            detected_conflicts.append({
                "tool_id": tool_id,
                "name": tool_info["name"],
                "description": tool_info["description"],
                "severity": tool_info["conflict_severity"],
                "recommendation": tool_info["recommendation"],
                "detected_processes": list(set(detected_processes))  # Remove duplicates
            })

    # Sort by severity (high > medium > low)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    detected_conflicts.sort(key=lambda c: severity_order.get(c["severity"], 3))

    return detected_conflicts


def get_conflict_summary() -> Dict:
    """Get a summary of conflict detection results.

    Returns:
        Dict containing:
        - total_count: Total number of detected conflicts
        - high_count: Number of high severity conflicts
        - medium_count: Number of medium severity conflicts
        - low_count: Number of low severity conflicts
        - conflicts: Full list of detected conflicts
    """
    conflicts = detect_running_conflicts()

    high_count = sum(1 for c in conflicts if c["severity"] == "high")
    medium_count = sum(1 for c in conflicts if c["severity"] == "medium")
    low_count = sum(1 for c in conflicts if c["severity"] == "low")

    return {
        "total_count": len(conflicts),
        "high_count": high_count,
        "medium_count": medium_count,
        "low_count": low_count,
        "conflicts": conflicts
    }
