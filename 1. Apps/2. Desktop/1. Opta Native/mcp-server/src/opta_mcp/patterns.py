"""
Pattern learning engine for analyzing user optimization choices.

Tracks when users accept vs revert optimizations, analyzes patterns
across games and setting types, and builds a preference model that
improves recommendations over time.
"""
import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

# Storage location for choice logs
CHOICES_DIR = Path.home() / ".opta" / "choices"
CHOICES_LOG = CHOICES_DIR / "choices_log.jsonl"


@dataclass
class OptimizationChoice:
    """Records a single user choice on an optimization."""
    game_id: str
    game_name: str
    setting_category: str  # 'graphics', 'launch_options', 'priority'
    setting_key: str
    original_value: Any
    new_value: Any
    action: str  # 'accepted', 'reverted', 'modified'
    timestamp: float


@dataclass
class DetectedPattern:
    """A pattern discovered from analyzing choices."""
    pattern_type: str  # 'preference', 'aversion', 'timing'
    setting_category: str
    setting_key: str
    confidence: float  # 0-1 based on sample count and consistency
    sample_count: int
    description: str  # Human-readable explanation
    last_updated: float


def record_choice(choice: OptimizationChoice) -> None:
    """
    Record a user's optimization choice to ~/.opta/choices/.

    Appends to choices_log.jsonl (one JSON per line for easy streaming reads).
    """
    CHOICES_DIR.mkdir(parents=True, exist_ok=True)

    # Append choice as JSON line
    with open(CHOICES_LOG, "a") as f:
        f.write(json.dumps(asdict(choice)) + "\n")


def load_all_choices() -> List[Dict]:
    """Load all recorded choices from the log file."""
    if not CHOICES_LOG.exists():
        return []

    choices = []
    try:
        with open(CHOICES_LOG, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        choices.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue  # Skip malformed lines
    except Exception:
        return []

    return choices


def _generate_description(setting_category: str, setting_key: str,
                          pattern_type: str, acceptance_rate: float) -> str:
    """Generate human-readable description for a pattern."""
    category_names = {
        "graphics": "graphics",
        "launch_options": "launch options",
        "priority": "process priority"
    }
    cat_name = category_names.get(setting_category, setting_category)

    if pattern_type == "preference":
        if setting_key == "fps_boost" or "fps" in setting_key.lower():
            return "You typically accept FPS-boosting optimizations"
        if setting_key == "launch_options":
            return "You tend to accept launch option changes"
        if "quality" in setting_key.lower():
            return f"You often accept {cat_name} quality changes"
        return f"You typically accept {setting_key} changes in {cat_name}"

    elif pattern_type == "aversion":
        if "quality" in setting_key.lower() or "visual" in setting_key.lower():
            return "You tend to revert changes to visual quality settings"
        if setting_key == "launch_options":
            return "You prefer not to change launch options"
        return f"You tend to revert {setting_key} changes in {cat_name}"

    else:
        # Neutral or timing pattern
        rate_pct = int(acceptance_rate * 100)
        return f"You accept {setting_key} changes {rate_pct}% of the time"


def analyze_patterns() -> List[DetectedPattern]:
    """
    Analyze all recorded choices to detect patterns.

    Pattern detection logic:
    1. Group choices by setting_category + setting_key
    2. Calculate acceptance_rate = accepted / (accepted + reverted)
    3. If acceptance_rate > 0.7 and samples >= 3: mark as 'preference'
    4. If acceptance_rate < 0.3 and samples >= 3: mark as 'aversion'
    """
    choices = load_all_choices()
    if not choices:
        return []

    # Group by category + key
    groups: Dict[str, Dict] = {}
    for choice in choices:
        key = f"{choice['setting_category']}:{choice['setting_key']}"
        if key not in groups:
            groups[key] = {
                "setting_category": choice["setting_category"],
                "setting_key": choice["setting_key"],
                "accepted": 0,
                "reverted": 0,
                "modified": 0,
                "timestamps": []
            }

        action = choice.get("action", "")
        if action == "accepted":
            groups[key]["accepted"] += 1
        elif action == "reverted":
            groups[key]["reverted"] += 1
        elif action == "modified":
            groups[key]["modified"] += 1

        groups[key]["timestamps"].append(choice.get("timestamp", 0))

    patterns = []
    current_time = time.time()

    for key, data in groups.items():
        total = data["accepted"] + data["reverted"]
        if total < 3:
            continue  # Not enough samples

        acceptance_rate = data["accepted"] / total if total > 0 else 0

        # Determine pattern type
        if acceptance_rate > 0.7:
            pattern_type = "preference"
            confidence = min(0.95, 0.5 + (data["accepted"] / 20))  # Cap at 95%
        elif acceptance_rate < 0.3:
            pattern_type = "aversion"
            confidence = min(0.95, 0.5 + (data["reverted"] / 20))
        else:
            continue  # No strong pattern

        # Generate description
        description = _generate_description(
            data["setting_category"],
            data["setting_key"],
            pattern_type,
            acceptance_rate
        )

        patterns.append(DetectedPattern(
            pattern_type=pattern_type,
            setting_category=data["setting_category"],
            setting_key=data["setting_key"],
            confidence=round(confidence, 2),
            sample_count=total,
            description=description,
            last_updated=max(data["timestamps"]) if data["timestamps"] else current_time
        ))

    # Sort by confidence descending
    patterns.sort(key=lambda p: p.confidence, reverse=True)

    return patterns


def get_user_patterns() -> List[Dict]:
    """
    Get current detected patterns for the user.

    Returns patterns as dictionaries suitable for JSON serialization
    with camelCase keys for frontend compatibility.
    """
    patterns = analyze_patterns()

    # Convert to camelCase for frontend
    result = []
    for p in patterns:
        result.append({
            "patternType": p.pattern_type,
            "settingCategory": p.setting_category,
            "settingKey": p.setting_key,
            "confidence": p.confidence,
            "sampleCount": p.sample_count,
            "description": p.description,
            "lastUpdated": int(p.last_updated * 1000)  # JS timestamp
        })

    return result


def update_profile_patterns(profile_path: Path) -> None:
    """
    Update the user profile with latest detected patterns.

    Loads the profile, runs analyze_patterns(), and saves patterns
    to the profile's patterns field.
    """
    if not profile_path.exists():
        return

    try:
        with open(profile_path, "r") as f:
            profile = json.load(f)
    except Exception:
        return

    patterns = get_user_patterns()
    profile["patterns"] = patterns
    profile["lastUpdated"] = int(time.time() * 1000)

    # Atomic write
    temp_path = profile_path.with_suffix(".tmp")
    with open(temp_path, "w") as f:
        json.dump(profile, f, indent=2)
    temp_path.replace(profile_path)


def get_choice_stats() -> Dict:
    """Get statistics about recorded choices."""
    choices = load_all_choices()
    if not choices:
        return {
            "totalChoices": 0,
            "accepted": 0,
            "reverted": 0,
            "modified": 0,
            "uniqueSettings": 0,
            "gamesTracked": 0
        }

    accepted = sum(1 for c in choices if c.get("action") == "accepted")
    reverted = sum(1 for c in choices if c.get("action") == "reverted")
    modified = sum(1 for c in choices if c.get("action") == "modified")

    unique_settings = len(set(
        f"{c['setting_category']}:{c['setting_key']}" for c in choices
    ))
    games_tracked = len(set(c.get("game_id") for c in choices))

    return {
        "totalChoices": len(choices),
        "accepted": accepted,
        "reverted": reverted,
        "modified": modified,
        "uniqueSettings": unique_settings,
        "gamesTracked": games_tracked
    }


def _generate_recommendation_reason(pattern: DetectedPattern, setting_key: str) -> str:
    """Generate a user-friendly reason for a recommendation based on a pattern."""
    if pattern.pattern_type == "preference":
        if "fps" in setting_key.lower() or "performance" in setting_key.lower():
            return "Based on your history, I'm prioritizing FPS. Change this?"
        if "quality" in setting_key.lower() or "visual" in setting_key.lower():
            return "You typically accept quality improvements - high confidence this will work."
        if pattern.setting_category == "launch_options":
            return "You tend to accept launch option changes. This should improve performance."
        if pattern.setting_category == "priority":
            return "You've liked process priority changes before. This boosts responsiveness."
        return f"Based on your {pattern.setting_category} preferences, this is a good fit."
    elif pattern.pattern_type == "aversion":
        # For aversions, we recommend NOT applying certain settings
        return "I'm skipping this based on your preferences - you typically revert these."
    return "This recommendation is based on your optimization history."


def _estimate_impact(setting_key: str, setting_category: str) -> str:
    """Generate an estimated impact string for a recommendation."""
    # Impact estimates based on common optimization knowledge
    impact_map = {
        "fps_boost": "+10-15 FPS estimated",
        "vsync": "Lower input lag, potential tearing",
        "shadows": "+5-10 FPS estimated",
        "anti_aliasing": "+5-8 FPS estimated",
        "texture_quality": "Minimal FPS impact, visual change",
        "ray_tracing": "+15-25 FPS estimated",
        "launch_options": "Faster startup, better stability",
        "priority": "More responsive gameplay"
    }

    for key, impact in impact_map.items():
        if key in setting_key.lower():
            return impact

    if setting_category == "graphics":
        return "+5-10 FPS potential"
    if setting_category == "launch_options":
        return "Improved stability"
    if setting_category == "priority":
        return "Better responsiveness"

    return "Performance improvement expected"


def _confidence_to_level(confidence: float) -> str:
    """Convert numeric confidence to high/medium/low."""
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.5:
        return "medium"
    return "low"


def generate_recommendations(
    game_id: str,
    game_name: str,
    available_settings: Dict,
    patterns: List[DetectedPattern]
) -> List[Dict]:
    """
    Generate personalized recommendations for a game based on patterns.

    Uses detected user patterns to suggest optimizations that align with
    the user's historical preferences and avoid settings they typically reject.

    Args:
        game_id: Game identifier
        game_name: Game display name
        available_settings: Settings available for this game (from game_settings database)
        patterns: List of detected user patterns

    Returns:
        List of recommendation dictionaries ready for frontend consumption.
    """
    recommendations = []
    current_time = time.time()

    # Track which settings we've already recommended
    recommended_keys = set()

    for pattern in patterns:
        # Skip low-confidence patterns
        if pattern.confidence < 0.5:
            continue

        # For preferences, recommend matching settings
        if pattern.pattern_type == "preference":
            category = pattern.setting_category

            # Check if available_settings has this category
            if category in available_settings:
                category_settings = available_settings[category]

                # Look for settings that match this pattern
                if isinstance(category_settings, dict):
                    for setting_key, setting_value in category_settings.items():
                        # Avoid duplicate recommendations
                        rec_key = f"{category}:{setting_key}"
                        if rec_key in recommended_keys:
                            continue

                        # Check if this setting relates to the pattern
                        if _settings_match_pattern(setting_key, pattern):
                            recommended_keys.add(rec_key)
                            recommendations.append({
                                "id": f"rec_{game_id}_{category}_{setting_key}_{int(current_time)}",
                                "gameId": game_id,
                                "gameName": game_name,
                                "settingCategory": category,
                                "settingKey": setting_key,
                                "suggestedValue": setting_value,
                                "reason": _generate_recommendation_reason(pattern, setting_key),
                                "expectedImpact": _estimate_impact(setting_key, category),
                                "confidence": _confidence_to_level(pattern.confidence),
                                "basedOnPattern": f"{pattern.setting_category}:{pattern.setting_key}"
                            })
                elif isinstance(category_settings, str):
                    # Launch options are stored as a string
                    rec_key = f"{category}:launch_options"
                    if rec_key not in recommended_keys:
                        recommended_keys.add(rec_key)
                        recommendations.append({
                            "id": f"rec_{game_id}_{category}_launch_options_{int(current_time)}",
                            "gameId": game_id,
                            "gameName": game_name,
                            "settingCategory": category,
                            "settingKey": "launch_options",
                            "suggestedValue": category_settings,
                            "reason": _generate_recommendation_reason(pattern, "launch_options"),
                            "expectedImpact": _estimate_impact("launch_options", category),
                            "confidence": _confidence_to_level(pattern.confidence),
                            "basedOnPattern": f"{pattern.setting_category}:{pattern.setting_key}"
                        })

            # Also check for priority settings
            if category == "priority" and "priority" in available_settings:
                rec_key = "priority:priority"
                if rec_key not in recommended_keys:
                    recommended_keys.add(rec_key)
                    recommendations.append({
                        "id": f"rec_{game_id}_priority_{int(current_time)}",
                        "gameId": game_id,
                        "gameName": game_name,
                        "settingCategory": "priority",
                        "settingKey": "process_priority",
                        "suggestedValue": available_settings["priority"],
                        "reason": _generate_recommendation_reason(pattern, "priority"),
                        "expectedImpact": _estimate_impact("priority", "priority"),
                        "confidence": _confidence_to_level(pattern.confidence),
                        "basedOnPattern": f"{pattern.setting_category}:{pattern.setting_key}"
                    })

    # Sort by confidence (high first) and limit to top 5
    recommendations.sort(key=lambda r: {"high": 3, "medium": 2, "low": 1}.get(r["confidence"], 0), reverse=True)
    return recommendations[:5]


def _settings_match_pattern(setting_key: str, pattern: DetectedPattern) -> bool:
    """Check if a setting key matches a pattern's preferences."""
    setting_lower = setting_key.lower()
    pattern_key_lower = pattern.setting_key.lower()

    # Direct match
    if pattern_key_lower in setting_lower or setting_lower in pattern_key_lower:
        return True

    # FPS-related pattern matches FPS-boosting settings
    if "fps" in pattern_key_lower:
        fps_settings = ["shadows", "anti_aliasing", "vsync", "ray_tracing", "effects"]
        if any(s in setting_lower for s in fps_settings):
            return True

    # Quality-related pattern matches quality settings
    if "quality" in pattern_key_lower:
        quality_settings = ["texture", "quality", "detail", "resolution"]
        if any(s in setting_lower for s in quality_settings):
            return True

    return False


def get_recommendations_for_game(game_id: str, game_name: str) -> Dict:
    """
    Get personalized recommendations for a specific game.

    Loads user patterns and available settings for the game,
    then generates recommendations based on the user's preferences.

    Args:
        game_id: Game identifier (e.g., "730" for CS2)
        game_name: Game display name

    Returns:
        Dictionary with recommendations, generation timestamp, and pattern count.
    """
    # Load user patterns
    patterns = analyze_patterns()

    if not patterns:
        return {
            "recommendations": [],
            "generatedAt": int(time.time() * 1000),
            "patternCount": 0
        }

    # Load available settings for this game
    from opta_mcp.game_settings import get_game_settings

    game_settings = get_game_settings(game_id)

    if not game_settings or game_settings.get("source") == "generic":
        # No specific settings for this game
        return {
            "recommendations": [],
            "generatedAt": int(time.time() * 1000),
            "patternCount": len(patterns)
        }

    available_settings = game_settings.get("settings", {})

    # Generate recommendations
    recommendations = generate_recommendations(
        game_id,
        game_name,
        available_settings,
        patterns
    )

    return {
        "recommendations": recommendations,
        "generatedAt": int(time.time() * 1000),
        "patternCount": len(patterns)
    }
