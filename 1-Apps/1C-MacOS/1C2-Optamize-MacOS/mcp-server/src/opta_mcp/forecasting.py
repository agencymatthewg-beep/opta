"""Time series forecasting for system telemetry.

Provides CPU, memory, and GPU usage predictions using simple statistical methods.
Designed to work without heavy ML dependencies (no Kats/Darts required).
"""

import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import statistics


@dataclass
class TelemetryPoint:
    """Single telemetry measurement."""
    timestamp: float  # Unix timestamp in ms
    cpu_percent: float
    memory_percent: float
    gpu_percent: Optional[float] = None


@dataclass
class ForecastResult:
    """Result of a forecast operation."""
    metric: str  # cpu, memory, gpu
    current_value: float
    predictions: List[Dict]  # [{timestamp, value, confidence_lower, confidence_upper}]
    trend: str  # "increasing", "decreasing", "stable"
    trend_strength: float  # 0-1
    estimated_time_to_critical: Optional[float]  # seconds until 85% threshold
    confidence: float  # 0-1 overall forecast confidence


class TelemetryForecaster:
    """Forecasts system telemetry using exponential smoothing and trend analysis.

    Uses Holt-Winters exponential smoothing for predictions - lightweight and
    effective for short-term forecasting without heavy ML dependencies.
    """

    # History buffer size (store last 5 minutes at 1Hz = 300 points)
    HISTORY_SIZE = 300

    # Smoothing parameters
    ALPHA = 0.3  # Level smoothing
    BETA = 0.1   # Trend smoothing

    # Thresholds
    CRITICAL_THRESHOLD = 85.0  # Percentage considered critical
    WARNING_THRESHOLD = 60.0   # Percentage considered warning

    def __init__(self):
        self.history: deque[TelemetryPoint] = deque(maxlen=self.HISTORY_SIZE)
        self._level: Dict[str, float] = {}
        self._trend: Dict[str, float] = {}
        self._initialized: Dict[str, bool] = {"cpu": False, "memory": False, "gpu": False}

    def add_point(self, point: TelemetryPoint) -> None:
        """Add a new telemetry point to history and update model."""
        self.history.append(point)

        # Update exponential smoothing for each metric
        for metric in ["cpu", "memory", "gpu"]:
            value = self._get_value(point, metric)
            if value is None:
                continue

            if not self._initialized[metric]:
                # Initialize with first value
                self._level[metric] = value
                self._trend[metric] = 0.0
                self._initialized[metric] = True
            else:
                # Holt's linear exponential smoothing
                old_level = self._level[metric]
                self._level[metric] = (
                    self.ALPHA * value +
                    (1 - self.ALPHA) * (old_level + self._trend[metric])
                )
                self._trend[metric] = (
                    self.BETA * (self._level[metric] - old_level) +
                    (1 - self.BETA) * self._trend[metric]
                )

    def _get_value(self, point: TelemetryPoint, metric: str) -> Optional[float]:
        """Extract metric value from telemetry point."""
        if metric == "cpu":
            return point.cpu_percent
        elif metric == "memory":
            return point.memory_percent
        elif metric == "gpu":
            return point.gpu_percent
        return None

    def _get_recent_values(self, metric: str, count: int = 60) -> List[float]:
        """Get recent values for a metric."""
        values = []
        for point in list(self.history)[-count:]:
            value = self._get_value(point, metric)
            if value is not None:
                values.append(value)
        return values

    def _calculate_volatility(self, values: List[float]) -> float:
        """Calculate volatility (standard deviation) of values."""
        if len(values) < 2:
            return 10.0  # Default high volatility for insufficient data
        return statistics.stdev(values)

    def _estimate_time_to_threshold(
        self,
        current: float,
        trend: float,
        threshold: float
    ) -> Optional[float]:
        """Estimate seconds until reaching threshold."""
        if trend <= 0:
            return None  # Trend is not increasing
        if current >= threshold:
            return 0.0  # Already at threshold

        # Simple linear projection
        remaining = threshold - current
        return remaining / trend if trend > 0.001 else None

    def forecast(
        self,
        metric: str,
        horizon_seconds: int = 60,
        interval_seconds: int = 5
    ) -> Optional[ForecastResult]:
        """Generate forecast for a metric.

        Args:
            metric: One of "cpu", "memory", "gpu"
            horizon_seconds: How far ahead to forecast
            interval_seconds: Interval between prediction points

        Returns:
            ForecastResult with predictions and analysis
        """
        if not self._initialized.get(metric, False):
            return None

        if len(self.history) < 10:
            return None  # Need minimum history

        # Get current state
        level = self._level[metric]
        trend = self._trend[metric]

        # Get recent values for volatility
        recent_values = self._get_recent_values(metric, 60)
        volatility = self._calculate_volatility(recent_values)

        # Generate predictions
        predictions = []
        now = time.time() * 1000  # Current time in ms

        num_points = horizon_seconds // interval_seconds
        for i in range(1, num_points + 1):
            steps = i * interval_seconds
            predicted_value = level + (trend * steps)

            # Clamp to valid range
            predicted_value = max(0, min(100, predicted_value))

            # Confidence interval widens with time
            uncertainty = volatility * math.sqrt(steps / 10)
            confidence_lower = max(0, predicted_value - uncertainty * 1.96)
            confidence_upper = min(100, predicted_value + uncertainty * 1.96)

            predictions.append({
                "timestamp": now + (steps * 1000),
                "value": round(predicted_value, 1),
                "confidence_lower": round(confidence_lower, 1),
                "confidence_upper": round(confidence_upper, 1),
            })

        # Determine trend direction
        if trend > 0.5:
            trend_direction = "increasing"
        elif trend < -0.5:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"

        # Trend strength (normalized)
        trend_strength = min(1.0, abs(trend) / 5.0)

        # Estimate time to critical
        time_to_critical = self._estimate_time_to_threshold(
            level, trend, self.CRITICAL_THRESHOLD
        )

        # Overall confidence based on data amount and volatility
        data_confidence = min(1.0, len(self.history) / 100)
        volatility_penalty = max(0, 1 - volatility / 20)
        confidence = data_confidence * volatility_penalty

        return ForecastResult(
            metric=metric,
            current_value=round(level, 1),
            predictions=predictions,
            trend=trend_direction,
            trend_strength=round(trend_strength, 2),
            estimated_time_to_critical=time_to_critical,
            confidence=round(confidence, 2),
        )

    def get_all_forecasts(
        self,
        horizon_seconds: int = 60
    ) -> Dict[str, Optional[ForecastResult]]:
        """Get forecasts for all metrics."""
        return {
            "cpu": self.forecast("cpu", horizon_seconds),
            "memory": self.forecast("memory", horizon_seconds),
            "gpu": self.forecast("gpu", horizon_seconds),
        }


# Global forecaster instance
_forecaster = TelemetryForecaster()


def record_telemetry(
    cpu_percent: float,
    memory_percent: float,
    gpu_percent: Optional[float] = None
) -> None:
    """Record a telemetry point for forecasting."""
    point = TelemetryPoint(
        timestamp=time.time() * 1000,
        cpu_percent=cpu_percent,
        memory_percent=memory_percent,
        gpu_percent=gpu_percent,
    )
    _forecaster.add_point(point)


def get_forecast(
    metric: str,
    horizon_seconds: int = 60
) -> Optional[dict]:
    """Get forecast for a specific metric.

    Returns dict representation for JSON serialization.
    """
    result = _forecaster.forecast(metric, horizon_seconds)
    if result is None:
        return None

    return {
        "metric": result.metric,
        "currentValue": result.current_value,
        "predictions": result.predictions,
        "trend": result.trend,
        "trendStrength": result.trend_strength,
        "estimatedTimeToCritical": result.estimated_time_to_critical,
        "confidence": result.confidence,
    }


def get_all_forecasts(horizon_seconds: int = 60) -> dict:
    """Get forecasts for all metrics."""
    results = _forecaster.get_all_forecasts(horizon_seconds)
    return {
        metric: (
            {
                "metric": r.metric,
                "currentValue": r.current_value,
                "predictions": r.predictions,
                "trend": r.trend,
                "trendStrength": r.trend_strength,
                "estimatedTimeToCritical": r.estimated_time_to_critical,
                "confidence": r.confidence,
            } if r else None
        )
        for metric, r in results.items()
    }
