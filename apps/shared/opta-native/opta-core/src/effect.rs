//! Application Effects (Side Effects)
//!
//! Effects represent side effects that the shell must execute.
//! The core returns effects from the update function, and the shell
//! executes them and sends the results back as events.

use serde::{Deserialize, Serialize};
use opta_shared::{ProcessFilter, GameOptimization};

/// All possible effects (side effects) that the shell must execute.
///
/// Effects are serializable so they can be passed across the FFI boundary
/// to the Swift/Kotlin shell, which executes them and returns results as Events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Effect {
    // ============================================
    // PLATFORM EFFECTS
    // ============================================
    /// Collect system telemetry (CPU, RAM, GPU, thermal)
    CollectTelemetry {
        /// Unique effect ID for correlation
        id: String,
    },

    /// Get list of running processes
    GetProcesses {
        id: String,
        filter: Option<ProcessFilter>,
    },

    /// Terminate a process by PID
    TerminateProcess {
        id: String,
        pid: u32,
    },

    /// Execute stealth mode (terminate all safe-to-kill processes)
    ExecuteStealthMode {
        id: String,
    },

    /// Detect installed games
    DetectGames {
        id: String,
    },

    /// Get optimization settings for a game
    GetOptimization {
        id: String,
        game_id: String,
    },

    /// Apply optimization settings to a game
    ApplyOptimization {
        id: String,
        game_id: String,
        optimization: GameOptimization,
    },

    /// Launch a game
    LaunchGame {
        id: String,
        game_id: String,
    },

    // ============================================
    // SCORING EFFECTS
    // ============================================
    /// Calculate the global Opta Score
    CalculateOptaScore {
        id: String,
    },

    /// Calculate score for a specific game
    CalculateGameScore {
        id: String,
        game_id: String,
    },

    // ============================================
    // STORAGE EFFECTS
    // ============================================
    /// Save settings to persistent storage
    SaveSettings {
        id: String,
        settings: crate::model::SettingsState,
    },

    /// Load settings from persistent storage
    LoadSettings {
        id: String,
    },

    /// Save score history entry
    SaveScoreHistory {
        id: String,
        game_id: String,
        score: u32,
    },

    /// Load score history
    LoadScoreHistory {
        id: String,
        game_id: Option<String>,
    },

    // ============================================
    // TIMER EFFECTS
    // ============================================
    /// Schedule a timer (one-shot)
    ScheduleTimer {
        id: String,
        delay_ms: u64,
        event: Box<crate::event::Event>,
    },

    /// Schedule a repeating interval
    ScheduleInterval {
        id: String,
        interval_ms: u64,
        event: Box<crate::event::Event>,
    },

    /// Cancel a scheduled timer/interval
    CancelTimer {
        id: String,
    },

    // ============================================
    // UI EFFECTS
    // ============================================
    /// Play haptic feedback
    PlayHaptic {
        id: String,
        pattern: HapticPattern,
    },

    /// Play spatial audio
    PlaySpatialAudio {
        id: String,
        sound: SoundEffect,
        position: Option<AudioPosition>,
    },

    /// Copy text to clipboard
    CopyToClipboard {
        id: String,
        text: String,
    },

    /// Open URL in browser
    OpenUrl {
        id: String,
        url: String,
    },

    /// Request notification permission
    RequestNotificationPermission {
        id: String,
    },

    /// Show system notification
    ShowNotification {
        id: String,
        title: String,
        body: String,
    },

    // ============================================
    // SYSTEM EFFECTS
    // ============================================
    /// Set launch at login
    SetLaunchAtLogin {
        id: String,
        enabled: bool,
    },

    /// Get hardware tier
    GetHardwareTier {
        id: String,
    },

    /// Check for updates
    CheckForUpdates {
        id: String,
    },

    // ============================================
    // ANALYTICS EFFECTS (optional, privacy-respecting)
    // ============================================
    /// Track anonymous event (if user opted in)
    TrackEvent {
        id: String,
        event_name: String,
        properties: Option<serde_json::Value>,
    },
}

impl Effect {
    /// Generate a unique effect ID
    pub fn generate_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// Create a telemetry collection effect
    pub fn collect_telemetry() -> Self {
        Self::CollectTelemetry {
            id: Self::generate_id(),
        }
    }

    /// Create a process list effect
    pub fn get_processes(filter: Option<ProcessFilter>) -> Self {
        Self::GetProcesses {
            id: Self::generate_id(),
            filter,
        }
    }

    /// Create a terminate process effect
    pub fn terminate_process(pid: u32) -> Self {
        Self::TerminateProcess {
            id: Self::generate_id(),
            pid,
        }
    }

    /// Create a stealth mode effect
    pub fn stealth_mode() -> Self {
        Self::ExecuteStealthMode {
            id: Self::generate_id(),
        }
    }

    /// Create a game detection effect
    pub fn detect_games() -> Self {
        Self::DetectGames {
            id: Self::generate_id(),
        }
    }

    /// Create a timer effect
    pub fn timer(delay_ms: u64, event: crate::event::Event) -> Self {
        Self::ScheduleTimer {
            id: Self::generate_id(),
            delay_ms,
            event: Box::new(event),
        }
    }

    /// Create an interval effect
    pub fn interval(interval_ms: u64, event: crate::event::Event) -> Self {
        Self::ScheduleInterval {
            id: Self::generate_id(),
            interval_ms,
            event: Box::new(event),
        }
    }

    /// Get the effect ID
    pub fn id(&self) -> &str {
        match self {
            Self::CollectTelemetry { id } => id,
            Self::GetProcesses { id, .. } => id,
            Self::TerminateProcess { id, .. } => id,
            Self::ExecuteStealthMode { id } => id,
            Self::DetectGames { id } => id,
            Self::GetOptimization { id, .. } => id,
            Self::ApplyOptimization { id, .. } => id,
            Self::LaunchGame { id, .. } => id,
            Self::CalculateOptaScore { id } => id,
            Self::CalculateGameScore { id, .. } => id,
            Self::SaveSettings { id, .. } => id,
            Self::LoadSettings { id } => id,
            Self::SaveScoreHistory { id, .. } => id,
            Self::LoadScoreHistory { id, .. } => id,
            Self::ScheduleTimer { id, .. } => id,
            Self::ScheduleInterval { id, .. } => id,
            Self::CancelTimer { id } => id,
            Self::PlayHaptic { id, .. } => id,
            Self::PlaySpatialAudio { id, .. } => id,
            Self::CopyToClipboard { id, .. } => id,
            Self::OpenUrl { id, .. } => id,
            Self::RequestNotificationPermission { id } => id,
            Self::ShowNotification { id, .. } => id,
            Self::SetLaunchAtLogin { id, .. } => id,
            Self::GetHardwareTier { id } => id,
            Self::CheckForUpdates { id } => id,
            Self::TrackEvent { id, .. } => id,
        }
    }
}

/// Haptic feedback patterns
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum HapticPattern {
    /// Light tap (selection, toggle)
    Light,
    /// Medium tap (action confirmed)
    Medium,
    /// Heavy tap (important action)
    Heavy,
    /// Success pattern
    Success,
    /// Warning pattern
    Warning,
    /// Error pattern
    Error,
    /// Optimization in progress
    OptimizingPulse,
    /// Score increase celebration
    ScoreCelebration,
}

/// Sound effects for spatial audio
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SoundEffect {
    /// Button click
    Click,
    /// Navigation transition
    Transition,
    /// Optimization started
    OptimizeStart,
    /// Optimization complete
    OptimizeComplete,
    /// Score increase
    ScoreUp,
    /// Error/warning
    Alert,
    /// Ring wake up
    RingWake,
    /// Ring sleep
    RingSleep,
}

/// 3D position for spatial audio
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct AudioPosition {
    /// X position (-1.0 to 1.0, left to right)
    pub x: f32,
    /// Y position (-1.0 to 1.0, bottom to top)
    pub y: f32,
    /// Z position (0.0 to 1.0, front to back)
    pub z: f32,
}

impl Default for AudioPosition {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.5,
        }
    }
}
