//! Application Model (State)
//!
//! The Model represents the complete application state at any point in time.
//! It is immutable - updates create new Model instances.

use serde::{Deserialize, Serialize};
use opta_shared::{
    SystemTelemetry, ProcessInfo, DetectedGame, OptaScore, GameScore,
    ThermalState, MemoryPressure,
};

/// Complete application state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Model {
    /// Current navigation/view state
    pub navigation: NavigationState,

    /// Hardware telemetry data
    pub telemetry: TelemetryState,

    /// Process management state
    pub processes: ProcessState,

    /// Game detection state
    pub games: GameState,

    /// Scoring state
    pub scoring: ScoringState,

    /// Settings and preferences
    pub settings: SettingsState,

    /// UI state (animations, selections, etc.)
    pub ui: UiState,

    /// Error state for displaying to user
    pub error: Option<ErrorState>,

    /// Loading indicators
    pub loading: LoadingState,
}

/// Navigation and routing state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NavigationState {
    /// Current active page/view
    pub current_page: Page,
    /// Navigation history for back navigation
    pub history: Vec<Page>,
    /// Selected game ID (if on game detail view)
    pub selected_game_id: Option<String>,
    /// Whether sidebar is expanded
    pub sidebar_expanded: bool,
}

/// Available pages/views in the app
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum Page {
    #[default]
    Dashboard,
    Optimize,
    Games,
    GameDetail,
    Processes,
    Settings,
    Chess,
    AiChat,
}

/// Hardware telemetry state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelemetryState {
    /// Latest telemetry snapshot
    pub current: SystemTelemetry,
    /// Historical CPU usage (last 60 samples)
    pub cpu_history: Vec<f32>,
    /// Historical memory usage (last 60 samples)
    pub memory_history: Vec<f32>,
    /// Historical GPU usage (last 60 samples)
    pub gpu_history: Vec<f32>,
    /// Current thermal state
    pub thermal_state: ThermalState,
    /// Current memory pressure
    pub memory_pressure: MemoryPressure,
    /// Whether telemetry collection is active
    pub is_collecting: bool,
    /// Last update timestamp (Unix epoch ms)
    pub last_update: u64,
}

/// Process management state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessState {
    /// List of running processes
    pub processes: Vec<ProcessInfo>,
    /// Processes currently selected for action
    pub selected_pids: Vec<u32>,
    /// Filter/sort settings
    pub filter: ProcessFilter,
    /// Whether stealth mode is active
    pub stealth_mode_active: bool,
    /// Last stealth mode results
    pub last_stealth_result: Option<StealthModeResultState>,
}

/// Process filter settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProcessFilter {
    /// Search query
    pub search: String,
    /// Minimum CPU to show
    pub min_cpu: f32,
    /// Show only killable processes
    pub only_killable: bool,
    /// Sort order
    pub sort_by: ProcessSortBy,
    /// Sort direction
    pub sort_ascending: bool,
}

/// Process sort options
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ProcessSortBy {
    #[default]
    Cpu,
    Memory,
    Name,
    Pid,
}

/// Stealth mode result state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthModeResultState {
    /// Number of processes terminated
    pub terminated_count: u32,
    /// Memory freed in bytes
    pub memory_freed_bytes: u64,
    /// When stealth mode was run
    pub timestamp: u64,
}

/// Game detection state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GameState {
    /// Detected games
    pub games: Vec<DetectedGame>,
    /// Whether detection is in progress
    pub is_scanning: bool,
    /// Last scan timestamp
    pub last_scan: u64,
    /// Search/filter query
    pub search: String,
    /// Selected launcher filter
    pub launcher_filter: Option<String>,
}

/// Scoring state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScoringState {
    /// Global Opta Score
    pub opta_score: OptaScore,
    /// Per-game scores
    pub game_scores: Vec<GameScore>,
    /// Whether score is being calculated
    pub is_calculating: bool,
    /// Score animation progress (0.0 - 1.0)
    pub animation_progress: f32,
}

/// Settings and preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsState {
    /// Enable telemetry collection
    pub telemetry_enabled: bool,
    /// Telemetry polling interval (ms)
    pub telemetry_interval_ms: u64,
    /// Enable background optimization
    pub auto_optimize: bool,
    /// Start at login
    pub launch_at_login: bool,
    /// Show in menu bar
    pub show_menu_bar: bool,
    /// Theme preference
    pub theme: Theme,
    /// Enable haptic feedback
    pub haptics_enabled: bool,
    /// Enable spatial audio
    pub spatial_audio_enabled: bool,
    /// Hardware tier override (if user wants to override detection)
    pub hardware_tier_override: Option<String>,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            telemetry_enabled: true,
            telemetry_interval_ms: 1000,
            auto_optimize: false,
            launch_at_login: false,
            show_menu_bar: true,
            theme: Theme::System,
            haptics_enabled: true,
            spatial_audio_enabled: true,
            hardware_tier_override: None,
        }
    }
}

/// Theme preference
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

/// UI state (transient, animations, selections)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UiState {
    /// Opta Ring animation state
    pub ring: RingState,
    /// Toast notifications queue
    pub toasts: Vec<Toast>,
    /// Modal state
    pub modal: Option<ModalState>,
    /// Whether onboarding is complete
    pub onboarding_complete: bool,
}

/// Opta Ring animation state
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RingState {
    /// Current animation phase
    pub phase: RingPhase,
    /// Animation progress (0.0 - 1.0)
    pub progress: f32,
    /// Ring energy level (affects visuals)
    pub energy: f32,
    /// Whether ring is expanded
    pub expanded: bool,
}

/// Ring animation phases
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum RingPhase {
    #[default]
    Idle,
    WakingUp,
    Active,
    Optimizing,
    Celebrating,
    Sleeping,
}

/// Toast notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Toast {
    /// Unique ID
    pub id: String,
    /// Message to display
    pub message: String,
    /// Toast type
    pub kind: ToastKind,
    /// Duration in ms (None = persistent)
    pub duration_ms: Option<u64>,
}

/// Toast types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ToastKind {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

/// Modal state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalState {
    /// Modal type
    pub kind: ModalKind,
    /// Modal title
    pub title: String,
    /// Modal content/message
    pub message: Option<String>,
}

/// Modal types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModalKind {
    Confirm,
    Alert,
    Input,
    GameOptimize,
    StealthModeConfirm,
}

/// Error state for user display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorState {
    /// Error title
    pub title: String,
    /// Error message
    pub message: String,
    /// Whether error is recoverable
    pub recoverable: bool,
    /// Suggested action
    pub action: Option<String>,
}

/// Loading indicators
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoadingState {
    /// Global loading overlay
    pub global: bool,
    /// Telemetry loading
    pub telemetry: bool,
    /// Processes loading
    pub processes: bool,
    /// Games loading
    pub games: bool,
    /// Score calculation loading
    pub scoring: bool,
}
