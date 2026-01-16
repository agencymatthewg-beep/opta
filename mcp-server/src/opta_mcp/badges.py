"""
Milestone badge system for gamification.
"""
import json
import time
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from .scoring import get_all_scores, get_global_stats

BADGES_DIR = Path.home() / ".opta" / "badges"

# Badge definitions (mirrors TypeScript)
BADGE_DEFINITIONS = [
    {
        "id": "first-10-fps",
        "name": "First Boost",
        "description": "Your first 10 FPS gained across all games",
        "category": "performance",
        "rarity": "common",
        "icon": "Zap",
        "requirement": "Gain 10 total FPS",
        "requirement_key": "totalFpsGained",
        "requirement_value": 10
    },
    {
        "id": "fps-50",
        "name": "Frame Hunter",
        "description": "Gained 50 FPS total across all games",
        "category": "performance",
        "rarity": "rare",
        "icon": "Flame",
        "requirement": "Gain 50 total FPS",
        "requirement_key": "totalFpsGained",
        "requirement_value": 50
    },
    {
        "id": "fps-100",
        "name": "Frame Master",
        "description": "Gained 100 FPS total - you are optimized",
        "category": "performance",
        "rarity": "epic",
        "icon": "Crown",
        "requirement": "Gain 100 total FPS",
        "requirement_key": "totalFpsGained",
        "requirement_value": 100
    },
    {
        "id": "optimized-30-days",
        "name": "Steady State",
        "description": "System optimized for 30 days",
        "category": "consistency",
        "rarity": "rare",
        "icon": "Shield",
        "requirement": "Stay optimized for 30 days",
        "requirement_key": "daysActive",
        "requirement_value": 30
    },
    {
        "id": "top-50-percent",
        "name": "Above Average",
        "description": "In the top 50% of your hardware tier",
        "category": "ranking",
        "rarity": "common",
        "icon": "TrendingUp",
        "requirement": "Reach top 50% in your tier",
        "requirement_key": "percentileRank",
        "requirement_value": 50
    },
    {
        "id": "top-10-percent",
        "name": "Elite Optimizer",
        "description": "In the top 10% of your hardware tier",
        "category": "ranking",
        "rarity": "epic",
        "icon": "Award",
        "requirement": "Reach top 10% in your tier",
        "requirement_key": "percentileRank",
        "requirement_value": 90
    },
    {
        "id": "top-1-percent",
        "name": "Legendary",
        "description": "In the top 1% globally",
        "category": "ranking",
        "rarity": "legendary",
        "icon": "Star",
        "requirement": "Reach top 1% globally",
        "requirement_key": "percentileRank",
        "requirement_value": 99
    },
    {
        "id": "games-5",
        "name": "Game Explorer",
        "description": "Optimized 5 different games",
        "category": "exploration",
        "rarity": "common",
        "icon": "Gamepad2",
        "requirement": "Optimize 5 games",
        "requirement_key": "gamesOptimized",
        "requirement_value": 5
    },
    {
        "id": "games-10",
        "name": "Library Master",
        "description": "Optimized 10 different games",
        "category": "exploration",
        "rarity": "rare",
        "icon": "Library",
        "requirement": "Optimize 10 games",
        "requirement_key": "gamesOptimized",
        "requirement_value": 10
    }
]


def get_user_stats() -> dict:
    """Calculate current user stats for badge evaluation."""
    all_scores = get_all_scores()
    global_stats = get_global_stats()

    # Calculate total FPS gained (estimate from performance scores)
    total_fps = sum(
        s.get('breakdown', {}).get('performance_score', 0) * 0.5
        for s in all_scores
    )

    # Days active (from first optimization to now)
    if all_scores:
        timestamps = [s.get('calculated_at', time.time()) for s in all_scores]
        first_timestamp = min(timestamps)
        days_active = (time.time() - first_timestamp) / 86400
    else:
        days_active = 0

    # Percentile (use average score position)
    percentile = 50  # Default, will be calculated from actual data
    if all_scores:
        avg_score = sum(s.get('score', 0) for s in all_scores) / len(all_scores)
        # Estimate percentile based on score (higher score = higher percentile)
        percentile = min(99, max(1, avg_score))

    return {
        "totalFpsGained": int(total_fps),
        "totalOptimizations": global_stats.get("total_games_optimized", 0) * 3,  # Estimate
        "gamesOptimized": global_stats.get("total_games_optimized", 0),
        "daysActive": int(days_active),
        "percentileRank": percentile,
        "streakDays": 0,  # Future implementation
        "hardwareTier": "midrange"  # From profile
    }


def check_badges() -> dict:
    """Check all badges and return current state."""
    BADGES_DIR.mkdir(parents=True, exist_ok=True)
    badges_file = BADGES_DIR / "badges.json"

    # Load existing badges
    existing = {}
    if badges_file.exists():
        try:
            with open(badges_file, 'r') as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    # Get current stats
    stats = get_user_stats()

    # Evaluate each badge
    badges = []
    new_unlocks = []

    for defn in BADGE_DEFINITIONS:
        badge_id = defn["id"]
        req_key = defn["requirement_key"]
        req_value = defn["requirement_value"]

        # Calculate progress
        current_value = stats.get(req_key, 0)
        progress = min(100, (current_value / req_value) * 100) if req_value > 0 else 0
        is_unlocked = progress >= 100

        # Check if newly unlocked
        was_unlocked = existing.get(badge_id, {}).get("unlockedAt") is not None
        is_new = is_unlocked and not was_unlocked

        if is_new:
            new_unlocks.append(badge_id)

        # Get stored unlockedAt or set new one
        unlocked_at = None
        if is_unlocked:
            unlocked_at = existing.get(badge_id, {}).get("unlockedAt") or (time.time() * 1000)

        badge = {
            "id": badge_id,
            "name": defn["name"],
            "description": defn["description"],
            "category": defn["category"],
            "rarity": defn["rarity"],
            "icon": defn["icon"],
            "requirement": defn["requirement"],
            "progress": round(progress, 1),
            "unlockedAt": unlocked_at,
            "isNew": is_new
        }
        badges.append(badge)

    # Save updated badges
    badges_dict = {b["id"]: b for b in badges}
    with open(badges_file, 'w') as f:
        json.dump(badges_dict, f, indent=2)

    return {
        "badges": badges,
        "newUnlocks": new_unlocks,
        "stats": stats
    }


def mark_badge_seen(badge_id: str) -> dict:
    """Mark a badge as seen (no longer new)."""
    badges_file = BADGES_DIR / "badges.json"
    if not badges_file.exists():
        return {"success": False, "error": "No badges file"}

    try:
        with open(badges_file, 'r') as f:
            badges = json.load(f)

        if badge_id in badges:
            badges[badge_id]["isNew"] = False
            with open(badges_file, 'w') as f:
                json.dump(badges, f, indent=2)
            return {"success": True}

        return {"success": False, "error": "Badge not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}
