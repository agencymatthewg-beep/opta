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
