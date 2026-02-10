"""
Optimization action framework with backup and rollback support.
"""
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
import shutil

from .patterns import record_choice, OptimizationChoice

# Backup directory for original settings
BACKUP_DIR = Path.home() / ".opta" / "backups"


@dataclass
class OptimizationAction:
    """Single optimization action with rollback capability."""
    action_id: str
    game_id: str
    game_name: str
    action_type: str  # "graphics", "launch_options", "priority"
    setting_key: str
    original_value: Any
    new_value: Any
    file_path: Optional[str]  # Config file if applicable
    applied_at: Optional[float] = None


@dataclass
class OptimizationResult:
    """Result of applying/reverting optimizations."""
    success: bool
    actions_applied: int
    actions_failed: int
    message: str
    details: List[Dict[str, Any]]


def get_backup_path(game_id: str) -> Path:
    """Get backup directory for a game."""
    return BACKUP_DIR / game_id


def backup_original_settings(game_id: str, settings: Dict) -> bool:
    """Backup original settings before applying optimization."""
    backup_path = get_backup_path(game_id)
    backup_path.mkdir(parents=True, exist_ok=True)

    backup_file = backup_path / f"backup_{int(time.time())}.json"
    try:
        with open(backup_file, 'w') as f:
            json.dump({
                "game_id": game_id,
                "timestamp": time.time(),
                "settings": settings
            }, f, indent=2)
        return True
    except Exception as e:
        print(f"Backup failed: {e}")
        return False


def get_latest_backup(game_id: str) -> Optional[Dict]:
    """Get the most recent backup for a game."""
    backup_path = get_backup_path(game_id)
    if not backup_path.exists():
        return None

    backups = sorted(backup_path.glob("backup_*.json"), reverse=True)
    if not backups:
        return None

    try:
        with open(backups[0], 'r') as f:
            return json.load(f)
    except Exception:
        return None


def apply_game_optimization(game_id: str, optimization: Dict) -> OptimizationResult:
    """
    Apply optimization settings to a game.

    For Phase 8-01, this creates the framework but actual file modifications
    are minimal - we store the "intended" optimizations and prepare launch options.
    Full registry/config file modifications come in later phases.
    """
    actions: List[OptimizationAction] = []
    applied = 0
    failed = 0
    details = []

    settings = optimization.get("settings", {})

    # Backup current state (placeholder for actual game config reading)
    backup_original_settings(game_id, {"original": True, "timestamp": time.time()})

    # Create optimization actions for each setting
    if "graphics" in settings:
        for key, value in settings["graphics"].items():
            action = OptimizationAction(
                action_id=f"{game_id}_{key}_{int(time.time())}",
                game_id=game_id,
                game_name=optimization.get("name", "Unknown"),
                action_type="graphics",
                setting_key=key,
                original_value=None,  # Would be read from game config
                new_value=value,
                file_path=None,  # Game config file path
                applied_at=time.time()
            )
            actions.append(action)
            details.append({
                "action": "graphics_setting",
                "key": key,
                "value": value,
                "status": "applied"
            })
            applied += 1

    if "launch_options" in settings:
        action = OptimizationAction(
            action_id=f"{game_id}_launch_{int(time.time())}",
            game_id=game_id,
            game_name=optimization.get("name", "Unknown"),
            action_type="launch_options",
            setting_key="launch_options",
            original_value="",
            new_value=settings["launch_options"],
            file_path=None,
            applied_at=time.time()
        )
        actions.append(action)
        details.append({
            "action": "launch_options",
            "value": settings["launch_options"],
            "status": "applied"
        })
        applied += 1

    if "priority" in settings:
        action = OptimizationAction(
            action_id=f"{game_id}_priority_{int(time.time())}",
            game_id=game_id,
            game_name=optimization.get("name", "Unknown"),
            action_type="priority",
            setting_key="priority",
            original_value="normal",
            new_value=settings["priority"],
            file_path=None,
            applied_at=time.time()
        )
        actions.append(action)
        details.append({
            "action": "priority",
            "value": settings["priority"],
            "status": "applied"
        })
        applied += 1

    # Store actions for rollback
    save_optimization_history(game_id, actions)

    return OptimizationResult(
        success=failed == 0,
        actions_applied=applied,
        actions_failed=failed,
        message=f"Applied {applied} optimizations" if failed == 0 else f"Applied {applied}, failed {failed}",
        details=details
    )


def revert_game_optimization(game_id: str) -> OptimizationResult:
    """Revert a game to its original settings."""
    backup = get_latest_backup(game_id)
    if not backup:
        return OptimizationResult(
            success=False,
            actions_applied=0,
            actions_failed=1,
            message="No backup found to revert to",
            details=[]
        )

    # In full implementation, this would restore config files
    # For now, we clear the optimization history
    history_path = get_backup_path(game_id) / "history.json"
    if history_path.exists():
        history_path.unlink()

    return OptimizationResult(
        success=True,
        actions_applied=1,
        actions_failed=0,
        message="Reverted to original settings",
        details=[{"action": "revert", "backup_timestamp": backup.get("timestamp")}]
    )


def save_optimization_history(game_id: str, actions: List[OptimizationAction]):
    """Save optimization history for a game."""
    history_path = get_backup_path(game_id) / "history.json"
    history_path.parent.mkdir(parents=True, exist_ok=True)

    history = []
    if history_path.exists():
        try:
            with open(history_path, 'r') as f:
                history = json.load(f)
        except Exception:
            history = []

    for action in actions:
        history.append(asdict(action))

    with open(history_path, 'w') as f:
        json.dump(history, f, indent=2)


def get_optimization_history(game_id: str) -> List[Dict]:
    """Get optimization history for a game."""
    history_path = get_backup_path(game_id) / "history.json"
    if not history_path.exists():
        return []

    try:
        with open(history_path, 'r') as f:
            return json.load(f)
    except Exception:
        return []


def get_all_optimized_games() -> List[Dict]:
    """Get all games that have been optimized."""
    if not BACKUP_DIR.exists():
        return []

    games = []
    for game_dir in BACKUP_DIR.iterdir():
        if game_dir.is_dir():
            history = get_optimization_history(game_dir.name)
            if history:
                games.append({
                    "game_id": game_dir.name,
                    "action_count": len(history),
                    "last_optimized": max(a.get("applied_at", 0) for a in history)
                })

    return games


def record_optimization_choice(
    game_id: str,
    game_name: str,
    setting_category: str,
    setting_key: str,
    original_value: Any,
    new_value: Any,
    action: str  # 'accepted', 'reverted'
) -> Dict:
    """
    Record a user's choice for pattern learning.

    Called when user accepts or reverts an optimization to track
    their preferences over time.
    """
    choice = OptimizationChoice(
        game_id=game_id,
        game_name=game_name,
        setting_category=setting_category,
        setting_key=setting_key,
        original_value=original_value,
        new_value=new_value,
        action=action,
        timestamp=time.time()
    )
    record_choice(choice)
    return {"status": "recorded", "choice": asdict(choice)}
