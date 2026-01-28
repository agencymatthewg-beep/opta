//! Opta Score types
//!
//! Types for representing the Opta optimization score system.

use serde::{Deserialize, Serialize};

/// The main Opta Score - aggregate of all optimization efforts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OptaScore {
    /// Total score (0-1000)
    pub total: u32,
    /// Performance component score (0-350)
    pub performance_score: f64,
    /// Optimization depth score (0-300)
    pub depth_score: f64,
    /// System stability score (0-200)
    pub stability_score: f64,
    /// Efficiency bonus (0-150)
    pub efficiency_bonus: f64,
    /// Hardware tier being scored
    pub hardware_tier: String,
    /// Number of games contributing to score
    pub games_optimized: u32,
    /// Timestamp of calculation (Unix epoch ms)
    pub calculated_at: u64,
}

/// Individual game optimization score
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GameScore {
    /// Game identifier
    pub game_id: String,
    /// Game name
    pub game_name: String,
    /// Total score for this game (0-100)
    pub score: u32,
    /// Detailed breakdown
    pub breakdown: ScoreBreakdown,
    /// Timestamp of calculation (Unix epoch ms)
    pub calculated_at: u64,
    /// Timestamp of last optimization (Unix epoch ms)
    pub optimization_timestamp: Option<u64>,
    /// Timestamp of last benchmark (Unix epoch ms)
    pub benchmark_timestamp: Option<u64>,
}

/// Detailed score breakdown for a game
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScoreBreakdown {
    /// Base score from hardware tier
    pub base_score: u32,
    /// Performance contribution (FPS improvement, etc.)
    pub performance_score: f64,
    /// Depth of optimization (actions taken)
    pub depth_score: f64,
    /// System stability during optimization
    pub stability_score: f64,
    /// CPU optimization contribution
    pub cpu_contribution: f64,
    /// Memory optimization contribution
    pub memory_contribution: f64,
    /// GPU/thermal contribution
    pub gpu_temp_contribution: f64,
    /// Number of optimization actions taken
    pub actions_count: u32,
    /// Types of actions used
    pub action_types_used: Vec<String>,
    /// Bonus for using diverse optimization strategies
    pub diversity_bonus: f64,
    /// Successfully applied actions
    pub actions_applied: u32,
    /// Failed action attempts
    pub actions_failed: u32,
    /// Success rate (0.0 - 1.0)
    pub success_rate: f64,
}

/// Global statistics across all optimizations
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalStats {
    /// Total games ever optimized
    pub total_games_optimized: u32,
    /// Average score across all games
    pub average_score: f64,
    /// Highest score achieved
    pub highest_score: u32,
    /// Game with highest score
    pub highest_score_game: String,
    /// Total optimization sessions
    pub total_sessions: u32,
    /// Total time saved (estimated, in seconds)
    pub total_time_saved_seconds: u64,
    /// Total memory freed (cumulative, in bytes)
    pub total_memory_freed_bytes: u64,
    /// Last update timestamp (Unix epoch ms)
    pub last_updated: u64,
}

/// Historical score entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreHistoryEntry {
    /// Score at this point in time
    pub score: u32,
    /// Timestamp (Unix epoch ms)
    pub timestamp: u64,
    /// What triggered this score update
    pub trigger: ScoreTrigger,
    /// Optional note about the change
    pub note: Option<String>,
}

/// What triggered a score update
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ScoreTrigger {
    /// Manual optimization by user
    #[default]
    ManualOptimization,
    /// Automatic background optimization
    AutoOptimization,
    /// Stealth mode execution
    StealthMode,
    /// Benchmark run
    Benchmark,
    /// Score recalculation
    Recalculation,
}

/// Score change notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreChange {
    /// Previous score
    pub old_score: u32,
    /// New score
    pub new_score: u32,
    /// Change amount (can be negative)
    pub delta: i32,
    /// Reason for change
    pub reason: String,
    /// Game affected (if applicable)
    pub game_id: Option<String>,
    /// Timestamp (Unix epoch ms)
    pub timestamp: u64,
}

/// Leaderboard entry for sharing/comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    /// User identifier (anonymized)
    pub user_id: String,
    /// Display name
    pub display_name: String,
    /// Opta Score
    pub score: u32,
    /// Hardware tier
    pub hardware_tier: String,
    /// Number of games optimized
    pub games_count: u32,
    /// Rank on leaderboard
    pub rank: u32,
    /// Timestamp of score (Unix epoch ms)
    pub timestamp: u64,
}

/// Score sharing format for social/clipboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareableScore {
    /// The score value
    pub score: u32,
    /// Display message
    pub message: String,
    /// Short URL or code
    pub share_code: String,
    /// Hardware summary
    pub hardware: String,
    /// Top optimized games
    pub top_games: Vec<String>,
}
