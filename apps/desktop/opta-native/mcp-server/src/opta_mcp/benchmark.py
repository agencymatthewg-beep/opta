"""
Benchmarking system for measuring optimization effectiveness.
"""
import json
import time
import statistics
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from .telemetry import get_system_snapshot

# Benchmark storage
BENCHMARK_DIR = Path.home() / ".opta" / "benchmarks"


@dataclass
class BenchmarkSample:
    """Single benchmark sample."""
    timestamp: float
    cpu_percent: float
    memory_percent: float
    gpu_percent: Optional[float]
    gpu_temp: Optional[float]
    cpu_temp: Optional[float]


@dataclass
class BenchmarkMetrics:
    """Aggregated benchmark metrics."""
    cpu_avg: float
    cpu_max: float
    memory_avg: float
    memory_max: float
    gpu_avg: Optional[float]
    gpu_max: Optional[float]
    gpu_temp_avg: Optional[float]
    sample_count: int
    duration_seconds: float


@dataclass
class ActiveBenchmark:
    """Currently running benchmark."""
    benchmark_id: str
    game_id: str
    game_name: str
    phase: str  # "before" or "after"
    started_at: float
    samples: List[BenchmarkSample] = field(default_factory=list)


# Active benchmark storage (in-memory)
_active_benchmarks: Dict[str, ActiveBenchmark] = {}


def start_benchmark(game_id: str, game_name: str, phase: str = "before") -> Dict:
    """
    Start a benchmark session.

    Args:
        game_id: The game ID being benchmarked
        game_name: Display name of the game
        phase: "before" or "after" optimization

    Returns:
        Benchmark session info
    """
    benchmark_id = f"{game_id}_{int(time.time())}"

    benchmark = ActiveBenchmark(
        benchmark_id=benchmark_id,
        game_id=game_id,
        game_name=game_name,
        phase=phase,
        started_at=time.time(),
        samples=[]
    )

    _active_benchmarks[benchmark_id] = benchmark

    return {
        "benchmark_id": benchmark_id,
        "game_id": game_id,
        "phase": phase,
        "started_at": benchmark.started_at,
        "status": "running"
    }


def capture_sample(benchmark_id: str) -> Optional[Dict]:
    """
    Capture a single benchmark sample.

    Should be called periodically (e.g., every 1 second) during benchmark.
    """
    if benchmark_id not in _active_benchmarks:
        return None

    benchmark = _active_benchmarks[benchmark_id]

    try:
        snapshot = get_system_snapshot()

        sample = BenchmarkSample(
            timestamp=time.time(),
            cpu_percent=snapshot.get("cpu", {}).get("percent", 0),
            memory_percent=snapshot.get("memory", {}).get("percent", 0),
            gpu_percent=snapshot.get("gpu", {}).get("percent"),
            gpu_temp=snapshot.get("gpu", {}).get("temperature"),
            cpu_temp=snapshot.get("cpu", {}).get("temperature")
        )

        benchmark.samples.append(sample)

        return asdict(sample)
    except Exception as e:
        return {"error": str(e)}


def end_benchmark(benchmark_id: str) -> Optional[Dict]:
    """
    End a benchmark session and calculate metrics.
    """
    if benchmark_id not in _active_benchmarks:
        return None

    benchmark = _active_benchmarks[benchmark_id]
    samples = benchmark.samples

    if len(samples) < 2:
        # Clean up
        del _active_benchmarks[benchmark_id]
        return {"error": "Insufficient samples", "sample_count": len(samples)}

    # Calculate metrics
    cpu_values = [s.cpu_percent for s in samples]
    memory_values = [s.memory_percent for s in samples]
    gpu_values = [s.gpu_percent for s in samples if s.gpu_percent is not None]
    gpu_temps = [s.gpu_temp for s in samples if s.gpu_temp is not None]

    metrics = BenchmarkMetrics(
        cpu_avg=statistics.mean(cpu_values),
        cpu_max=max(cpu_values),
        memory_avg=statistics.mean(memory_values),
        memory_max=max(memory_values),
        gpu_avg=statistics.mean(gpu_values) if gpu_values else None,
        gpu_max=max(gpu_values) if gpu_values else None,
        gpu_temp_avg=statistics.mean(gpu_temps) if gpu_temps else None,
        sample_count=len(samples),
        duration_seconds=samples[-1].timestamp - samples[0].timestamp
    )

    # Save benchmark data
    save_benchmark_data(benchmark, metrics)

    # Clean up
    del _active_benchmarks[benchmark_id]

    return asdict(metrics)


def save_benchmark_data(benchmark: ActiveBenchmark, metrics: BenchmarkMetrics):
    """Save benchmark data to disk."""
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)

    data = {
        "benchmark_id": benchmark.benchmark_id,
        "game_id": benchmark.game_id,
        "game_name": benchmark.game_name,
        "phase": benchmark.phase,
        "started_at": benchmark.started_at,
        "completed_at": time.time(),
        "metrics": asdict(metrics),
        "samples": [asdict(s) for s in benchmark.samples]
    }

    filepath = BENCHMARK_DIR / f"{benchmark.benchmark_id}_{benchmark.phase}.json"
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


def get_benchmark_pair(game_id: str) -> Optional[Dict]:
    """
    Get the most recent before/after benchmark pair for a game.
    """
    if not BENCHMARK_DIR.exists():
        return None

    # Find matching before/after files
    before_files = sorted(BENCHMARK_DIR.glob(f"{game_id}_*_before.json"), reverse=True)
    after_files = sorted(BENCHMARK_DIR.glob(f"{game_id}_*_after.json"), reverse=True)

    if not before_files or not after_files:
        return None

    # Load most recent pair
    try:
        with open(before_files[0], 'r') as f:
            before_data = json.load(f)
        with open(after_files[0], 'r') as f:
            after_data = json.load(f)
    except Exception:
        return None

    before_metrics = before_data.get("metrics", {})
    after_metrics = after_data.get("metrics", {})

    # Calculate improvements
    improvement = {}
    if before_metrics.get("cpu_avg") and after_metrics.get("cpu_avg"):
        improvement["cpu_reduction"] = before_metrics["cpu_avg"] - after_metrics["cpu_avg"]
        improvement["cpu_reduction_percent"] = (improvement["cpu_reduction"] / before_metrics["cpu_avg"]) * 100

    if before_metrics.get("memory_avg") and after_metrics.get("memory_avg"):
        improvement["memory_reduction"] = before_metrics["memory_avg"] - after_metrics["memory_avg"]
        improvement["memory_reduction_percent"] = (improvement["memory_reduction"] / before_metrics["memory_avg"]) * 100

    if before_metrics.get("gpu_temp_avg") and after_metrics.get("gpu_temp_avg"):
        improvement["gpu_temp_reduction"] = before_metrics["gpu_temp_avg"] - after_metrics["gpu_temp_avg"]

    return {
        "game_id": game_id,
        "game_name": before_data.get("game_name", "Unknown"),
        "before": before_metrics,
        "after": after_metrics,
        "improvement": improvement,
        "before_timestamp": before_data.get("started_at"),
        "after_timestamp": after_data.get("started_at")
    }


def get_all_benchmarks() -> List[Dict]:
    """Get summary of all benchmark results."""
    if not BENCHMARK_DIR.exists():
        return []

    results = []
    seen_games = set()

    for filepath in sorted(BENCHMARK_DIR.glob("*_before.json"), reverse=True):
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)

            game_id = data.get("game_id")
            if game_id in seen_games:
                continue
            seen_games.add(game_id)

            pair = get_benchmark_pair(game_id)
            if pair:
                results.append(pair)
        except Exception:
            continue

    return results


def run_quick_benchmark(duration_seconds: int = 10) -> Dict:
    """
    Run a quick system benchmark without game context.

    Useful for baseline system performance measurement.
    """
    samples = []
    start_time = time.time()

    while time.time() - start_time < duration_seconds:
        try:
            snapshot = get_system_snapshot()
            sample = {
                "timestamp": time.time(),
                "cpu_percent": snapshot.get("cpu", {}).get("percent", 0),
                "memory_percent": snapshot.get("memory", {}).get("percent", 0),
                "gpu_percent": snapshot.get("gpu", {}).get("percent"),
            }
            samples.append(sample)
            time.sleep(1)
        except Exception:
            continue

    if len(samples) < 2:
        return {"error": "Insufficient samples collected"}

    cpu_values = [s["cpu_percent"] for s in samples]
    memory_values = [s["memory_percent"] for s in samples]
    gpu_values = [s["gpu_percent"] for s in samples if s["gpu_percent"] is not None]

    return {
        "duration_seconds": duration_seconds,
        "sample_count": len(samples),
        "cpu": {
            "avg": statistics.mean(cpu_values),
            "max": max(cpu_values),
            "min": min(cpu_values)
        },
        "memory": {
            "avg": statistics.mean(memory_values),
            "max": max(memory_values),
            "min": min(memory_values)
        },
        "gpu": {
            "avg": statistics.mean(gpu_values) if gpu_values else None,
            "max": max(gpu_values) if gpu_values else None,
            "min": min(gpu_values) if gpu_values else None
        } if gpu_values else None
    }
