"""Anomaly detection for system telemetry.

Detects unusual patterns in CPU, memory, and GPU usage including:
- Sudden spikes
- Memory pressure (gradual climb without release)
- Unusual process behavior
- Thermal throttling risk
"""

import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple
import statistics


class AnomalyType(Enum):
    """Types of anomalies that can be detected."""
    CPU_SPIKE = "cpu_spike"
    MEMORY_PRESSURE = "memory_pressure"
    GPU_THERMAL = "gpu_thermal"
    UNUSUAL_BASELINE = "unusual_baseline"
    RAPID_CHANGE = "rapid_change"
    SUSTAINED_HIGH = "sustained_high"


class AnomalySeverity(Enum):
    """Severity levels for anomalies."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Anomaly:
    """Represents a detected anomaly."""
    id: str
    type: AnomalyType
    severity: AnomalySeverity
    metric: str  # cpu, memory, gpu
    timestamp: float
    current_value: float
    expected_value: float
    deviation: float  # How far from expected (std devs or percentage)
    message: str
    suggestion: str
    auto_dismiss_seconds: Optional[int] = None


@dataclass
class TelemetryStats:
    """Rolling statistics for a metric."""
    values: deque = field(default_factory=lambda: deque(maxlen=300))
    mean: float = 0.0
    std: float = 10.0
    min_seen: float = 100.0
    max_seen: float = 0.0
    last_update: float = 0.0

    def update(self, value: float) -> None:
        """Update statistics with new value."""
        self.values.append(value)
        self.last_update = time.time()

        if len(self.values) >= 10:
            self.mean = statistics.mean(self.values)
            self.std = statistics.stdev(self.values) if len(self.values) > 1 else 10.0

        self.min_seen = min(self.min_seen, value)
        self.max_seen = max(self.max_seen, value)


class AnomalyDetector:
    """Detects anomalies in system telemetry using statistical methods.

    Uses a combination of:
    - Z-score for sudden spikes
    - Trend analysis for memory pressure
    - Threshold-based for sustained high usage
    - Rate-of-change for rapid changes
    """

    # Detection thresholds
    SPIKE_Z_THRESHOLD = 3.0  # Standard deviations for spike detection
    MEMORY_PRESSURE_THRESHOLD = 80.0  # % memory that indicates pressure
    GPU_THERMAL_THRESHOLD = 85.0  # Temperature threshold
    SUSTAINED_HIGH_THRESHOLD = 85.0  # % usage sustained
    SUSTAINED_HIGH_DURATION = 60  # Seconds of high usage before alert
    RAPID_CHANGE_THRESHOLD = 20.0  # % change per second

    def __init__(self):
        self.stats: Dict[str, TelemetryStats] = {
            "cpu": TelemetryStats(),
            "memory": TelemetryStats(),
            "gpu": TelemetryStats(),
            "gpu_temp": TelemetryStats(),
        }
        self.active_anomalies: Dict[str, Anomaly] = {}
        self._sustained_high_start: Dict[str, Optional[float]] = {
            "cpu": None,
            "memory": None,
            "gpu": None,
        }
        self._last_values: Dict[str, float] = {}
        self._anomaly_counter = 0

    def _generate_id(self) -> str:
        """Generate unique anomaly ID."""
        self._anomaly_counter += 1
        return f"anomaly_{int(time.time())}_{self._anomaly_counter}"

    def _detect_spike(
        self,
        metric: str,
        value: float,
        stats: TelemetryStats
    ) -> Optional[Anomaly]:
        """Detect sudden spikes using Z-score."""
        if len(stats.values) < 20:
            return None  # Need baseline data

        if stats.std < 1.0:
            return None  # Low variance, spikes are normal fluctuation

        z_score = (value - stats.mean) / stats.std

        if z_score > self.SPIKE_Z_THRESHOLD:
            severity = (
                AnomalySeverity.CRITICAL if z_score > 5.0
                else AnomalySeverity.WARNING
            )

            suggestions = {
                "cpu": "Check for runaway processes or heavy computations",
                "memory": "Applications may be loading large data sets",
                "gpu": "A GPU-intensive application may have started",
            }

            return Anomaly(
                id=self._generate_id(),
                type=AnomalyType.CPU_SPIKE if metric == "cpu" else AnomalyType.RAPID_CHANGE,
                severity=severity,
                metric=metric,
                timestamp=time.time() * 1000,
                current_value=value,
                expected_value=stats.mean,
                deviation=z_score,
                message=f"{metric.upper()} spike detected: {value:.1f}% (expected ~{stats.mean:.1f}%)",
                suggestion=suggestions.get(metric, "Monitor system resources"),
                auto_dismiss_seconds=30,
            )

        return None

    def _detect_memory_pressure(
        self,
        value: float,
        stats: TelemetryStats
    ) -> Optional[Anomaly]:
        """Detect memory pressure - high usage with increasing trend."""
        if value < self.MEMORY_PRESSURE_THRESHOLD:
            return None

        # Check if memory has been climbing
        if len(stats.values) < 30:
            return None

        recent = list(stats.values)[-30:]
        older = list(stats.values)[-60:-30] if len(stats.values) >= 60 else recent

        recent_avg = statistics.mean(recent)
        older_avg = statistics.mean(older) if older else recent_avg

        # Memory pressure: high AND increasing
        if recent_avg > older_avg + 2:
            return Anomaly(
                id=self._generate_id(),
                type=AnomalyType.MEMORY_PRESSURE,
                severity=AnomalySeverity.WARNING if value < 90 else AnomalySeverity.CRITICAL,
                metric="memory",
                timestamp=time.time() * 1000,
                current_value=value,
                expected_value=older_avg,
                deviation=recent_avg - older_avg,
                message=f"Memory pressure detected: {value:.1f}% and climbing",
                suggestion="Consider closing unused applications or browser tabs",
                auto_dismiss_seconds=None,  # Don't auto-dismiss pressure warnings
            )

        return None

    def _detect_gpu_thermal(self, temperature: float) -> Optional[Anomaly]:
        """Detect GPU thermal issues."""
        if temperature < self.GPU_THERMAL_THRESHOLD:
            return None

        severity = (
            AnomalySeverity.CRITICAL if temperature > 95
            else AnomalySeverity.WARNING
        )

        return Anomaly(
            id=self._generate_id(),
            type=AnomalyType.GPU_THERMAL,
            severity=severity,
            metric="gpu",
            timestamp=time.time() * 1000,
            current_value=temperature,
            expected_value=75.0,  # Typical safe temp
            deviation=temperature - 75.0,
            message=f"GPU temperature high: {temperature:.0f}°C",
            suggestion="Improve case airflow or reduce GPU workload",
            auto_dismiss_seconds=60,
        )

    def _detect_sustained_high(
        self,
        metric: str,
        value: float
    ) -> Optional[Anomaly]:
        """Detect sustained high usage over time."""
        now = time.time()

        if value >= self.SUSTAINED_HIGH_THRESHOLD:
            if self._sustained_high_start[metric] is None:
                self._sustained_high_start[metric] = now
            elif now - self._sustained_high_start[metric] >= self.SUSTAINED_HIGH_DURATION:
                duration = now - self._sustained_high_start[metric]
                return Anomaly(
                    id=self._generate_id(),
                    type=AnomalyType.SUSTAINED_HIGH,
                    severity=AnomalySeverity.WARNING,
                    metric=metric,
                    timestamp=time.time() * 1000,
                    current_value=value,
                    expected_value=50.0,
                    deviation=value - 50.0,
                    message=f"{metric.upper()} sustained at {value:.1f}% for {duration:.0f}s",
                    suggestion=f"Check what's consuming {metric.upper()} resources",
                    auto_dismiss_seconds=120,
                )
        else:
            self._sustained_high_start[metric] = None

        return None

    def _detect_rapid_change(
        self,
        metric: str,
        value: float
    ) -> Optional[Anomaly]:
        """Detect rapid changes in metrics."""
        last_value = self._last_values.get(metric)
        self._last_values[metric] = value

        if last_value is None:
            return None

        change = abs(value - last_value)
        if change >= self.RAPID_CHANGE_THRESHOLD:
            direction = "increased" if value > last_value else "decreased"
            return Anomaly(
                id=self._generate_id(),
                type=AnomalyType.RAPID_CHANGE,
                severity=AnomalySeverity.INFO,
                metric=metric,
                timestamp=time.time() * 1000,
                current_value=value,
                expected_value=last_value,
                deviation=change,
                message=f"{metric.upper()} {direction} rapidly: {last_value:.1f}% → {value:.1f}%",
                suggestion="A process may have started or stopped",
                auto_dismiss_seconds=15,
            )

        return None

    def process_telemetry(
        self,
        cpu_percent: float,
        memory_percent: float,
        gpu_percent: Optional[float] = None,
        gpu_temp: Optional[float] = None
    ) -> List[Anomaly]:
        """Process telemetry and return any detected anomalies.

        Args:
            cpu_percent: CPU usage percentage
            memory_percent: Memory usage percentage
            gpu_percent: GPU usage percentage (optional)
            gpu_temp: GPU temperature in Celsius (optional)

        Returns:
            List of newly detected anomalies
        """
        anomalies = []
        now = time.time()

        # Update statistics
        self.stats["cpu"].update(cpu_percent)
        self.stats["memory"].update(memory_percent)
        if gpu_percent is not None:
            self.stats["gpu"].update(gpu_percent)
        if gpu_temp is not None:
            self.stats["gpu_temp"].update(gpu_temp)

        # CPU checks
        spike = self._detect_spike("cpu", cpu_percent, self.stats["cpu"])
        if spike:
            anomalies.append(spike)

        sustained = self._detect_sustained_high("cpu", cpu_percent)
        if sustained:
            anomalies.append(sustained)

        rapid = self._detect_rapid_change("cpu", cpu_percent)
        if rapid:
            anomalies.append(rapid)

        # Memory checks
        pressure = self._detect_memory_pressure(memory_percent, self.stats["memory"])
        if pressure:
            anomalies.append(pressure)

        sustained = self._detect_sustained_high("memory", memory_percent)
        if sustained:
            anomalies.append(sustained)

        # GPU checks
        if gpu_percent is not None:
            spike = self._detect_spike("gpu", gpu_percent, self.stats["gpu"])
            if spike:
                anomalies.append(spike)

            sustained = self._detect_sustained_high("gpu", gpu_percent)
            if sustained:
                anomalies.append(sustained)

        if gpu_temp is not None:
            thermal = self._detect_gpu_thermal(gpu_temp)
            if thermal:
                anomalies.append(thermal)

        # Clean up auto-dismissed anomalies
        self._cleanup_anomalies()

        # Store new anomalies
        for anomaly in anomalies:
            self.active_anomalies[anomaly.id] = anomaly

        return anomalies

    def _cleanup_anomalies(self) -> None:
        """Remove auto-dismissed anomalies that have expired."""
        now = time.time()
        to_remove = []

        for id, anomaly in self.active_anomalies.items():
            if anomaly.auto_dismiss_seconds is not None:
                age = (now * 1000 - anomaly.timestamp) / 1000
                if age > anomaly.auto_dismiss_seconds:
                    to_remove.append(id)

        for id in to_remove:
            del self.active_anomalies[id]

    def dismiss_anomaly(self, anomaly_id: str) -> bool:
        """Manually dismiss an anomaly."""
        if anomaly_id in self.active_anomalies:
            del self.active_anomalies[anomaly_id]
            return True
        return False

    def get_active_anomalies(self) -> List[Anomaly]:
        """Get all currently active anomalies."""
        self._cleanup_anomalies()
        return list(self.active_anomalies.values())

    def get_stats(self) -> Dict[str, dict]:
        """Get current statistics for all metrics."""
        return {
            metric: {
                "mean": round(stats.mean, 1),
                "std": round(stats.std, 1),
                "min": round(stats.min_seen, 1),
                "max": round(stats.max_seen, 1),
                "samples": len(stats.values),
            }
            for metric, stats in self.stats.items()
        }


# Global detector instance
_detector = AnomalyDetector()


def process_telemetry(
    cpu_percent: float,
    memory_percent: float,
    gpu_percent: Optional[float] = None,
    gpu_temp: Optional[float] = None
) -> List[dict]:
    """Process telemetry and return anomalies as dicts for JSON."""
    anomalies = _detector.process_telemetry(
        cpu_percent, memory_percent, gpu_percent, gpu_temp
    )
    return [
        {
            "id": a.id,
            "type": a.type.value,
            "severity": a.severity.value,
            "metric": a.metric,
            "timestamp": a.timestamp,
            "currentValue": a.current_value,
            "expectedValue": a.expected_value,
            "deviation": round(a.deviation, 2),
            "message": a.message,
            "suggestion": a.suggestion,
            "autoDismissSeconds": a.auto_dismiss_seconds,
        }
        for a in anomalies
    ]


def get_active_anomalies() -> List[dict]:
    """Get all active anomalies as dicts."""
    anomalies = _detector.get_active_anomalies()
    return [
        {
            "id": a.id,
            "type": a.type.value,
            "severity": a.severity.value,
            "metric": a.metric,
            "timestamp": a.timestamp,
            "currentValue": a.current_value,
            "expectedValue": a.expected_value,
            "deviation": round(a.deviation, 2),
            "message": a.message,
            "suggestion": a.suggestion,
            "autoDismissSeconds": a.auto_dismiss_seconds,
        }
        for a in anomalies
    ]


def dismiss_anomaly(anomaly_id: str) -> bool:
    """Dismiss an anomaly by ID."""
    return _detector.dismiss_anomaly(anomaly_id)


def get_baseline_stats() -> Dict[str, dict]:
    """Get baseline statistics for all metrics."""
    return _detector.get_stats()
