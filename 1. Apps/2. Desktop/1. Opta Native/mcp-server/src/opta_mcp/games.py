"""Game detection module for Opta.

This module provides game detection across major game launchers including
Steam, Epic Games, and GOG Galaxy. It scans for installed games and extracts
metadata such as name, install path, and size.

Cross-platform support: macOS, Windows, Linux.
"""

import os
import json
import re
import platform
from pathlib import Path
from typing import List, Dict, Optional, Any


# Launcher configuration with cross-platform paths
LAUNCHERS = {
    "steam": {
        "name": "Steam",
        "paths": {
            "darwin": ["~/Library/Application Support/Steam"],
            "win32": ["C:/Program Files (x86)/Steam", "C:/Program Files/Steam"],
            "linux": ["~/.steam/steam", "~/.local/share/Steam"],
        },
        "library_file": "steamapps/libraryfolders.vdf",
    },
    "epic": {
        "name": "Epic Games",
        "paths": {
            "darwin": ["~/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests"],
            "win32": ["C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests"],
            "linux": [],
        },
        "manifest_dir": "Manifests",
    },
    "gog": {
        "name": "GOG Galaxy",
        "paths": {
            "darwin": ["~/Library/Application Support/GOG.com/Galaxy/config/gamedb.json"],
            "win32": ["C:/ProgramData/GOG.com/Galaxy/config/gamedb.json"],
            "linux": [],
        },
    },
}


def get_platform() -> str:
    """Get the current platform identifier.

    Returns:
        Platform string: 'darwin', 'win32', or 'linux'
    """
    system = platform.system().lower()
    if system == "darwin":
        return "darwin"
    elif system == "windows":
        return "win32"
    else:
        return "linux"


def expand_path(path: str) -> Path:
    """Expand a path with ~ to absolute path.

    Args:
        path: Path string potentially containing ~

    Returns:
        Expanded Path object
    """
    return Path(os.path.expanduser(path))


def detect_launcher(launcher_id: str) -> Dict[str, Any]:
    """Check if a specific launcher is installed.

    Args:
        launcher_id: Launcher identifier ('steam', 'epic', 'gog')

    Returns:
        Dictionary with launcher status and path information
    """
    if launcher_id not in LAUNCHERS:
        return {
            "id": launcher_id,
            "name": launcher_id,
            "installed": False,
            "path": None,
            "error": f"Unknown launcher: {launcher_id}",
        }

    launcher = LAUNCHERS[launcher_id]
    current_platform = get_platform()
    paths = launcher.get("paths", {}).get(current_platform, [])

    for path_str in paths:
        path = expand_path(path_str)
        if path.exists():
            return {
                "id": launcher_id,
                "name": launcher["name"],
                "installed": True,
                "path": str(path),
            }

    return {
        "id": launcher_id,
        "name": launcher["name"],
        "installed": False,
        "path": None,
    }


def parse_vdf(content: str) -> Dict[str, Any]:
    """Parse a Valve Data Format (VDF) file.

    This is a simplified VDF parser that handles the libraryfolders.vdf format.

    Args:
        content: VDF file content as string

    Returns:
        Parsed dictionary structure
    """
    result: Dict[str, Any] = {}
    stack: List[Dict[str, Any]] = [result]
    current_key: Optional[str] = None

    # Simple regex-based parsing for VDF format
    lines = content.split('\n')
    for line in lines:
        line = line.strip()

        # Skip empty lines and comments
        if not line or line.startswith('//'):
            continue

        # Opening brace - create new nested dict
        if line == '{':
            if current_key is not None:
                new_dict: Dict[str, Any] = {}
                stack[-1][current_key] = new_dict
                stack.append(new_dict)
                current_key = None
            continue

        # Closing brace - pop stack
        if line == '}':
            if len(stack) > 1:
                stack.pop()
            continue

        # Key-value pair or key for nested object
        # Match quoted strings: "key" "value" or "key"
        match = re.findall(r'"([^"]*)"', line)
        if len(match) == 2:
            # Key-value pair
            key, value = match
            stack[-1][key] = value
        elif len(match) == 1:
            # Key for nested object
            current_key = match[0]

    return result


def get_steam_games() -> List[Dict[str, Any]]:
    """Detect Steam games by parsing library folders and app manifests.

    Returns:
        List of detected Steam games with metadata
    """
    games: List[Dict[str, Any]] = []
    launcher_info = detect_launcher("steam")

    if not launcher_info["installed"]:
        return games

    steam_path = Path(launcher_info["path"])
    library_file = steam_path / "steamapps" / "libraryfolders.vdf"

    if not library_file.exists():
        return games

    try:
        content = library_file.read_text(encoding='utf-8')
        vdf_data = parse_vdf(content)
    except Exception as e:
        print(f"Error parsing libraryfolders.vdf: {e}")
        return games

    # Get library folders
    library_folders = vdf_data.get("libraryfolders", {})

    # Collect library paths (including the main Steam folder)
    library_paths: List[Path] = []

    for key, value in library_folders.items():
        if isinstance(value, dict) and "path" in value:
            library_paths.append(Path(value["path"]))

    # Also check the main Steam folder
    if steam_path not in library_paths:
        library_paths.append(steam_path)

    # Scan each library for app manifests
    for lib_path in library_paths:
        steamapps = lib_path / "steamapps"
        if not steamapps.exists():
            continue

        # Find all appmanifest files
        for manifest_file in steamapps.glob("appmanifest_*.acf"):
            game_info = parse_steam_manifest(manifest_file)
            if game_info:
                games.append(game_info)

    return games


def parse_steam_manifest(manifest_path: Path) -> Optional[Dict[str, Any]]:
    """Parse a Steam app manifest file.

    Args:
        manifest_path: Path to appmanifest_*.acf file

    Returns:
        Game information dictionary or None if invalid
    """
    try:
        content = manifest_path.read_text(encoding='utf-8')
        data = parse_vdf(content)

        app_state = data.get("AppState", {})
        if not app_state:
            return None

        appid = app_state.get("appid", "")
        name = app_state.get("name", "")
        install_dir = app_state.get("installdir", "")

        if not appid or not name:
            return None

        # Calculate install path
        steamapps_dir = manifest_path.parent
        install_path = steamapps_dir / "common" / install_dir

        # Get size if available
        size_bytes = None
        size_on_disk = app_state.get("SizeOnDisk")
        if size_on_disk:
            try:
                size_bytes = int(size_on_disk)
            except ValueError:
                pass

        return {
            "id": f"steam_{appid}",
            "name": name,
            "launcher": "steam",
            "install_path": str(install_path),
            "size_bytes": size_bytes,
        }
    except Exception as e:
        print(f"Error parsing Steam manifest {manifest_path}: {e}")
        return None


def get_epic_games() -> List[Dict[str, Any]]:
    """Detect Epic Games by parsing manifest files.

    Returns:
        List of detected Epic Games with metadata
    """
    games: List[Dict[str, Any]] = []
    launcher_info = detect_launcher("epic")

    if not launcher_info["installed"]:
        return games

    manifest_dir = Path(launcher_info["path"])

    if not manifest_dir.exists():
        return games

    # Scan for .item manifest files
    for manifest_file in manifest_dir.glob("*.item"):
        game_info = parse_epic_manifest(manifest_file)
        if game_info:
            games.append(game_info)

    return games


def parse_epic_manifest(manifest_path: Path) -> Optional[Dict[str, Any]]:
    """Parse an Epic Games manifest file.

    Args:
        manifest_path: Path to .item manifest file

    Returns:
        Game information dictionary or None if invalid
    """
    try:
        content = manifest_path.read_text(encoding='utf-8')
        data = json.loads(content)

        # Extract relevant fields
        app_name = data.get("AppName", "")
        display_name = data.get("DisplayName", "")
        install_location = data.get("InstallLocation", "")

        if not app_name or not display_name:
            return None

        # Skip if not fully installed
        is_complete = data.get("bIsIncompleteInstall", False)
        if is_complete:
            return None

        # Get size if available
        size_bytes = None
        install_size = data.get("InstallSize")
        if install_size:
            try:
                size_bytes = int(install_size)
            except ValueError:
                pass

        return {
            "id": f"epic_{app_name}",
            "name": display_name,
            "launcher": "epic",
            "install_path": install_location,
            "size_bytes": size_bytes,
        }
    except Exception as e:
        print(f"Error parsing Epic manifest {manifest_path}: {e}")
        return None


def get_gog_games() -> List[Dict[str, Any]]:
    """Detect GOG Galaxy games.

    Returns:
        List of detected GOG games with metadata
    """
    games: List[Dict[str, Any]] = []
    launcher_info = detect_launcher("gog")

    if not launcher_info["installed"]:
        return games

    gamedb_path = Path(launcher_info["path"])

    if not gamedb_path.exists():
        return games

    try:
        content = gamedb_path.read_text(encoding='utf-8')
        data = json.loads(content)

        # GOG Galaxy stores games in the database
        for game_id, game_data in data.items():
            if isinstance(game_data, dict):
                game_info = parse_gog_entry(game_id, game_data)
                if game_info:
                    games.append(game_info)
    except Exception as e:
        print(f"Error parsing GOG gamedb: {e}")

    return games


def parse_gog_entry(game_id: str, game_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse a GOG Galaxy game entry.

    Args:
        game_id: Game ID from GOG
        game_data: Game data dictionary

    Returns:
        Game information dictionary or None if invalid
    """
    try:
        title = game_data.get("title", "")
        install_path = game_data.get("meta", {}).get("installationPath", "")

        if not title:
            return None

        return {
            "id": f"gog_{game_id}",
            "name": title,
            "launcher": "gog",
            "install_path": install_path or "",
            "size_bytes": None,
        }
    except Exception:
        return None


def detect_all_games() -> Dict[str, Any]:
    """Detect all installed games across all supported launchers.

    Returns:
        Dictionary with total count, launcher info, and games list
    """
    all_games: List[Dict[str, Any]] = []
    launcher_info: List[Dict[str, Any]] = []

    # Detect each launcher and its games
    launcher_detectors = {
        "steam": get_steam_games,
        "epic": get_epic_games,
        "gog": get_gog_games,
    }

    for launcher_id, detector in launcher_detectors.items():
        info = detect_launcher(launcher_id)
        games = detector()

        launcher_info.append({
            "id": launcher_id,
            "name": info["name"],
            "installed": info["installed"],
            "game_count": len(games),
        })

        all_games.extend(games)

    return {
        "total_games": len(all_games),
        "launchers": launcher_info,
        "games": all_games,
    }


def get_game_info(game_id: str) -> Dict[str, Any]:
    """Get detailed information for a specific game.

    Args:
        game_id: Game identifier (e.g., 'steam_730', 'epic_Fortnite')

    Returns:
        Game information dictionary or error message
    """
    # Detect all games and find the matching one
    result = detect_all_games()

    for game in result["games"]:
        if game["id"] == game_id:
            return {
                "found": True,
                "game": game,
            }

    return {
        "found": False,
        "error": f"Game not found: {game_id}",
    }


if __name__ == "__main__":
    # Test the detection
    import json
    result = detect_all_games()
    print(json.dumps(result, indent=2))
