"""Expertise detection and adaptation.

Detects user expertise from behavioral signals and adapts UI complexity:
- simple: New users, < 5 sessions, rarely uses technical features
- standard: Regular users, 5-20 sessions, moderate technical usage
- power: Advanced users, > 20 sessions, frequently uses technical features
"""

import json
import time
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, Any, List

OPTA_DIR = Path.home() / ".opta"
EXPERTISE_FILE = OPTA_DIR / "expertise.json"


@dataclass
class ExpertiseSignals:
    """Behavioral signals for expertise detection."""
    uses_technical_features: int = 0  # 0-100
    reads_documentation: int = 0
    uses_shortcuts: int = 0
    expands_technical_details: int = 0
    uses_investigation_mode: int = 0
    time_in_app: int = 0  # minutes
    sessions_count: int = 0
    optimizations_applied: int = 0


@dataclass
class ExpertiseLevelChange:
    """Record of an expertise level change."""
    timestamp: int  # milliseconds
    from_level: str
    to_level: str
    reason: str


def detect_expertise_level(signals: Dict[str, Any]) -> Dict[str, Any]:
    """
    Detect expertise level from behavioral signals.

    Algorithm:
    - Simple: New users, < 5 sessions, rarely uses technical features
    - Standard: Regular users, 5-20 sessions, moderate technical usage
    - Power: Advanced users, > 20 sessions, frequently uses technical features

    Returns dict with currentLevel, confidence, and compositeScore.
    """
    # Convert snake_case keys from storage to our expected format
    s = ExpertiseSignals(
        uses_technical_features=signals.get("uses_technical_features", signals.get("usesTechnicalFeatures", 0)),
        reads_documentation=signals.get("reads_documentation", signals.get("readsDocumentation", 0)),
        uses_shortcuts=signals.get("uses_shortcuts", signals.get("usesShortcuts", 0)),
        expands_technical_details=signals.get("expands_technical_details", signals.get("expandsTechnicalDetails", 0)),
        uses_investigation_mode=signals.get("uses_investigation_mode", signals.get("usesInvestigationMode", 0)),
        time_in_app=signals.get("time_in_app", signals.get("timeInApp", 0)),
        sessions_count=signals.get("sessions_count", signals.get("sessionsCount", 0)),
        optimizations_applied=signals.get("optimizations_applied", signals.get("optimizationsApplied", 0)),
    )

    # Calculate composite score (0-100)
    # Weight technical behaviors more heavily
    technical_score = (
        s.uses_technical_features * 0.25 +
        s.expands_technical_details * 0.2 +
        s.uses_investigation_mode * 0.25 +
        s.uses_shortcuts * 0.15 +
        s.reads_documentation * 0.15
    )

    # Time/usage factor - experience grows with usage
    usage_factor = min(
        (s.sessions_count / 20) * 50 +
        (s.optimizations_applied / 10) * 50,
        100
    )

    # Combined score - technical behavior weighted more
    composite = (technical_score * 0.7 + usage_factor * 0.3)

    # Determine level and confidence
    if composite < 30:
        level = "simple"
        # More confident at lower scores for simple users
        confidence = 100 - composite
    elif composite < 65:
        level = "standard"
        # Most confident at middle range (around 47.5)
        confidence = 100 - abs(composite - 47.5) * 2
    else:
        level = "power"
        # More confident at higher scores for power users
        confidence = min(composite, 100)

    return {
        "currentLevel": level,
        "confidence": int(confidence),
        "compositeScore": int(composite),
    }


def record_signal(signal_name: str, value: int) -> Dict[str, Any]:
    """
    Record a behavioral signal and recalculate expertise.

    Args:
        signal_name: Name of the signal (snake_case)
        value: Value to record (0-100 for rates, raw numbers for counts)

    Returns:
        Updated expertise profile
    """
    profile = load_expertise_profile()
    signals = profile.get("signals", {})

    # Map camelCase to snake_case for storage consistency
    signal_map = {
        "usesTechnicalFeatures": "uses_technical_features",
        "readsDocumentation": "reads_documentation",
        "usesShortcuts": "uses_shortcuts",
        "expandsTechnicalDetails": "expands_technical_details",
        "usesInvestigationMode": "uses_investigation_mode",
        "timeInApp": "time_in_app",
        "sessionsCount": "sessions_count",
        "optimizationsApplied": "optimizations_applied",
    }

    # Normalize signal name to snake_case
    normalized_name = signal_map.get(signal_name, signal_name)

    # Handle different signal types
    if normalized_name in ["sessions_count", "optimizations_applied", "time_in_app"]:
        # Increment counters
        current = signals.get(normalized_name, 0)
        signals[normalized_name] = current + value
    else:
        # Weighted average for behavioral signals
        current = signals.get(normalized_name, 0)
        # 70% previous, 30% new - gradual adjustment
        signals[normalized_name] = int(current * 0.7 + value * 0.3)

    profile["signals"] = signals

    # Recalculate level if no manual override
    if not profile.get("manualOverride"):
        old_level = profile.get("currentLevel", "standard")
        detection = detect_expertise_level(signals)
        new_level = detection["currentLevel"]

        # Record level change if it occurred
        if old_level != new_level:
            history = profile.get("history", [])
            history.append({
                "timestamp": int(time.time() * 1000),
                "from": old_level,
                "to": new_level,
                "reason": f"Auto-detected from signal: {signal_name}",
            })
            # Keep only last 10 changes
            profile["history"] = history[-10:]

        profile["currentLevel"] = new_level
        profile["confidence"] = detection["confidence"]

    save_expertise_profile(profile)
    return _format_profile_for_frontend(profile)


def set_manual_override(level: Optional[str]) -> Dict[str, Any]:
    """
    Set or clear manual expertise override.

    Args:
        level: Expertise level to set, or None to clear override

    Returns:
        Updated expertise profile
    """
    profile = load_expertise_profile()
    old_level = profile.get("currentLevel", "standard")

    profile["manualOverride"] = level

    if level:
        # Set to manual level with 100% confidence
        profile["currentLevel"] = level
        profile["confidence"] = 100

        # Record the change
        if old_level != level:
            history = profile.get("history", [])
            history.append({
                "timestamp": int(time.time() * 1000),
                "from": old_level,
                "to": level,
                "reason": "Manual override by user",
            })
            profile["history"] = history[-10:]
    else:
        # Clear override, recalculate from signals
        detection = detect_expertise_level(profile.get("signals", {}))
        new_level = detection["currentLevel"]

        if old_level != new_level:
            history = profile.get("history", [])
            history.append({
                "timestamp": int(time.time() * 1000),
                "from": old_level,
                "to": new_level,
                "reason": "Override cleared, auto-detected",
            })
            profile["history"] = history[-10:]

        profile["currentLevel"] = new_level
        profile["confidence"] = detection["confidence"]

    save_expertise_profile(profile)
    return _format_profile_for_frontend(profile)


def load_expertise_profile() -> Dict[str, Any]:
    """Load expertise profile from disk."""
    if EXPERTISE_FILE.exists():
        try:
            return json.loads(EXPERTISE_FILE.read_text())
        except (json.JSONDecodeError, IOError):
            pass

    # Return default profile
    return {
        "currentLevel": "standard",
        "confidence": 50,
        "signals": asdict(ExpertiseSignals()),
        "history": [],
        "manualOverride": None,
    }


def save_expertise_profile(profile: Dict[str, Any]) -> None:
    """Save expertise profile to disk."""
    OPTA_DIR.mkdir(parents=True, exist_ok=True)
    EXPERTISE_FILE.write_text(json.dumps(profile, indent=2))


def get_expertise_profile() -> Dict[str, Any]:
    """Get current expertise profile formatted for frontend."""
    profile = load_expertise_profile()
    return _format_profile_for_frontend(profile)


def _format_profile_for_frontend(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Convert profile to camelCase for frontend consumption."""
    signals = profile.get("signals", {})

    # Convert snake_case signals to camelCase
    camel_signals = {
        "usesTechnicalFeatures": signals.get("uses_technical_features", 0),
        "readsDocumentation": signals.get("reads_documentation", 0),
        "usesShortcuts": signals.get("uses_shortcuts", 0),
        "expandsTechnicalDetails": signals.get("expands_technical_details", 0),
        "usesInvestigationMode": signals.get("uses_investigation_mode", 0),
        "timeInApp": signals.get("time_in_app", 0),
        "sessionsCount": signals.get("sessions_count", 0),
        "optimizationsApplied": signals.get("optimizations_applied", 0),
    }

    # Convert history format
    history = []
    for h in profile.get("history", []):
        history.append({
            "timestamp": h.get("timestamp"),
            "from": h.get("from", h.get("from_level")),
            "to": h.get("to", h.get("to_level")),
            "reason": h.get("reason"),
        })

    return {
        "currentLevel": profile.get("currentLevel", "standard"),
        "confidence": profile.get("confidence", 50),
        "signals": camel_signals,
        "history": history,
        "manualOverride": profile.get("manualOverride"),
    }
