"""Competitor tool detection for Opta.

Identifies conflicting optimization software (GeForce Experience, Razer Cortex,
MSI Afterburner, OMEN Hub, etc.) that may interfere with Opta's optimizations.

Uses the existing process listing from processes.py to detect running competitors.
"""

from typing import Dict, List
from opta_mcp.processes import get_process_list


# Known competitor optimization tools and their characteristics
COMPETITOR_TOOLS: Dict[str, Dict] = {
    "geforce_experience": {
        "name": "NVIDIA GeForce Experience",
        "process_names": ["nvcontainer", "nvidia share", "nvidia web helper"],
        "description": "NVIDIA's game optimization and driver updater",
        "conflict_severity": "high",
        "recommendation": "GeForce Experience optimizes the same settings. Consider disabling its auto-optimization."
    },
    "razer_cortex": {
        "name": "Razer Cortex",
        "process_names": ["razer cortex", "rzsynapse", "razer central"],
        "description": "Razer's game booster and system optimizer",
        "conflict_severity": "high",
        "recommendation": "Razer Cortex's Game Booster may conflict. Disable it while using Opta."
    },
    "msi_afterburner": {
        "name": "MSI Afterburner",
        "process_names": ["msiafterburner", "rtss"],
        "description": "GPU overclocking and monitoring tool",
        "conflict_severity": "medium",
        "recommendation": "Afterburner's OSD and monitoring can coexist, but avoid conflicting GPU settings."
    },
    "omen_hub": {
        "name": "HP OMEN Gaming Hub",
        "process_names": ["omen command center", "omen gaming hub"],
        "description": "HP's optimization suite for OMEN devices",
        "conflict_severity": "high",
        "recommendation": "OMEN Hub's performance modes may conflict. Use one optimizer at a time."
    },
    "xbox_game_bar": {
        "name": "Xbox Game Bar",
        "process_names": ["gamebar", "gamebarftsvc"],
        "description": "Windows built-in game overlay",
        "conflict_severity": "low",
        "recommendation": "Game Bar's overlay can impact performance. Consider disabling if not needed."
    },
    "discord": {
        "name": "Discord (Game Activity)",
        "process_names": ["discord"],
        "description": "Discord's game activity detection",
        "conflict_severity": "low",
        "recommendation": "Discord's overlay may use resources. Disable overlay if not needed."
    }
}


def detect_running_conflicts() -> List[Dict]:
    """Detect competitor optimization tools that are currently running.

    Uses the process list from processes.py and matches against known
    competitor tools by process name (case-insensitive).

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

    # Extract all process names (lowercase for comparison)
    running_names = set()
    for proc in processes:
        name = proc.get("name", "").lower()
        if name:
            running_names.add(name)

    detected_conflicts = []

    # Check each competitor tool
    for tool_id, tool_info in COMPETITOR_TOOLS.items():
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
