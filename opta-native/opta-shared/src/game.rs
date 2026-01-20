//! Game detection types
//!
//! Types for representing detected games and launchers.

use serde::{Deserialize, Serialize};

/// Information about a detected game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    /// Unique game identifier (e.g., "steam_730", "epic_Fortnite")
    pub id: String,
    /// Display name of the game
    pub name: String,
    /// Launcher that owns the game
    pub launcher: GameLauncher,
    /// Installation path on disk
    pub install_path: String,
    /// Size in bytes (if available)
    pub size_bytes: Option<u64>,
    /// Cover art URL or path (if available)
    pub cover_image: Option<String>,
    /// Last played timestamp (Unix epoch)
    pub last_played: Option<u64>,
    /// Total play time in seconds
    pub play_time_seconds: Option<u64>,
    /// Whether the game is currently running
    pub is_running: bool,
}

impl Default for DetectedGame {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            launcher: GameLauncher::Unknown,
            install_path: String::new(),
            size_bytes: None,
            cover_image: None,
            last_played: None,
            play_time_seconds: None,
            is_running: false,
        }
    }
}

/// Game launcher/platform identifier
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub enum GameLauncher {
    Steam,
    EpicGames,
    GOG,
    BattleNet,
    Origin,
    Ubisoft,
    Xbox,
    PlayStation,
    /// Standalone game without launcher
    Standalone,
    #[default]
    Unknown,
}

impl GameLauncher {
    /// Parse from string representation
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "steam" => Self::Steam,
            "epic" | "epic games" | "epicgames" => Self::EpicGames,
            "gog" | "gog galaxy" => Self::GOG,
            "battlenet" | "battle.net" | "blizzard" => Self::BattleNet,
            "origin" | "ea" => Self::Origin,
            "ubisoft" | "uplay" | "ubisoft connect" => Self::Ubisoft,
            "xbox" | "microsoft" => Self::Xbox,
            "playstation" | "psn" => Self::PlayStation,
            "standalone" => Self::Standalone,
            _ => Self::Unknown,
        }
    }

    /// Get display name for the launcher
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Steam => "Steam",
            Self::EpicGames => "Epic Games",
            Self::GOG => "GOG Galaxy",
            Self::BattleNet => "Battle.net",
            Self::Origin => "EA App",
            Self::Ubisoft => "Ubisoft Connect",
            Self::Xbox => "Xbox",
            Self::PlayStation => "PlayStation",
            Self::Standalone => "Standalone",
            Self::Unknown => "Unknown",
        }
    }
}

/// Information about a detected launcher.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LauncherInfo {
    /// Launcher identifier
    pub launcher: GameLauncher,
    /// Display name (e.g., "Steam", "Epic Games")
    pub name: String,
    /// Whether the launcher is installed
    pub installed: bool,
    /// Installation path (if detected)
    pub install_path: Option<String>,
    /// Number of games detected from this launcher
    pub game_count: u32,
    /// Whether the launcher is currently running
    pub is_running: bool,
}

/// Result of game detection across all launchers.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GameDetectionResult {
    /// Total number of games found
    pub total_games: u32,
    /// Information about each launcher
    pub launchers: Vec<LauncherInfo>,
    /// List of all detected games
    pub games: Vec<DetectedGame>,
    /// Time taken for detection in milliseconds
    pub scan_duration_ms: u64,
}

/// Game optimization settings from community database or AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameOptimization {
    /// Game ID this optimization applies to
    pub game_id: String,
    /// Game name
    pub name: String,
    /// Recommended graphics settings
    pub graphics_settings: Option<GraphicsPreset>,
    /// Recommended launch options
    pub launch_options: Vec<String>,
    /// Optimization tips
    pub tips: Vec<String>,
    /// Source of recommendations
    pub source: OptimizationSource,
    /// Confidence level (0.0 - 1.0)
    pub confidence: f32,
    /// Hardware tier this optimization targets
    pub target_tier: Option<HardwareTier>,
}

impl Default for GameOptimization {
    fn default() -> Self {
        Self {
            game_id: String::new(),
            name: String::new(),
            graphics_settings: None,
            launch_options: Vec::new(),
            tips: Vec::new(),
            source: OptimizationSource::Generic,
            confidence: 0.0,
            target_tier: None,
        }
    }
}

/// Source of optimization recommendations
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum OptimizationSource {
    /// Community-verified database
    Database,
    /// AI-generated recommendations
    AI,
    /// User-submitted settings
    Community,
    /// Generic fallback
    #[default]
    Generic,
}

/// Graphics preset level
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum GraphicsPreset {
    Low,
    #[default]
    Medium,
    High,
    Ultra,
    Custom,
}

/// Hardware tier classification
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum HardwareTier {
    /// Entry-level gaming hardware
    Entry,
    /// Mid-range gaming hardware
    #[default]
    Mid,
    /// High-end gaming hardware
    High,
    /// Enthusiast/professional grade
    Enthusiast,
}

impl HardwareTier {
    /// Get display name
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Entry => "Entry Level",
            Self::Mid => "Mid Range",
            Self::High => "High End",
            Self::Enthusiast => "Enthusiast",
        }
    }
}
