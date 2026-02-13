"""
Optimization scoring system for gamification and sharing.

Version 2 introduces three-dimensional scoring with wow factors for viral sharing.
- Performance dimension: FPS gains, stability, load times
- Experience dimension: Visual quality, thermal efficiency, responsiveness
- Competitive dimension: Input lag, network latency, background interference
"""
import json
import time
import platform
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from .optimizer import get_optimization_history, get_all_optimized_games
from .benchmark import get_benchmark_pair
from .telemetry import get_gpu_info, get_memory_info

# Score storage
SCORES_DIR = Path.home() / ".opta" / "scores"
OPTA_SCORE_FILE = SCORES_DIR / "opta_score.json"

# V1 Scoring weights (must sum to 100) - kept for backwards compatibility
BASE_SCORE = 30
MAX_PERFORMANCE_SCORE = 40
MAX_DEPTH_SCORE = 20
MAX_STABILITY_SCORE = 10

# V2 Dimension weights
DIMENSION_WEIGHTS = {
    'performance': 0.40,
    'experience': 0.35,
    'competitive': 0.25
}

# Hardware tier thresholds (based on GPU VRAM + system RAM)
HARDWARE_TIERS = {
    'budget': {'max_vram': 4, 'max_ram': 16, 'price_range': '$400-700'},
    'midrange': {'max_vram': 8, 'max_ram': 32, 'price_range': '$800-1200'},
    'highend': {'max_vram': 12, 'max_ram': 64, 'price_range': '$1300-2000'},
    'enthusiast': {'max_vram': 999, 'max_ram': 999, 'price_range': '$2000+'}
}

# Money saved equivalents for FPS gains
MONEY_EQUIVALENTS = [
    {'min_gain': 40, 'amount': 600, 'equivalent': 'Flagship GPU upgrade'},
    {'min_gain': 25, 'amount': 400, 'equivalent': 'Major GPU upgrade'},
    {'min_gain': 15, 'amount': 250, 'equivalent': 'GPU tier upgrade'},
    {'min_gain': 10, 'amount': 150, 'equivalent': 'RAM upgrade'},
    {'min_gain': 5, 'amount': 50, 'equivalent': 'Software optimization'},
    {'min_gain': 0, 'amount': 0, 'equivalent': 'Minor tweaks'},
]


@dataclass
class ScoreBreakdown:
    """Detailed score breakdown for transparency (V1)."""
    total: int                  # 0-100 final score
    performance_score: float    # 0-40
    depth_score: float          # 0-20
    stability_score: float      # 0-10
    base_score: int             # 30 (constant)

    # Performance details
    cpu_contribution: float
    memory_contribution: float
    gpu_temp_contribution: float

    # Depth details
    actions_count: int
    action_types_used: List[str]
    diversity_bonus: float

    # Stability details
    actions_applied: int
    actions_failed: int
    success_rate: float


@dataclass
class GameScore:
    """Complete score record for a game (V1)."""
    game_id: str
    game_name: str
    score: int
    breakdown: ScoreBreakdown
    calculated_at: float
    optimization_timestamp: Optional[float]
    benchmark_timestamp: Optional[float]


# ============================================
# V2 DATACLASSES
# ============================================

@dataclass
class DimensionScores:
    """Three-dimensional score breakdown (V2)."""
    performance: Dict[str, float]  # fpsGain, stability, loadTimes, weighted
    experience: Dict[str, float]   # visualQuality, thermalEfficiency, responsiveness, weighted
    competitive: Dict[str, float]  # inputLag, networkLatency, interference, weighted


@dataclass
class WowFactors:
    """Viral sharing metrics (V2)."""
    money_saved: Dict[str, Any]     # amount, equivalent, explanation
    percentile_rank: Dict[str, Any]  # similar, global, tier
    improvement_summary: Dict[str, Any]  # totalFpsGained, totalOptimizations, biggestGain


@dataclass
class HardwareTier:
    """Hardware classification for comparisons (V2)."""
    tier: str           # budget, midrange, highend, enthusiast
    signature: str      # "RTX 4070 + 32GB RAM"
    price_range: str    # "$800-1200"


def calculate_score(game_id: str, game_name: str = "Unknown") -> Optional[Dict]:
    """
    Calculate the optimization score for a game.

    The score is based on:
    - Performance gains from benchmark (40 points max)
    - Optimization depth/coverage (20 points max)
    - Stability/success rate (10 points max)
    - Base score (30 points)
    """
    # Get optimization history
    history = get_optimization_history(game_id)
    if not history:
        return None

    # Get benchmark data
    benchmark = get_benchmark_pair(game_id)
    improvement = benchmark.get("improvement", {}) if benchmark else {}

    # Get game name from history if available
    if history and history[0].get("game_name"):
        game_name = history[0]["game_name"]

    # === Performance Score (0-40 points) ===
    cpu_reduction = max(0, improvement.get("cpu_reduction_percent", 0))
    memory_reduction = max(0, improvement.get("memory_reduction_percent", 0))
    gpu_temp_reduction = max(0, improvement.get("gpu_temp_reduction", 0))

    # Cap and scale
    cpu_contribution = min(cpu_reduction, 30) * 0.5  # max 15
    memory_contribution = min(memory_reduction, 30) * 0.5  # max 15
    gpu_temp_contribution = min(gpu_temp_reduction, 20) * 0.5  # max 10

    performance_score = cpu_contribution + memory_contribution + gpu_temp_contribution
    performance_score = min(performance_score, MAX_PERFORMANCE_SCORE)

    # === Depth Score (0-20 points) ===
    actions_count = len(history)
    action_types = set(a.get("action_type", "") for a in history)

    # Actions contribution (max 15 points)
    actions_contribution = min(actions_count, 10) * 1.5

    # Diversity bonus (max 5 points)
    # 1 point per type used, +2 bonus if all three types used
    diversity_bonus = len(action_types)
    if len(action_types) >= 3:
        diversity_bonus += 2

    depth_score = actions_contribution + diversity_bonus
    depth_score = min(depth_score, MAX_DEPTH_SCORE)

    # === Stability Score (0-10 points) ===
    # Count applied vs failed from history
    actions_applied = sum(1 for a in history if a.get("applied_at") is not None)
    actions_failed = len(history) - actions_applied

    if actions_applied + actions_failed > 0:
        success_rate = actions_applied / (actions_applied + actions_failed)
    else:
        success_rate = 1.0

    stability_score = success_rate * MAX_STABILITY_SCORE

    # === Total Score ===
    total = int(BASE_SCORE + performance_score + depth_score + stability_score)
    total = min(total, 100)

    # Build breakdown
    breakdown = ScoreBreakdown(
        total=total,
        performance_score=round(performance_score, 1),
        depth_score=round(depth_score, 1),
        stability_score=round(stability_score, 1),
        base_score=BASE_SCORE,
        cpu_contribution=round(cpu_contribution, 1),
        memory_contribution=round(memory_contribution, 1),
        gpu_temp_contribution=round(gpu_temp_contribution, 1),
        actions_count=actions_count,
        action_types_used=list(action_types),
        diversity_bonus=round(diversity_bonus, 1),
        actions_applied=actions_applied,
        actions_failed=actions_failed,
        success_rate=round(success_rate, 2)
    )

    # Build game score
    game_score = GameScore(
        game_id=game_id,
        game_name=game_name,
        score=total,
        breakdown=breakdown,
        calculated_at=time.time(),
        optimization_timestamp=max((a.get("applied_at", 0) for a in history), default=None),
        benchmark_timestamp=benchmark.get("after_timestamp") if benchmark else None
    )

    # Save score
    save_score(game_score)

    return asdict(game_score)


def save_score(game_score: GameScore):
    """Save score to disk with history tracking."""
    game_dir = SCORES_DIR / game_score.game_id
    game_dir.mkdir(parents=True, exist_ok=True)

    # Save latest score
    latest_path = game_dir / "latest.json"
    with open(latest_path, 'w') as f:
        json.dump(asdict(game_score), f, indent=2)

    # Append to history
    history_path = game_dir / "history.json"
    history = []
    if history_path.exists():
        try:
            with open(history_path, 'r') as f:
                history = json.load(f)
        except Exception:
            history = []

    # Add new entry (keep last 50 entries)
    history.append({
        "score": game_score.score,
        "calculated_at": game_score.calculated_at,
        "performance_score": game_score.breakdown.performance_score,
        "depth_score": game_score.breakdown.depth_score,
        "stability_score": game_score.breakdown.stability_score
    })
    history = history[-50:]

    with open(history_path, 'w') as f:
        json.dump(history, f, indent=2)

    # Update global stats
    update_global_stats(game_score)


def update_global_stats(game_score: GameScore):
    """Update cross-game statistics."""
    stats_path = SCORES_DIR / "global_stats.json"
    stats = {
        "total_games_optimized": 0,
        "average_score": 0,
        "highest_score": 0,
        "highest_score_game": "",
        "last_updated": 0
    }

    if stats_path.exists():
        try:
            with open(stats_path, 'r') as f:
                stats = json.load(f)
        except Exception:
            pass

    # Recalculate stats
    all_scores = get_all_scores()
    if all_scores:
        scores = [s["score"] for s in all_scores]
        stats["total_games_optimized"] = len(all_scores)
        stats["average_score"] = round(sum(scores) / len(scores), 1)
        stats["highest_score"] = max(scores)
        highest_game = max(all_scores, key=lambda x: x["score"])
        stats["highest_score_game"] = highest_game.get("game_name", "")
        stats["last_updated"] = time.time()

    with open(stats_path, 'w') as f:
        json.dump(stats, f, indent=2)


def get_score(game_id: str) -> Optional[Dict]:
    """Get the latest score for a game."""
    latest_path = SCORES_DIR / game_id / "latest.json"
    if not latest_path.exists():
        return None

    try:
        with open(latest_path, 'r') as f:
            return json.load(f)
    except Exception:
        return None


def get_score_history(game_id: str) -> List[Dict]:
    """Get score history for a game."""
    history_path = SCORES_DIR / game_id / "history.json"
    if not history_path.exists():
        return []

    try:
        with open(history_path, 'r') as f:
            return json.load(f)
    except Exception:
        return []


def get_all_scores() -> List[Dict]:
    """Get all game scores for leaderboard."""
    if not SCORES_DIR.exists():
        return []

    scores = []
    for game_dir in SCORES_DIR.iterdir():
        if game_dir.is_dir():
            score = get_score(game_dir.name)
            if score:
                scores.append(score)

    # Sort by score descending
    scores.sort(key=lambda x: x.get("score", 0), reverse=True)
    return scores


def get_global_stats() -> Dict:
    """Get cross-game statistics."""
    stats_path = SCORES_DIR / "global_stats.json"
    if not stats_path.exists():
        return {
            "total_games_optimized": 0,
            "average_score": 0,
            "highest_score": 0,
            "highest_score_game": "",
            "last_updated": 0
        }

    try:
        with open(stats_path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def recalculate_all_scores() -> Dict:
    """Recalculate scores for all optimized games."""
    optimized_games = get_all_optimized_games()
    results = {
        "recalculated": 0,
        "failed": 0,
        "scores": []
    }

    for game in optimized_games:
        game_id = game.get("game_id")
        if game_id:
            score = calculate_score(game_id)
            if score:
                results["recalculated"] += 1
                results["scores"].append({
                    "game_id": game_id,
                    "score": score.get("score", 0)
                })
            else:
                results["failed"] += 1

    return results


# ============================================
# V2 ENHANCED SCORING FUNCTIONS
# ============================================

def detect_hardware_tier() -> Dict:
    """
    Detect hardware tier from system info.

    Returns tier (budget/midrange/highend/enthusiast), signature, priceRange.
    """
    gpu_info = get_gpu_info()
    memory_info = get_memory_info()

    gpu_name = gpu_info.get('name', 'Unknown GPU') if gpu_info.get('available') else 'No GPU'
    gpu_vram = gpu_info.get('memory_total_gb') or 0
    ram_gb = memory_info.get('total_gb') or 16

    # Determine tier based on VRAM and RAM
    tier = 'budget'
    price_range = HARDWARE_TIERS['budget']['price_range']

    for tier_name, thresholds in HARDWARE_TIERS.items():
        if gpu_vram <= thresholds['max_vram'] and ram_gb <= thresholds['max_ram']:
            tier = tier_name
            price_range = thresholds['price_range']
            break

    # Create human-readable signature
    signature = f"{gpu_name} + {int(ram_gb)}GB RAM"

    return {
        'tier': tier,
        'signature': signature,
        'priceRange': price_range
    }


def calculate_performance_dimension(benchmark_data: Optional[Dict], history: List) -> Dict:
    """
    Calculate Performance dimension (FPS Potential, Stability, Load Times).

    - FPS Potential: Based on benchmark improvement metrics
    - Stability: Based on frame time variance reduction
    - Load Times: Based on process optimization and memory management
    """
    # Default scores if no data
    fps_gain = 50
    stability = 50
    load_times = 50

    if benchmark_data:
        improvement = benchmark_data.get('improvement', {})

        # FPS gain approximation from CPU/memory reduction
        # Lower CPU usage = more headroom = better FPS
        cpu_reduction = max(0, improvement.get('cpu_reduction_percent', 0))
        memory_reduction = max(0, improvement.get('memory_reduction_percent', 0))

        # Map reductions to FPS gain score (0-100)
        # 30% reduction = 100 score
        fps_gain = min(100, (cpu_reduction + memory_reduction) * 1.67)

        # Stability from consistent metrics
        before_metrics = benchmark_data.get('before', {})
        after_metrics = benchmark_data.get('after', {})

        # Lower max vs avg gap = more stable
        cpu_stability_before = before_metrics.get('cpu_max', 100) - before_metrics.get('cpu_avg', 50)
        cpu_stability_after = after_metrics.get('cpu_max', 100) - after_metrics.get('cpu_avg', 50)

        if cpu_stability_before > 0:
            stability_improvement = 1 - (cpu_stability_after / cpu_stability_before)
            stability = min(100, 50 + (stability_improvement * 50))

    # Load times based on history depth - more optimizations = better load management
    if history:
        action_count = len(history)
        load_times = min(100, 40 + (action_count * 6))

    # Calculate weighted average (FPS most important for performance)
    weighted = (fps_gain * 0.5) + (stability * 0.3) + (load_times * 0.2)

    return {
        'fpsGain': round(fps_gain, 1),
        'stability': round(stability, 1),
        'loadTimes': round(load_times, 1),
        'weighted': round(weighted, 1)
    }


def calculate_experience_dimension(benchmark_data: Optional[Dict], settings: Dict) -> Dict:
    """
    Calculate Experience dimension (Visual Quality, Thermal, Responsiveness).

    - Visual Quality: Inverse of graphics reductions (higher = kept more quality)
    - Thermal Efficiency: GPU temp reduction score
    - Responsiveness: System responsiveness based on CPU/memory headroom
    """
    visual_quality = 75  # Default: assume minimal quality loss
    thermal_efficiency = 50
    responsiveness = 50

    if benchmark_data:
        improvement = benchmark_data.get('improvement', {})
        after_metrics = benchmark_data.get('after', {})

        # Visual quality - assume software optimization keeps quality high
        # (Graphics settings changes would lower this)
        visual_quality = 80

        # Thermal efficiency from GPU temp reduction
        gpu_temp_reduction = improvement.get('gpu_temp_reduction', 0)
        if gpu_temp_reduction > 0:
            # Every degree reduction = 5 points, capped at 100
            thermal_efficiency = min(100, 50 + (gpu_temp_reduction * 5))
        else:
            thermal_efficiency = 50

        # Responsiveness from available headroom
        cpu_avg = after_metrics.get('cpu_avg', 50)
        memory_avg = after_metrics.get('memory_avg', 50)

        # Lower average usage = more headroom = better responsiveness
        cpu_headroom = 100 - cpu_avg
        memory_headroom = 100 - memory_avg
        responsiveness = (cpu_headroom + memory_headroom) / 2

    # Calculate weighted average
    weighted = (visual_quality * 0.35) + (thermal_efficiency * 0.35) + (responsiveness * 0.3)

    return {
        'visualQuality': round(visual_quality, 1),
        'thermalEfficiency': round(thermal_efficiency, 1),
        'responsiveness': round(responsiveness, 1),
        'weighted': round(weighted, 1)
    }


def calculate_competitive_dimension(benchmark_data: Optional[Dict], history: List) -> Dict:
    """
    Calculate Competitive dimension (Input Lag, Latency, Interference).

    - Input Lag: Based on priority optimizations
    - Network Latency: Placeholder (future implementation)
    - Interference: Based on background process management
    """
    input_lag = 50
    network_latency = 50  # Placeholder - fixed value for now
    interference = 50

    # Input lag from priority-related optimizations
    if history:
        priority_actions = sum(1 for a in history if 'priority' in a.get('action_type', '').lower())
        # Each priority action = 10 points, base 40
        input_lag = min(100, 40 + (priority_actions * 10))

        # Interference from total actions (more cleanup = less interference)
        total_actions = len(history)
        interference = min(100, 30 + (total_actions * 7))

    if benchmark_data:
        improvement = benchmark_data.get('improvement', {})
        # Better CPU reduction = less interference
        cpu_reduction = max(0, improvement.get('cpu_reduction_percent', 0))
        interference = min(100, interference + (cpu_reduction * 0.5))

    # Calculate weighted average
    weighted = (input_lag * 0.4) + (network_latency * 0.25) + (interference * 0.35)

    return {
        'inputLag': round(input_lag, 1),
        'networkLatency': round(network_latency, 1),
        'interference': round(interference, 1),
        'weighted': round(weighted, 1)
    }


def calculate_money_saved(fps_gain_percent: float, gpu_tier: str) -> Dict:
    """
    Calculate equivalent GPU upgrade cost.

    Logic: Map FPS gain % to typical upgrade path costs.
    - 10-15% gain ~ $150 (RAM upgrade)
    - 15-25% gain ~ $250 (GPU tier up)
    - 25-40% gain ~ $400 (major GPU upgrade)
    - 40%+ gain ~ $600+ (flagship upgrade)
    """
    amount = 0
    equivalent = 'Minor tweaks'
    explanation = 'No significant gain detected'

    for equiv in MONEY_EQUIVALENTS:
        if fps_gain_percent >= equiv['min_gain']:
            amount = equiv['amount']
            equivalent = equiv['equivalent']
            explanation = f"~{fps_gain_percent:.0f}% performance gain is equivalent to a {equivalent.lower()}"
            break

    return {
        'amount': amount,
        'equivalent': equivalent,
        'explanation': explanation
    }


def calculate_percentile_rank(score: int, hardware_tier: str) -> Dict:
    """
    Calculate percentile ranking.

    For v1: Use statistical estimation based on score distribution.
    Future: Use actual community data when available.
    """
    # Estimated distribution by tier (mean, std_dev)
    tier_distributions = {
        'budget': (55, 15),
        'midrange': (65, 12),
        'highend': (72, 10),
        'enthusiast': (78, 8)
    }

    mean, std_dev = tier_distributions.get(hardware_tier, (60, 15))

    # Calculate z-score and approximate percentile
    if std_dev > 0:
        z_score = (score - mean) / std_dev
        # Approximate percentile from z-score using linear approximation
        # z=0 -> 50%, z=1 -> 84%, z=-1 -> 16%, etc.
        similar_percentile = min(99, max(1, 50 + (z_score * 34)))
    else:
        similar_percentile = 50

    # Global percentile is slightly lower (mixed hardware)
    global_percentile = min(99, max(1, similar_percentile - 5))

    tier_names = {
        'budget': 'Budget Gaming',
        'midrange': 'Midrange Gaming',
        'highend': 'High-End Gaming',
        'enthusiast': 'Enthusiast'
    }

    return {
        'similar': round(similar_percentile),
        'global': round(global_percentile),
        'tier': tier_names.get(hardware_tier, 'Gaming')
    }


def calculate_enhanced_score(game_id: str, game_name: str = "Unknown") -> Optional[Dict]:
    """
    Calculate comprehensive score with all dimensions and wow factors.

    Returns EnhancedGameScore with:
    - Overall score (0-100)
    - Three dimension scores with sub-scores
    - Wow factors (money saved, percentile, summary)
    - Hardware tier info
    """
    # Get existing data
    history = get_optimization_history(game_id)
    if not history:
        return None

    benchmark = get_benchmark_pair(game_id)

    # Get game name from history if available
    if history and history[0].get("game_name"):
        game_name = history[0]["game_name"]

    # Calculate dimensions
    performance = calculate_performance_dimension(benchmark, history)
    experience = calculate_experience_dimension(benchmark, {})
    competitive = calculate_competitive_dimension(benchmark, history)

    # Overall score is weighted average of dimension scores
    overall = (
        performance['weighted'] * DIMENSION_WEIGHTS['performance'] +
        experience['weighted'] * DIMENSION_WEIGHTS['experience'] +
        competitive['weighted'] * DIMENSION_WEIGHTS['competitive']
    )

    # Calculate wow factors
    fps_gain = performance['fpsGain']
    hardware_tier = detect_hardware_tier()
    money_saved = calculate_money_saved(fps_gain, hardware_tier['tier'])
    percentile = calculate_percentile_rank(int(overall), hardware_tier['tier'])

    # Improvement summary
    total_optimizations = len(history)
    biggest_gain = f"{game_name}: +{int(fps_gain)}% performance"

    improvement_summary = {
        'totalFpsGained': round(fps_gain, 1),
        'totalOptimizations': total_optimizations,
        'biggestGain': biggest_gain
    }

    # Build result using camelCase for frontend consistency
    result = {
        'game_id': game_id,
        'game_name': game_name,
        'score': int(overall),
        'dimensions': {
            'performance': performance,
            'experience': experience,
            'competitive': competitive
        },
        'wowFactors': {
            'moneySaved': money_saved,
            'percentileRank': percentile,
            'improvementSummary': improvement_summary
        },
        'hardwareTier': hardware_tier,
        'version': 2,
        'calculated_at': time.time() * 1000  # Milliseconds for JS
    }

    # Save enhanced score
    save_enhanced_score(game_id, result)

    return result


def save_enhanced_score(game_id: str, score_data: Dict):
    """Save enhanced score to disk."""
    game_dir = SCORES_DIR / game_id
    game_dir.mkdir(parents=True, exist_ok=True)

    # Save as enhanced score
    enhanced_path = game_dir / "enhanced.json"
    with open(enhanced_path, 'w') as f:
        json.dump(score_data, f, indent=2)


def calculate_opta_score() -> Optional[Dict]:
    """
    Calculate user's overall Opta Score across all games.

    Aggregates individual game scores into one shareable metric.
    """
    all_scores = get_all_scores()
    if not all_scores:
        return None

    # Calculate enhanced scores for each game
    enhanced_scores = []
    for game in all_scores:
        game_id = game.get('game_id')
        if game_id:
            enhanced = calculate_enhanced_score(game_id, game.get('game_name', 'Unknown'))
            if enhanced:
                enhanced_scores.append(enhanced)

    if not enhanced_scores:
        return None

    # Aggregate dimensions (average across games)
    perf_scores = [s['dimensions']['performance']['weighted'] for s in enhanced_scores]
    exp_scores = [s['dimensions']['experience']['weighted'] for s in enhanced_scores]
    comp_scores = [s['dimensions']['competitive']['weighted'] for s in enhanced_scores]

    aggregated_dimensions = {
        'performance': {
            'fpsGain': round(sum(s['dimensions']['performance']['fpsGain'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'stability': round(sum(s['dimensions']['performance']['stability'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'loadTimes': round(sum(s['dimensions']['performance']['loadTimes'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'weighted': round(sum(perf_scores) / len(perf_scores), 1)
        },
        'experience': {
            'visualQuality': round(sum(s['dimensions']['experience']['visualQuality'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'thermalEfficiency': round(sum(s['dimensions']['experience']['thermalEfficiency'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'responsiveness': round(sum(s['dimensions']['experience']['responsiveness'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'weighted': round(sum(exp_scores) / len(exp_scores), 1)
        },
        'competitive': {
            'inputLag': round(sum(s['dimensions']['competitive']['inputLag'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'networkLatency': round(sum(s['dimensions']['competitive']['networkLatency'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'interference': round(sum(s['dimensions']['competitive']['interference'] for s in enhanced_scores) / len(enhanced_scores), 1),
            'weighted': round(sum(comp_scores) / len(comp_scores), 1)
        }
    }

    # Calculate overall from aggregated dimensions
    overall = (
        aggregated_dimensions['performance']['weighted'] * DIMENSION_WEIGHTS['performance'] +
        aggregated_dimensions['experience']['weighted'] * DIMENSION_WEIGHTS['experience'] +
        aggregated_dimensions['competitive']['weighted'] * DIMENSION_WEIGHTS['competitive']
    )

    # Aggregate wow factors
    total_fps = sum(s['wowFactors']['improvementSummary']['totalFpsGained'] for s in enhanced_scores)
    total_optimizations = sum(s['wowFactors']['improvementSummary']['totalOptimizations'] for s in enhanced_scores)
    total_money = sum(s['wowFactors']['moneySaved']['amount'] for s in enhanced_scores)

    # Find biggest gain across all games
    biggest_gain_score = max(enhanced_scores, key=lambda x: x['dimensions']['performance']['fpsGain'])
    biggest_gain = biggest_gain_score['wowFactors']['improvementSummary']['biggestGain']

    hardware_tier = detect_hardware_tier()
    percentile = calculate_percentile_rank(int(overall), hardware_tier['tier'])

    # Load or create history
    opta_history = []
    if OPTA_SCORE_FILE.exists():
        try:
            with open(OPTA_SCORE_FILE, 'r') as f:
                existing = json.load(f)
                opta_history = existing.get('history', [])
        except Exception:
            pass

    # Add new history entry
    opta_history.append({
        'score': int(overall),
        'timestamp': time.time() * 1000,
        'trigger': f"recalculated:{len(enhanced_scores)}_games"
    })

    # Keep last 100 entries
    opta_history = opta_history[-100:]

    result = {
        'overall': int(overall),
        'dimensions': aggregated_dimensions,
        'wowFactors': {
            'moneySaved': {
                'amount': total_money,
                'equivalent': f"${total_money} in hardware upgrades",
                'explanation': f"Total value from optimizing {len(enhanced_scores)} games"
            },
            'percentileRank': percentile,
            'improvementSummary': {
                'totalFpsGained': round(total_fps, 1),
                'totalOptimizations': total_optimizations,
                'biggestGain': biggest_gain
            }
        },
        'hardwareTier': hardware_tier,
        'gamesOptimized': len(enhanced_scores),
        'lastCalculated': time.time() * 1000,
        'history': opta_history
    }

    # Save Opta Score
    SCORES_DIR.mkdir(parents=True, exist_ok=True)
    with open(OPTA_SCORE_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    return result


def get_hardware_tier() -> Dict:
    """Get current hardware tier information."""
    return detect_hardware_tier()
