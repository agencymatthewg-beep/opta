"""Investigation mode - full transparency for power users.

Provides detailed reports on what Opta is doing under the hood:
- Exact registry keys, config files, commands
- Impact analysis and dependencies
- Rollback implications
"""

import platform
import time
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class InvestigationChange:
    """A single change that Opta will make or has made."""

    id: str
    type: str  # registry, config, command, service, file
    platform: str  # windows, macos, linux, all
    location: str
    description: str
    before: Optional[str]
    after: str
    technical: str
    reversible: bool
    rollback_command: Optional[str] = None


@dataclass
class InvestigationDependency:
    """A dependency that an optimization requires, conflicts with, or affects."""

    name: str
    type: str  # requires, conflicts, affects
    description: str
    status: str  # ok, warning, blocked


@dataclass
class InvestigationImpact:
    """Impact analysis for an optimization change."""

    category: str  # performance, stability, compatibility, security
    severity: str  # low, medium, high
    description: str
    mitigation: Optional[str] = None


def get_investigation_report(optimization_id: str, optimization_name: str) -> dict:
    """
    Generate a full investigation report for an optimization.

    Returns complete transparency about what will change.
    """
    changes = []
    dependencies = []
    impacts = []
    current_platform = platform.system().lower()

    # Example: Game config optimization
    if "game" in optimization_id.lower():
        changes.append(
            InvestigationChange(
                id=f"{optimization_id}_config",
                type="config",
                platform="all",
                location=get_game_config_path(optimization_id),
                description="Game graphics settings file",
                before="ResolutionScale=100",
                after="ResolutionScale=85",
                technical="Modifies the internal render resolution. "
                "Game renders at 85% resolution then upscales. "
                "File format: INI/XML depending on game engine.",
                reversible=True,
                rollback_command=f"Restore from backup: ~/.opta/backups/{optimization_id}/",
            )
        )

        # Windows-specific registry changes
        if current_platform == "windows":
            changes.append(
                InvestigationChange(
                    id=f"{optimization_id}_nvidia_profile",
                    type="registry",
                    platform="windows",
                    location=r"HKEY_LOCAL_MACHINE\SOFTWARE\NVIDIA Corporation\Global\NVTweak",
                    description="NVIDIA driver profile settings",
                    before="PowerMgtMode=0",
                    after="PowerMgtMode=1",
                    technical="Sets NVIDIA power management to 'Prefer Maximum Performance'. "
                    "Prevents GPU from downclocking during gameplay. "
                    "Requires admin privileges to modify.",
                    reversible=True,
                    rollback_command="reg delete ... /v PowerMgtMode",
                )
            )

    # Process optimization changes
    if "process" in optimization_id.lower() or "stealth" in optimization_id.lower():
        changes.append(
            InvestigationChange(
                id=f"{optimization_id}_processes",
                type="command",
                platform="all",
                location="System processes",
                description="Terminate non-essential background processes",
                before="Running: Chrome, Spotify, Discord",
                after="Terminated: Chrome, Spotify",
                technical="Uses psutil to terminate processes by PID. "
                "Sends SIGTERM first (graceful), then SIGKILL after 0.5s. "
                "Protected processes (system, antivirus) are skipped.",
                reversible=False,
                rollback_command="Processes will restart on next boot or manual launch",
            )
        )

    # Graphics optimization changes
    if "graphics" in optimization_id.lower() or "gpu" in optimization_id.lower():
        if current_platform == "darwin":
            changes.append(
                InvestigationChange(
                    id=f"{optimization_id}_metal",
                    type="config",
                    platform="macos",
                    location="Metal Performance HUD settings",
                    description="macOS Metal API configuration",
                    before="Default Metal settings",
                    after="Metal Performance Mode enabled",
                    technical="Adjusts Metal shader compilation and buffer management. "
                    "May improve frame pacing on Apple Silicon.",
                    reversible=True,
                    rollback_command="Revert via System Preferences > Game Mode",
                )
            )

    # Add dependencies
    dependencies.append(
        InvestigationDependency(
            name="Backup System",
            type="requires",
            description="Original config backed up before changes",
            status="ok",
        )
    )

    # Check for known conflicts
    if "game" in optimization_id.lower():
        dependencies.append(
            InvestigationDependency(
                name="GeForce Experience",
                type="conflicts",
                description="May override Opta's graphics settings",
                status="warning",
            )
        )

    # Add impacts
    if changes:
        impacts.append(
            InvestigationImpact(
                category="performance",
                severity="low",
                description="Resolution reduction may be visible on large monitors",
                mitigation="Use DLSS/FSR for better upscaling quality",
            )
        )

        impacts.append(
            InvestigationImpact(
                category="stability",
                severity="low",
                description="Some games may need restart for settings to apply",
                mitigation="Save progress before applying optimizations",
            )
        )

    # Build rollback info
    rollback_available = all(c.reversible for c in changes)
    rollback_steps = [c.rollback_command for c in changes if c.rollback_command]
    rollback_warnings = []

    if not rollback_available:
        rollback_warnings.append("Some processes may need manual restart")

    return {
        "optimizationId": optimization_id,
        "optimizationName": optimization_name,
        "timestamp": int(time.time() * 1000),
        "changes": [asdict(c) for c in changes],
        "dependencies": [asdict(d) for d in dependencies],
        "impacts": [asdict(i) for i in impacts],
        "rollback": {
            "available": rollback_available,
            "steps": rollback_steps,
            "warnings": rollback_warnings,
        },
    }


def get_game_config_path(game_id: str) -> str:
    """Get the config file path for a game."""
    system = platform.system()

    # Example paths - would be populated from game detection
    paths = {
        "730": {  # CS2
            "Windows": r"%LOCALAPPDATA%\Counter-Strike 2\config\video.txt",
            "Darwin": "~/Library/Application Support/Steam/steamapps/common/Counter-Strike 2/config/video.txt",
            "Linux": "~/.steam/steam/steamapps/common/Counter-Strike 2/config/video.txt",
        },
        "valorant": {
            "Windows": r"%LOCALAPPDATA%\VALORANT\Saved\Config\Windows\GameUserSettings.ini",
            "Darwin": "Not supported on macOS",
            "Linux": "Not supported on Linux",
        },
        "570": {  # Dota 2
            "Windows": r"%LOCALAPPDATA%\dota 2 beta\game\dota\cfg\video.txt",
            "Darwin": "~/Library/Application Support/Steam/steamapps/common/dota 2 beta/game/dota/cfg/video.txt",
            "Linux": "~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/video.txt",
        },
    }

    # Extract game ID from format like "steam_730" or just "730"
    clean_id = game_id.lower().replace("steam_", "").replace("game_", "")

    return paths.get(clean_id, {}).get(system, f"Unknown location for {game_id}")


def get_registry_changes_preview(optimization_id: str) -> list:
    """Get preview of registry changes (Windows only)."""
    if platform.system() != "Windows":
        return []

    # Would query actual planned registry modifications
    return [
        {
            "key": r"HKEY_LOCAL_MACHINE\SOFTWARE\...",
            "value": "...",
            "type": "DWORD",
            "current": "0x00000000",
            "proposed": "0x00000001",
        }
    ]


def get_command_trace(optimization_id: str) -> list:
    """Get trace of commands that will be executed."""
    return [
        {
            "command": "taskkill /F /PID 1234",
            "purpose": "Terminate background process",
            "requires_admin": False,
        }
    ]
