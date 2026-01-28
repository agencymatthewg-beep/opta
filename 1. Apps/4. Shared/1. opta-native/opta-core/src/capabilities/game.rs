//! Game Capability
//!
//! Defines the interface for game detection and management.

use opta_shared::{
    DetectedGame, GameLauncher, LauncherInfo, GameDetectionResult,
    GameOptimization, OptaResult,
};

/// Capability for game detection and management
pub trait GameCapability {
    /// Detect all installed games across all launchers
    fn detect_all(&self) -> OptaResult<GameDetectionResult>;

    /// Detect games for a specific launcher
    fn detect_for_launcher(&self, launcher: GameLauncher) -> OptaResult<Vec<DetectedGame>>;

    /// Get info for a specific game
    fn get_game(&self, game_id: &str) -> OptaResult<Option<DetectedGame>>;

    /// Get installed launchers
    fn get_launchers(&self) -> OptaResult<Vec<LauncherInfo>>;

    /// Get optimization settings for a game
    fn get_optimization(&self, game_id: &str) -> OptaResult<GameOptimization>;

    /// Apply optimization settings to a game
    fn apply_optimization(&self, game_id: &str, optimization: &GameOptimization) -> OptaResult<bool>;

    /// Launch a game
    fn launch(&self, game_id: &str) -> OptaResult<()>;

    /// Check if a game is currently running
    fn is_running(&self, game_id: &str) -> OptaResult<bool>;
}

/// Game detection configuration
#[derive(Debug, Clone)]
pub struct GameConfig {
    /// Launchers to scan
    pub scan_launchers: Vec<GameLauncher>,
    /// Include size information (slower)
    pub include_size: bool,
    /// Include cover art paths
    pub include_covers: bool,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            scan_launchers: vec![
                GameLauncher::Steam,
                GameLauncher::EpicGames,
                GameLauncher::GOG,
                GameLauncher::BattleNet,
            ],
            include_size: true,
            include_covers: true,
        }
    }
}
