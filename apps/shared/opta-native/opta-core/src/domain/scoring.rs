//! Score Calculator
//!
//! Pure business logic for calculating Opta Score and game scores.

use opta_shared::{
    OptaScore, GameScore, ScoreBreakdown,
};

/// Calculator for Opta Score
pub struct ScoreCalculator {
    /// Configuration
    config: ScoreConfig,
}

/// Scoring configuration
#[derive(Debug, Clone)]
pub struct ScoreConfig {
    /// Base score for hardware tier
    pub base_scores: HardwareTierScores,
    /// Weight for performance component
    pub performance_weight: f64,
    /// Weight for depth component
    pub depth_weight: f64,
    /// Weight for stability component
    pub stability_weight: f64,
    /// Maximum total score
    pub max_score: u32,
}

/// Base scores for each hardware tier
#[derive(Debug, Clone)]
pub struct HardwareTierScores {
    pub entry: u32,
    pub mid: u32,
    pub high: u32,
    pub enthusiast: u32,
}

impl Default for HardwareTierScores {
    fn default() -> Self {
        Self {
            entry: 100,
            mid: 200,
            high: 300,
            enthusiast: 400,
        }
    }
}

impl Default for ScoreConfig {
    fn default() -> Self {
        Self {
            base_scores: HardwareTierScores::default(),
            performance_weight: 0.35,
            depth_weight: 0.30,
            stability_weight: 0.20,
            max_score: 1000,
        }
    }
}

/// Optimization session data for scoring
#[derive(Debug, Clone)]
pub struct OptimizationSession {
    /// Game ID
    pub game_id: String,
    /// Actions taken
    pub actions: Vec<String>,
    /// CPU improvement percentage
    pub cpu_improvement: f64,
    /// Memory improvement percentage
    pub memory_improvement: f64,
    /// Temperature improvement (degrees C)
    pub temp_improvement: f64,
    /// Session duration (ms)
    pub duration_ms: u64,
    /// Whether session completed successfully
    pub success: bool,
}

impl ScoreCalculator {
    /// Create a new score calculator
    pub fn new() -> Self {
        Self {
            config: ScoreConfig::default(),
        }
    }

    /// Create with custom config
    pub fn with_config(config: ScoreConfig) -> Self {
        Self { config }
    }

    /// Calculate overall Opta Score from game scores
    pub fn calculate_opta_score(
        &self,
        game_scores: &[GameScore],
        hardware_tier: &str,
    ) -> OptaScore {
        if game_scores.is_empty() {
            return OptaScore {
                hardware_tier: hardware_tier.to_string(),
                calculated_at: current_timestamp(),
                ..Default::default()
            };
        }

        // Base score from hardware tier
        let base = match hardware_tier.to_lowercase().as_str() {
            "entry" => self.config.base_scores.entry,
            "mid" => self.config.base_scores.mid,
            "high" => self.config.base_scores.high,
            "enthusiast" => self.config.base_scores.enthusiast,
            _ => self.config.base_scores.mid,
        };

        // Calculate component scores
        let performance_score = self.calculate_performance_component(game_scores);
        let depth_score = self.calculate_depth_component(game_scores);
        let stability_score = self.calculate_stability_component(game_scores);

        // Efficiency bonus based on number of games
        let efficiency_bonus = (game_scores.len() as f64 * 10.0).min(150.0);

        // Total score
        let total = (base as f64
            + performance_score
            + depth_score
            + stability_score
            + efficiency_bonus)
            .min(self.config.max_score as f64) as u32;

        OptaScore {
            total,
            performance_score,
            depth_score,
            stability_score,
            efficiency_bonus,
            hardware_tier: hardware_tier.to_string(),
            games_optimized: game_scores.len() as u32,
            calculated_at: current_timestamp(),
        }
    }

    /// Calculate score for a single game optimization session
    pub fn calculate_game_score(
        &self,
        session: &OptimizationSession,
        hardware_tier: &str,
    ) -> GameScore {
        let base_score = match hardware_tier.to_lowercase().as_str() {
            "entry" => 10,
            "mid" => 20,
            "high" => 30,
            "enthusiast" => 40,
            _ => 20,
        };

        // Performance score (0-35)
        let performance_score = (session.cpu_improvement * 0.15
            + session.memory_improvement * 0.15
            + session.temp_improvement * 0.05)
            .clamp(0.0, 35.0);

        // Depth score based on actions (0-30)
        let depth_score = (session.actions.len() as f64 * 5.0).min(30.0);

        // Diversity bonus
        let unique_action_types: std::collections::HashSet<_> =
            session.actions.iter().map(|a| a.split('_').next().unwrap_or(a)).collect();
        let diversity_bonus = (unique_action_types.len() as f64 * 2.0).min(10.0);

        // Stability score
        let stability_score = if session.success { 20.0 } else { 5.0 };

        // Success rate
        let success_rate = if session.success { 1.0 } else { 0.5 };

        let total = (base_score as f64
            + performance_score
            + depth_score
            + diversity_bonus
            + stability_score)
            .min(100.0) as u32;

        GameScore {
            game_id: session.game_id.clone(),
            game_name: session.game_id.clone(), // Caller should set proper name
            score: total,
            breakdown: ScoreBreakdown {
                base_score,
                performance_score,
                depth_score,
                stability_score,
                cpu_contribution: session.cpu_improvement,
                memory_contribution: session.memory_improvement,
                gpu_temp_contribution: session.temp_improvement,
                actions_count: session.actions.len() as u32,
                action_types_used: session.actions.clone(),
                diversity_bonus,
                actions_applied: session.actions.len() as u32,
                actions_failed: if session.success { 0 } else { 1 },
                success_rate,
            },
            calculated_at: current_timestamp(),
            optimization_timestamp: Some(current_timestamp()),
            benchmark_timestamp: None,
        }
    }

    /// Calculate performance component from game scores
    fn calculate_performance_component(&self, game_scores: &[GameScore]) -> f64 {
        if game_scores.is_empty() {
            return 0.0;
        }

        let avg_performance: f64 = game_scores
            .iter()
            .map(|s| s.breakdown.performance_score)
            .sum::<f64>()
            / game_scores.len() as f64;

        (avg_performance * self.config.performance_weight * 10.0).min(350.0)
    }

    /// Calculate depth component from game scores
    fn calculate_depth_component(&self, game_scores: &[GameScore]) -> f64 {
        if game_scores.is_empty() {
            return 0.0;
        }

        let avg_depth: f64 = game_scores
            .iter()
            .map(|s| s.breakdown.depth_score)
            .sum::<f64>()
            / game_scores.len() as f64;

        (avg_depth * self.config.depth_weight * 10.0).min(300.0)
    }

    /// Calculate stability component from game scores
    fn calculate_stability_component(&self, game_scores: &[GameScore]) -> f64 {
        if game_scores.is_empty() {
            return 0.0;
        }

        let avg_stability: f64 = game_scores
            .iter()
            .map(|s| s.breakdown.stability_score)
            .sum::<f64>()
            / game_scores.len() as f64;

        (avg_stability * self.config.stability_weight * 10.0).min(200.0)
    }
}

impl Default for ScoreCalculator {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current timestamp in milliseconds
fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
