"""Content-based recommendation engine for optimizations.

Analyzes user behavior and system state to provide personalized
optimization recommendations.
"""

import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Set
import statistics


class RecommendationType(Enum):
    """Types of recommendations."""
    PERFORMANCE = "performance"
    POWER_SAVING = "power_saving"
    COOLING = "cooling"
    MEMORY = "memory"
    STORAGE = "storage"
    GAMING = "gaming"
    PRODUCTIVITY = "productivity"


class RecommendationPriority(Enum):
    """Priority levels for recommendations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class Recommendation:
    """A personalized optimization recommendation."""
    id: str
    type: RecommendationType
    priority: RecommendationPriority
    title: str
    description: str
    impact_estimate: str  # e.g., "+15% FPS", "-5°C"
    confidence: float  # 0-1
    actions: List[Dict]  # Steps to implement
    reasons: List[str]  # Why this is recommended
    dismissed: bool = False
    applied: bool = False
    created_at: float = field(default_factory=lambda: time.time() * 1000)


@dataclass
class UserContext:
    """User context for personalization."""
    primary_use: str  # gaming, productivity, mixed
    expertise_level: str  # beginner, intermediate, advanced
    preferred_style: str  # conservative, balanced, aggressive
    active_games: List[str] = field(default_factory=list)
    thermal_sensitivity: str = "balanced"  # cool, balanced, performance


class RecommendationEngine:
    """Generates personalized optimization recommendations.

    Uses content-based filtering to match recommendations to user
    context and current system state.
    """

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path.home() / ".opta"
        self.recommendations_file = self.data_dir / "recommendations.json"
        self.feedback_file = self.data_dir / "recommendation_feedback.json"

        self._recommendations: Dict[str, Recommendation] = {}
        self._feedback: Dict[str, Dict] = {}  # {rec_id: {helpful: bool, applied: bool}}
        self._user_context: Optional[UserContext] = None
        self._recommendation_counter = 0

        self._load_feedback()

    def _load_feedback(self) -> None:
        """Load historical feedback data."""
        try:
            if self.feedback_file.exists():
                with open(self.feedback_file, 'r') as f:
                    self._feedback = json.load(f)
        except Exception:
            self._feedback = {}

    def _save_feedback(self) -> None:
        """Save feedback data."""
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            with open(self.feedback_file, 'w') as f:
                json.dump(self._feedback, f)
        except Exception:
            pass

    def _generate_id(self) -> str:
        """Generate unique recommendation ID."""
        self._recommendation_counter += 1
        return f"rec_{int(time.time())}_{self._recommendation_counter}"

    def set_user_context(self, context: UserContext) -> None:
        """Set user context for personalization."""
        self._user_context = context

    def _calculate_recommendation_score(
        self,
        rec_type: RecommendationType,
        system_state: Dict
    ) -> float:
        """Calculate relevance score for a recommendation type."""
        score = 0.5  # Base score

        if self._user_context:
            # Boost based on user preferences
            if self._user_context.primary_use == "gaming":
                if rec_type in [RecommendationType.GAMING, RecommendationType.PERFORMANCE]:
                    score += 0.3
            elif self._user_context.primary_use == "productivity":
                if rec_type in [RecommendationType.PRODUCTIVITY, RecommendationType.POWER_SAVING]:
                    score += 0.3

            # Thermal sensitivity
            if self._user_context.thermal_sensitivity == "cool":
                if rec_type == RecommendationType.COOLING:
                    score += 0.2

        # Boost based on system state
        cpu_usage = system_state.get("cpu_percent", 0)
        memory_usage = system_state.get("memory_percent", 0)
        gpu_temp = system_state.get("gpu_temp")

        if cpu_usage > 80 and rec_type == RecommendationType.PERFORMANCE:
            score += 0.2
        if memory_usage > 80 and rec_type == RecommendationType.MEMORY:
            score += 0.3
        if gpu_temp and gpu_temp > 80 and rec_type == RecommendationType.COOLING:
            score += 0.3

        # Penalize based on negative feedback history
        similar_dismissed = sum(
            1 for rid, fb in self._feedback.items()
            if fb.get("type") == rec_type.value and not fb.get("helpful", True)
        )
        score -= similar_dismissed * 0.1

        return min(1.0, max(0.0, score))

    def generate_recommendations(
        self,
        system_state: Dict,
        max_recommendations: int = 5
    ) -> List[Recommendation]:
        """Generate personalized recommendations based on system state.

        Args:
            system_state: Current system telemetry
            max_recommendations: Maximum number of recommendations

        Returns:
            List of recommendations sorted by priority and relevance
        """
        recommendations = []

        cpu_usage = system_state.get("cpu_percent", 0)
        memory_usage = system_state.get("memory_percent", 0)
        gpu_usage = system_state.get("gpu_percent")
        gpu_temp = system_state.get("gpu_temp")
        disk_percent = system_state.get("disk_percent", 0)

        # High CPU usage recommendations
        if cpu_usage > 75:
            score = self._calculate_recommendation_score(
                RecommendationType.PERFORMANCE, system_state
            )
            if score > 0.4:
                recommendations.append(Recommendation(
                    id=self._generate_id(),
                    type=RecommendationType.PERFORMANCE,
                    priority=RecommendationPriority.HIGH if cpu_usage > 85 else RecommendationPriority.MEDIUM,
                    title="Reduce CPU Load",
                    description=f"CPU usage is at {cpu_usage:.0f}%. Consider closing background applications.",
                    impact_estimate="-10-20% CPU usage",
                    confidence=score,
                    actions=[
                        {"action": "stealth_mode", "label": "Run Stealth Mode to close safe-to-kill processes"},
                        {"action": "view_processes", "label": "View running processes to identify heavy consumers"},
                    ],
                    reasons=[
                        f"CPU usage ({cpu_usage:.0f}%) is above optimal threshold",
                        "High CPU usage can cause slowdowns and increased heat",
                    ],
                ))

        # High memory usage recommendations
        if memory_usage > 80:
            score = self._calculate_recommendation_score(
                RecommendationType.MEMORY, system_state
            )
            if score > 0.4:
                recommendations.append(Recommendation(
                    id=self._generate_id(),
                    type=RecommendationType.MEMORY,
                    priority=RecommendationPriority.HIGH if memory_usage > 90 else RecommendationPriority.MEDIUM,
                    title="Free Up Memory",
                    description=f"Memory usage is at {memory_usage:.0f}%. System may become unresponsive.",
                    impact_estimate="-15-30% memory usage",
                    confidence=score,
                    actions=[
                        {"action": "stealth_mode", "label": "Run Stealth Mode to free memory"},
                        {"action": "close_browsers", "label": "Close unused browser tabs"},
                        {"action": "restart_heavy", "label": "Restart memory-heavy applications"},
                    ],
                    reasons=[
                        f"Memory usage ({memory_usage:.0f}%) is critically high",
                        "Low available memory causes system slowdowns",
                        "Applications may crash if memory runs out",
                    ],
                ))

        # GPU thermal recommendations
        if gpu_temp and gpu_temp > 80:
            score = self._calculate_recommendation_score(
                RecommendationType.COOLING, system_state
            )
            if score > 0.4:
                priority = RecommendationPriority.URGENT if gpu_temp > 90 else RecommendationPriority.HIGH
                recommendations.append(Recommendation(
                    id=self._generate_id(),
                    type=RecommendationType.COOLING,
                    priority=priority,
                    title="Reduce GPU Temperature",
                    description=f"GPU temperature is {gpu_temp:.0f}°C. Risk of thermal throttling.",
                    impact_estimate=f"-5-15°C",
                    confidence=score,
                    actions=[
                        {"action": "reduce_fps", "label": "Enable FPS limiter to reduce GPU load"},
                        {"action": "adjust_fan", "label": "Increase fan speed"},
                        {"action": "lower_settings", "label": "Lower game graphics settings"},
                    ],
                    reasons=[
                        f"GPU temperature ({gpu_temp:.0f}°C) exceeds safe threshold",
                        "Thermal throttling reduces performance automatically",
                        "Extended high temps can reduce hardware lifespan",
                    ],
                ))

        # Gaming-specific recommendations
        if self._user_context and self._user_context.primary_use == "gaming":
            if gpu_usage and gpu_usage < 70 and cpu_usage > 80:
                score = self._calculate_recommendation_score(
                    RecommendationType.GAMING, system_state
                )
                if score > 0.4:
                    recommendations.append(Recommendation(
                        id=self._generate_id(),
                        type=RecommendationType.GAMING,
                        priority=RecommendationPriority.MEDIUM,
                        title="CPU Bottleneck Detected",
                        description="Your CPU is limiting GPU performance. Consider game settings adjustments.",
                        impact_estimate="+10-25% FPS",
                        confidence=score,
                        actions=[
                            {"action": "increase_resolution", "label": "Increase resolution to shift load to GPU"},
                            {"action": "enable_vsync", "label": "Enable VSync to reduce CPU overhead"},
                            {"action": "close_background", "label": "Close background applications"},
                        ],
                        reasons=[
                            f"CPU ({cpu_usage:.0f}%) is working harder than GPU ({gpu_usage:.0f}%)",
                            "This indicates a CPU bottleneck limiting frame rates",
                            "Shifting work to GPU can improve overall performance",
                        ],
                    ))

        # Disk space recommendations
        if disk_percent > 85:
            score = self._calculate_recommendation_score(
                RecommendationType.STORAGE, system_state
            )
            if score > 0.4:
                recommendations.append(Recommendation(
                    id=self._generate_id(),
                    type=RecommendationType.STORAGE,
                    priority=RecommendationPriority.MEDIUM,
                    title="Low Disk Space",
                    description=f"Disk is {disk_percent:.0f}% full. May affect system performance.",
                    impact_estimate="Free 10-50GB space",
                    confidence=score,
                    actions=[
                        {"action": "view_disk", "label": "View disk usage treemap"},
                        {"action": "clear_cache", "label": "Clear application caches"},
                        {"action": "empty_trash", "label": "Empty trash/recycle bin"},
                    ],
                    reasons=[
                        f"Disk usage ({disk_percent:.0f}%) is high",
                        "SSDs slow down when nearly full",
                        "System needs free space for virtual memory",
                    ],
                ))

        # Power saving recommendations (for non-gaming contexts)
        if self._user_context and self._user_context.primary_use == "productivity":
            if cpu_usage < 30 and (gpu_usage is None or gpu_usage < 20):
                score = self._calculate_recommendation_score(
                    RecommendationType.POWER_SAVING, system_state
                )
                if score > 0.5:
                    recommendations.append(Recommendation(
                        id=self._generate_id(),
                        type=RecommendationType.POWER_SAVING,
                        priority=RecommendationPriority.LOW,
                        title="Enable Power Saving Mode",
                        description="System is idle. Consider power saving settings.",
                        impact_estimate="Extended battery life",
                        confidence=score,
                        actions=[
                            {"action": "enable_power_save", "label": "Switch to power saving mode"},
                            {"action": "reduce_brightness", "label": "Reduce screen brightness"},
                        ],
                        reasons=[
                            "System resources are underutilized",
                            "Power saving can extend battery life significantly",
                        ],
                    ))

        # Sort by priority and confidence
        priority_order = {
            RecommendationPriority.URGENT: 0,
            RecommendationPriority.HIGH: 1,
            RecommendationPriority.MEDIUM: 2,
            RecommendationPriority.LOW: 3,
        }
        recommendations.sort(
            key=lambda r: (priority_order[r.priority], -r.confidence)
        )

        # Store and return top recommendations
        result = recommendations[:max_recommendations]
        for rec in result:
            self._recommendations[rec.id] = rec

        return result

    def dismiss_recommendation(self, rec_id: str, helpful: bool = False) -> bool:
        """Dismiss a recommendation and record feedback."""
        if rec_id in self._recommendations:
            rec = self._recommendations[rec_id]
            rec.dismissed = True

            self._feedback[rec_id] = {
                "type": rec.type.value,
                "helpful": helpful,
                "dismissed_at": time.time(),
            }
            self._save_feedback()
            return True
        return False

    def mark_applied(self, rec_id: str) -> bool:
        """Mark a recommendation as applied."""
        if rec_id in self._recommendations:
            rec = self._recommendations[rec_id]
            rec.applied = True

            self._feedback[rec_id] = {
                "type": rec.type.value,
                "helpful": True,
                "applied": True,
                "applied_at": time.time(),
            }
            self._save_feedback()
            return True
        return False

    def get_active_recommendations(self) -> List[Recommendation]:
        """Get recommendations that haven't been dismissed or applied."""
        return [
            rec for rec in self._recommendations.values()
            if not rec.dismissed and not rec.applied
        ]


# Global engine instance
_engine = RecommendationEngine()


def set_user_context(
    primary_use: str = "mixed",
    expertise_level: str = "intermediate",
    preferred_style: str = "balanced",
    thermal_sensitivity: str = "balanced"
) -> None:
    """Set user context for personalization."""
    context = UserContext(
        primary_use=primary_use,
        expertise_level=expertise_level,
        preferred_style=preferred_style,
        thermal_sensitivity=thermal_sensitivity,
    )
    _engine.set_user_context(context)


def generate_recommendations(
    cpu_percent: float,
    memory_percent: float,
    disk_percent: float = 0,
    gpu_percent: Optional[float] = None,
    gpu_temp: Optional[float] = None,
    max_recommendations: int = 5
) -> List[dict]:
    """Generate recommendations based on system state."""
    system_state = {
        "cpu_percent": cpu_percent,
        "memory_percent": memory_percent,
        "disk_percent": disk_percent,
        "gpu_percent": gpu_percent,
        "gpu_temp": gpu_temp,
    }

    recommendations = _engine.generate_recommendations(system_state, max_recommendations)

    return [
        {
            "id": r.id,
            "type": r.type.value,
            "priority": r.priority.value,
            "title": r.title,
            "description": r.description,
            "impactEstimate": r.impact_estimate,
            "confidence": r.confidence,
            "actions": r.actions,
            "reasons": r.reasons,
            "createdAt": r.created_at,
        }
        for r in recommendations
    ]


def dismiss_recommendation(rec_id: str, helpful: bool = False) -> bool:
    """Dismiss a recommendation."""
    return _engine.dismiss_recommendation(rec_id, helpful)


def mark_recommendation_applied(rec_id: str) -> bool:
    """Mark a recommendation as applied."""
    return _engine.mark_applied(rec_id)


def get_active_recommendations() -> List[dict]:
    """Get active recommendations."""
    recommendations = _engine.get_active_recommendations()
    return [
        {
            "id": r.id,
            "type": r.type.value,
            "priority": r.priority.value,
            "title": r.title,
            "description": r.description,
            "impactEstimate": r.impact_estimate,
            "confidence": r.confidence,
            "actions": r.actions,
            "reasons": r.reasons,
            "createdAt": r.created_at,
        }
        for r in recommendations
    ]
