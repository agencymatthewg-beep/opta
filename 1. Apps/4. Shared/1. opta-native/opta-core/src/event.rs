//! Application Events
//!
//! All possible events that can occur in the application.
//! Events are the only way to trigger state changes.

use serde::{Deserialize, Serialize};
use opta_shared::{
    SystemTelemetry, ProcessInfo, DetectedGame, OptaScore, GameScore,
    TerminateResult, StealthModeResult, GameOptimization, OptaError,
};

use crate::model::{Page, Theme, ProcessSortBy, RingPhase, Toast, ModalState};

/// All possible application events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    // ============================================
    // LIFECYCLE EVENTS
    // ============================================
    /// App started - initialize everything
    AppStarted,
    /// App going to background
    AppBackgrounded,
    /// App returning to foreground
    AppForegrounded,
    /// App about to quit
    AppQuitting,

    // ============================================
    // NAVIGATION EVENTS
    // ============================================
    /// Navigate to a page
    NavigateTo(Page),
    /// Go back in navigation history
    NavigateBack,
    /// Select a game (navigates to detail)
    SelectGame(String),
    /// Toggle sidebar expansion
    ToggleSidebar,

    // ============================================
    // TELEMETRY EVENTS
    // ============================================
    /// Start collecting telemetry
    StartTelemetry,
    /// Stop collecting telemetry
    StopTelemetry,
    /// Telemetry tick - request new data
    TelemetryTick,
    /// Received telemetry data from platform
    TelemetryReceived(SystemTelemetry),
    /// Telemetry collection failed
    TelemetryError(String),

    // ============================================
    // PROCESS EVENTS
    // ============================================
    /// Refresh process list
    RefreshProcesses,
    /// Received process list from platform
    ProcessesReceived(Vec<ProcessInfo>),
    /// Process list fetch failed
    ProcessesError(String),
    /// Select/deselect a process
    ToggleProcessSelection(u32),
    /// Clear process selection
    ClearProcessSelection,
    /// Terminate selected processes
    TerminateSelected,
    /// Single process termination result
    TerminateResult(TerminateResult),
    /// Execute stealth mode
    ExecuteStealthMode,
    /// Stealth mode completed
    StealthModeCompleted(StealthModeResult),
    /// Update process filter
    UpdateProcessFilter {
        search: Option<String>,
        min_cpu: Option<f32>,
        only_killable: Option<bool>,
        sort_by: Option<ProcessSortBy>,
        sort_ascending: Option<bool>,
    },

    // ============================================
    // GAME EVENTS
    // ============================================
    /// Scan for installed games
    ScanGames,
    /// Received game detection results
    GamesReceived(Vec<DetectedGame>),
    /// Game detection failed
    GamesError(String),
    /// Update game search filter
    UpdateGameSearch(String),
    /// Filter by launcher
    FilterByLauncher(Option<String>),
    /// Get optimization for a game
    GetGameOptimization(String),
    /// Received game optimization settings
    GameOptimizationReceived {
        game_id: String,
        optimization: GameOptimization,
    },
    /// Apply optimization to a game
    ApplyOptimization {
        game_id: String,
        optimization: GameOptimization,
    },
    /// Optimization applied successfully
    OptimizationApplied {
        game_id: String,
        success: bool,
        message: String,
    },
    /// Launch a game
    LaunchGame(String),
    /// Game launched
    GameLaunched(String),

    // ============================================
    // SCORING EVENTS
    // ============================================
    /// Calculate/refresh Opta Score
    CalculateScore,
    /// Score calculation completed
    ScoreCalculated(OptaScore),
    /// Calculate score for specific game
    CalculateGameScore(String),
    /// Game score calculated
    GameScoreCalculated(GameScore),
    /// Score calculation error
    ScoreError(String),
    /// Update score animation progress
    UpdateScoreAnimation(f32),

    // ============================================
    // SETTINGS EVENTS
    // ============================================
    /// Toggle telemetry collection
    ToggleTelemetryEnabled,
    /// Set telemetry interval
    SetTelemetryInterval(u64),
    /// Toggle auto-optimize
    ToggleAutoOptimize,
    /// Toggle launch at login
    ToggleLaunchAtLogin,
    /// Toggle menu bar visibility
    ToggleMenuBar,
    /// Set theme
    SetTheme(Theme),
    /// Toggle haptics
    ToggleHaptics,
    /// Toggle spatial audio
    ToggleSpatialAudio,
    /// Override hardware tier
    SetHardwareTier(Option<String>),
    /// Settings saved to storage
    SettingsSaved,
    /// Load settings from storage
    LoadSettings,
    /// Settings loaded
    SettingsLoaded(crate::model::SettingsState),

    // ============================================
    // UI EVENTS
    // ============================================
    /// Update ring animation state
    UpdateRingPhase(RingPhase),
    /// Update ring animation progress
    UpdateRingProgress(f32),
    /// Set ring energy level
    SetRingEnergy(f32),
    /// Toggle ring expansion
    ToggleRingExpanded,
    /// Show toast notification
    ShowToast(Toast),
    /// Dismiss toast
    DismissToast(String),
    /// Show modal
    ShowModal(ModalState),
    /// Dismiss modal
    DismissModal,
    /// Modal confirmed
    ModalConfirmed,
    /// Complete onboarding
    CompleteOnboarding,

    // ============================================
    // ERROR EVENTS
    // ============================================
    /// Show error to user
    ShowError {
        title: String,
        message: String,
        recoverable: bool,
    },
    /// Dismiss error
    DismissError,
    /// Platform error occurred
    PlatformError(OptaError),

    // ============================================
    // EFFECT RESPONSES
    // ============================================
    /// Generic effect completed successfully
    EffectCompleted {
        effect_id: String,
        result: serde_json::Value,
    },
    /// Effect failed
    EffectFailed {
        effect_id: String,
        error: String,
    },
}

impl Event {
    /// Check if this event requires platform capabilities
    pub fn requires_platform(&self) -> bool {
        matches!(
            self,
            Event::StartTelemetry
                | Event::TelemetryTick
                | Event::RefreshProcesses
                | Event::TerminateSelected
                | Event::ExecuteStealthMode
                | Event::ScanGames
                | Event::LaunchGame(_)
                | Event::ApplyOptimization { .. }
        )
    }

    /// Check if this event is a user interaction
    pub fn is_user_interaction(&self) -> bool {
        matches!(
            self,
            Event::NavigateTo(_)
                | Event::NavigateBack
                | Event::SelectGame(_)
                | Event::ToggleProcessSelection(_)
                | Event::TerminateSelected
                | Event::ExecuteStealthMode
                | Event::ScanGames
                | Event::LaunchGame(_)
                | Event::ToggleTelemetryEnabled
                | Event::SetTheme(_)
                | Event::ShowModal(_)
                | Event::ModalConfirmed
        )
    }
}
