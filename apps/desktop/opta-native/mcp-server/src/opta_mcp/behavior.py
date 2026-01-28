"""Behavior pattern detection for user activity.

Detects patterns in user activity including:
- Gaming hours (high GPU/CPU activity)
- Work hours (moderate, steady usage)
- Idle periods
- Sleep patterns
- Usage trends by day of week
"""

import json
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import statistics


class ActivityType(Enum):
    """Types of user activity."""
    GAMING = "gaming"
    PRODUCTIVITY = "productivity"
    MEDIA = "media"
    IDLE = "idle"
    SLEEP = "sleep"
    UNKNOWN = "unknown"


@dataclass
class ActivityWindow:
    """A window of detected activity."""
    type: ActivityType
    start_time: float  # Unix timestamp
    end_time: float
    avg_cpu: float
    avg_memory: float
    avg_gpu: Optional[float]
    confidence: float


@dataclass
class DailyPattern:
    """Pattern of activity for a specific hour of day."""
    hour: int  # 0-23
    dominant_activity: ActivityType
    confidence: float
    avg_cpu: float
    avg_memory: float
    sample_count: int


@dataclass
class WeeklyPattern:
    """Pattern of activity for a specific day of week."""
    day: int  # 0=Monday, 6=Sunday
    active_hours: List[int]  # Hours when typically active
    gaming_hours: List[int]  # Hours when typically gaming
    work_hours: List[int]  # Hours when typically working
    avg_daily_screen_time: float  # Hours


class BehaviorDetector:
    """Detects and learns user behavior patterns.

    Uses rolling statistics and time-based bucketing to identify
    when users typically game, work, or are idle.
    """

    # Activity detection thresholds
    GAMING_GPU_THRESHOLD = 60.0  # GPU usage above this = gaming
    GAMING_CPU_THRESHOLD = 40.0  # CPU must also be elevated
    PRODUCTIVITY_CPU_THRESHOLD = 20.0  # Moderate CPU = productivity
    IDLE_THRESHOLD = 5.0  # Below this = idle

    # Time bucketing
    BUCKET_MINUTES = 15  # Aggregate data in 15-minute buckets
    HISTORY_DAYS = 14  # Keep 2 weeks of history

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path.home() / ".opta"
        self.patterns_file = self.data_dir / "behavior_patterns.json"

        # In-memory storage
        self._current_window: Optional[ActivityWindow] = None
        self._recent_samples: List[Dict] = []  # Last hour of samples
        self._hourly_stats: Dict[int, Dict] = defaultdict(lambda: {
            "samples": [],
            "gaming_count": 0,
            "work_count": 0,
            "idle_count": 0,
        })
        self._daily_stats: Dict[int, Dict] = defaultdict(lambda: {
            "active_hours": set(),
            "gaming_hours": set(),
            "work_hours": set(),
            "total_samples": 0,
        })

        self._load_patterns()

    def _load_patterns(self) -> None:
        """Load historical patterns from disk."""
        try:
            if self.patterns_file.exists():
                with open(self.patterns_file, 'r') as f:
                    data = json.load(f)
                    # Restore hourly stats
                    for hour_str, stats in data.get("hourly", {}).items():
                        hour = int(hour_str)
                        self._hourly_stats[hour] = stats
                        self._hourly_stats[hour]["samples"] = stats.get("samples", [])
                    # Restore daily stats
                    for day_str, stats in data.get("daily", {}).items():
                        day = int(day_str)
                        self._daily_stats[day] = {
                            "active_hours": set(stats.get("active_hours", [])),
                            "gaming_hours": set(stats.get("gaming_hours", [])),
                            "work_hours": set(stats.get("work_hours", [])),
                            "total_samples": stats.get("total_samples", 0),
                        }
        except Exception:
            pass

    def _save_patterns(self) -> None:
        """Save patterns to disk."""
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)

            data = {
                "hourly": {
                    str(hour): {
                        "samples": stats["samples"][-100:],  # Keep last 100 samples per hour
                        "gaming_count": stats["gaming_count"],
                        "work_count": stats["work_count"],
                        "idle_count": stats["idle_count"],
                    }
                    for hour, stats in self._hourly_stats.items()
                },
                "daily": {
                    str(day): {
                        "active_hours": list(stats["active_hours"]),
                        "gaming_hours": list(stats["gaming_hours"]),
                        "work_hours": list(stats["work_hours"]),
                        "total_samples": stats["total_samples"],
                    }
                    for day, stats in self._daily_stats.items()
                },
                "saved_at": time.time(),
            }

            with open(self.patterns_file, 'w') as f:
                json.dump(data, f)
        except Exception:
            pass

    def _classify_activity(
        self,
        cpu_percent: float,
        memory_percent: float,
        gpu_percent: Optional[float]
    ) -> Tuple[ActivityType, float]:
        """Classify activity type based on resource usage.

        Returns:
            Tuple of (ActivityType, confidence)
        """
        # Check for gaming (high GPU + moderate CPU)
        if gpu_percent is not None and gpu_percent > self.GAMING_GPU_THRESHOLD:
            if cpu_percent > self.GAMING_CPU_THRESHOLD:
                confidence = min(1.0, (gpu_percent - self.GAMING_GPU_THRESHOLD) / 30)
                return ActivityType.GAMING, confidence

        # Check for idle
        if cpu_percent < self.IDLE_THRESHOLD and memory_percent < 50:
            confidence = 1.0 - (cpu_percent / self.IDLE_THRESHOLD)
            return ActivityType.IDLE, confidence

        # Check for productivity (moderate steady usage)
        if cpu_percent > self.PRODUCTIVITY_CPU_THRESHOLD:
            if gpu_percent is None or gpu_percent < 30:
                confidence = min(1.0, (cpu_percent - self.PRODUCTIVITY_CPU_THRESHOLD) / 40)
                return ActivityType.PRODUCTIVITY, confidence

        # Media consumption (moderate CPU, possibly high GPU for video)
        if gpu_percent is not None and gpu_percent > 20 and cpu_percent < 40:
            return ActivityType.MEDIA, 0.6

        return ActivityType.UNKNOWN, 0.3

    def record_sample(
        self,
        cpu_percent: float,
        memory_percent: float,
        gpu_percent: Optional[float] = None
    ) -> Optional[ActivityWindow]:
        """Record a telemetry sample and detect activity changes.

        Returns:
            ActivityWindow if activity type changed, None otherwise
        """
        now = time.time()
        now_dt = datetime.fromtimestamp(now)
        hour = now_dt.hour
        day = now_dt.weekday()

        # Classify current activity
        activity_type, confidence = self._classify_activity(
            cpu_percent, memory_percent, gpu_percent
        )

        # Store sample
        sample = {
            "timestamp": now,
            "cpu": cpu_percent,
            "memory": memory_percent,
            "gpu": gpu_percent,
            "activity": activity_type.value,
            "confidence": confidence,
        }
        self._recent_samples.append(sample)

        # Keep only last hour of samples
        cutoff = now - 3600
        self._recent_samples = [s for s in self._recent_samples if s["timestamp"] > cutoff]

        # Update hourly stats
        self._hourly_stats[hour]["samples"].append(sample)
        if activity_type == ActivityType.GAMING:
            self._hourly_stats[hour]["gaming_count"] += 1
        elif activity_type == ActivityType.PRODUCTIVITY:
            self._hourly_stats[hour]["work_count"] += 1
        elif activity_type == ActivityType.IDLE:
            self._hourly_stats[hour]["idle_count"] += 1

        # Update daily stats
        self._daily_stats[day]["total_samples"] += 1
        if activity_type != ActivityType.IDLE and activity_type != ActivityType.SLEEP:
            self._daily_stats[day]["active_hours"].add(hour)
        if activity_type == ActivityType.GAMING:
            self._daily_stats[day]["gaming_hours"].add(hour)
        if activity_type == ActivityType.PRODUCTIVITY:
            self._daily_stats[day]["work_hours"].add(hour)

        # Check for activity window change
        result = None
        if self._current_window is None:
            self._current_window = ActivityWindow(
                type=activity_type,
                start_time=now,
                end_time=now,
                avg_cpu=cpu_percent,
                avg_memory=memory_percent,
                avg_gpu=gpu_percent,
                confidence=confidence,
            )
        elif self._current_window.type != activity_type and confidence > 0.5:
            # Activity changed - close current window and start new one
            self._current_window.end_time = now
            result = self._current_window

            self._current_window = ActivityWindow(
                type=activity_type,
                start_time=now,
                end_time=now,
                avg_cpu=cpu_percent,
                avg_memory=memory_percent,
                avg_gpu=gpu_percent,
                confidence=confidence,
            )
        else:
            # Update current window
            self._current_window.end_time = now
            # Rolling average
            n = len(self._recent_samples)
            self._current_window.avg_cpu = (
                self._current_window.avg_cpu * (n - 1) + cpu_percent
            ) / n
            self._current_window.avg_memory = (
                self._current_window.avg_memory * (n - 1) + memory_percent
            ) / n
            if gpu_percent is not None and self._current_window.avg_gpu is not None:
                self._current_window.avg_gpu = (
                    self._current_window.avg_gpu * (n - 1) + gpu_percent
                ) / n

        # Periodically save patterns (every 5 minutes)
        if int(now) % 300 < 2:
            self._save_patterns()

        return result

    def get_daily_patterns(self) -> List[DailyPattern]:
        """Get patterns for each hour of the day."""
        patterns = []

        for hour in range(24):
            stats = self._hourly_stats.get(hour, {})
            total = (
                stats.get("gaming_count", 0) +
                stats.get("work_count", 0) +
                stats.get("idle_count", 0)
            )

            if total < 10:
                # Not enough data
                patterns.append(DailyPattern(
                    hour=hour,
                    dominant_activity=ActivityType.UNKNOWN,
                    confidence=0.0,
                    avg_cpu=0.0,
                    avg_memory=0.0,
                    sample_count=total,
                ))
                continue

            # Determine dominant activity
            gaming_pct = stats.get("gaming_count", 0) / total
            work_pct = stats.get("work_count", 0) / total
            idle_pct = stats.get("idle_count", 0) / total

            if gaming_pct > 0.4:
                dominant = ActivityType.GAMING
                confidence = gaming_pct
            elif work_pct > 0.4:
                dominant = ActivityType.PRODUCTIVITY
                confidence = work_pct
            elif idle_pct > 0.6:
                dominant = ActivityType.IDLE
                confidence = idle_pct
            else:
                dominant = ActivityType.UNKNOWN
                confidence = 0.3

            # Calculate averages from samples
            samples = stats.get("samples", [])
            avg_cpu = statistics.mean([s["cpu"] for s in samples]) if samples else 0
            avg_memory = statistics.mean([s["memory"] for s in samples]) if samples else 0

            patterns.append(DailyPattern(
                hour=hour,
                dominant_activity=dominant,
                confidence=confidence,
                avg_cpu=avg_cpu,
                avg_memory=avg_memory,
                sample_count=total,
            ))

        return patterns

    def get_weekly_patterns(self) -> List[WeeklyPattern]:
        """Get patterns for each day of the week."""
        patterns = []

        for day in range(7):
            stats = self._daily_stats.get(day, {})

            active_hours = sorted(stats.get("active_hours", set()))
            gaming_hours = sorted(stats.get("gaming_hours", set()))
            work_hours = sorted(stats.get("work_hours", set()))

            # Estimate screen time
            avg_screen_time = len(active_hours) * 0.8  # Rough estimate

            patterns.append(WeeklyPattern(
                day=day,
                active_hours=active_hours,
                gaming_hours=gaming_hours,
                work_hours=work_hours,
                avg_daily_screen_time=avg_screen_time,
            ))

        return patterns

    def get_current_activity(self) -> Optional[Dict]:
        """Get current activity window."""
        if self._current_window:
            return {
                "type": self._current_window.type.value,
                "startTime": self._current_window.start_time * 1000,
                "endTime": self._current_window.end_time * 1000,
                "avgCpu": round(self._current_window.avg_cpu, 1),
                "avgMemory": round(self._current_window.avg_memory, 1),
                "avgGpu": round(self._current_window.avg_gpu, 1) if self._current_window.avg_gpu else None,
                "confidence": round(self._current_window.confidence, 2),
                "durationMinutes": round((self._current_window.end_time - self._current_window.start_time) / 60, 1),
            }
        return None

    def predict_activity(self, hours_ahead: int = 1) -> Dict:
        """Predict likely activity for the next N hours."""
        now = datetime.now()
        predictions = []

        daily_patterns = self.get_daily_patterns()

        for i in range(hours_ahead):
            future_time = now + timedelta(hours=i + 1)
            hour = future_time.hour
            day = future_time.weekday()

            pattern = daily_patterns[hour]

            predictions.append({
                "hour": hour,
                "day": day,
                "predictedActivity": pattern.dominant_activity.value,
                "confidence": round(pattern.confidence, 2),
                "expectedCpu": round(pattern.avg_cpu, 1),
                "expectedMemory": round(pattern.avg_memory, 1),
            })

        return {
            "predictions": predictions,
            "basedOnSamples": sum(p.sample_count for p in daily_patterns),
        }


# Global detector instance
_detector = BehaviorDetector()


def record_activity_sample(
    cpu_percent: float,
    memory_percent: float,
    gpu_percent: Optional[float] = None
) -> Optional[dict]:
    """Record an activity sample.

    Returns dict if activity type changed, None otherwise.
    """
    result = _detector.record_sample(cpu_percent, memory_percent, gpu_percent)
    if result:
        return {
            "type": result.type.value,
            "startTime": result.start_time * 1000,
            "endTime": result.end_time * 1000,
            "avgCpu": round(result.avg_cpu, 1),
            "avgMemory": round(result.avg_memory, 1),
            "avgGpu": round(result.avg_gpu, 1) if result.avg_gpu else None,
            "confidence": round(result.confidence, 2),
        }
    return None


def get_daily_patterns() -> List[dict]:
    """Get daily activity patterns."""
    patterns = _detector.get_daily_patterns()
    return [
        {
            "hour": p.hour,
            "dominantActivity": p.dominant_activity.value,
            "confidence": round(p.confidence, 2),
            "avgCpu": round(p.avg_cpu, 1),
            "avgMemory": round(p.avg_memory, 1),
            "sampleCount": p.sample_count,
        }
        for p in patterns
    ]


def get_weekly_patterns() -> List[dict]:
    """Get weekly activity patterns."""
    patterns = _detector.get_weekly_patterns()
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return [
        {
            "day": p.day,
            "dayName": day_names[p.day],
            "activeHours": p.active_hours,
            "gamingHours": p.gaming_hours,
            "workHours": p.work_hours,
            "avgDailyScreenTime": round(p.avg_daily_screen_time, 1),
        }
        for p in patterns
    ]


def get_current_activity() -> Optional[dict]:
    """Get current detected activity."""
    return _detector.get_current_activity()


def predict_activity(hours_ahead: int = 1) -> dict:
    """Predict future activity."""
    return _detector.predict_activity(hours_ahead)
