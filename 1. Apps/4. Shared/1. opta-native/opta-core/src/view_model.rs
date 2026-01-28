//! View Model
//!
//! The ViewModel is the serializable representation of the UI state that gets
//! sent to the shell (UI layer). It contains only the data needed to render
//! the current view, derived from the full Model state.

use serde::{Deserialize, Serialize};
use crate::model::{
    Model, Page, ErrorState, RingPhase, RingState,
    Toast, ModalState, Theme,
};
use opta_shared::{ThermalState, MemoryPressure};

/// The view model exposed to the UI shell.
///
/// This is a flattened, serializable representation of the application state
/// optimized for UI rendering. The shell receives this on every state change.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ViewModel {
    // ============================================
    // NAVIGATION
    // ============================================
    /// Current page/view being displayed
    pub current_page: PageViewModel,
    /// Whether back navigation is available
    pub can_go_back: bool,
    /// Selected game ID (if on game detail view)
    pub selected_game_id: Option<String>,
    /// Whether sidebar is expanded
    pub sidebar_expanded: bool,

    // ============================================
    // TELEMETRY SUMMARY
    // ============================================
    /// Current CPU usage percentage
    pub cpu_usage: f32,
    /// Current memory usage percentage
    pub memory_usage: f32,
    /// Current GPU usage percentage (if available)
    pub gpu_usage: Option<f32>,
    /// Current thermal state
    pub thermal_state: ThermalStateViewModel,
    /// Current memory pressure
    pub memory_pressure: MemoryPressureViewModel,
    /// CPU usage history (last 60 samples)
    pub cpu_history: Vec<f32>,
    /// Memory usage history (last 60 samples)
    pub memory_history: Vec<f32>,
    /// GPU usage history (last 60 samples)
    pub gpu_history: Vec<f32>,
    /// Whether telemetry is being collected
    pub telemetry_active: bool,

    // ============================================
    // PROCESSES
    // ============================================
    /// Number of running processes
    pub process_count: usize,
    /// Number of selected processes
    pub selected_process_count: usize,
    /// Whether stealth mode is active
    pub stealth_mode_active: bool,
    /// Last stealth mode result summary
    pub last_stealth_result: Option<StealthResultViewModel>,

    // ============================================
    // GAMES
    // ============================================
    /// Number of detected games
    pub game_count: usize,
    /// Whether game scanning is in progress
    pub games_scanning: bool,

    // ============================================
    // SCORING
    // ============================================
    /// Current Opta Score (0-100)
    pub opta_score: u8,
    /// Score grade (S, A, B, C, D, F)
    pub score_grade: String,
    /// Whether score is being calculated
    pub score_calculating: bool,
    /// Score animation progress (0.0 - 1.0)
    pub score_animation: f32,

    // ============================================
    // RING STATE
    // ============================================
    /// Ring animation state
    pub ring: RingViewModel,

    // ============================================
    // UI STATE
    // ============================================
    /// Active toasts to display
    pub toasts: Vec<ToastViewModel>,
    /// Current modal (if any)
    pub modal: Option<ModalViewModel>,
    /// Whether onboarding is complete
    pub onboarding_complete: bool,

    // ============================================
    // SETTINGS
    // ============================================
    /// Current theme
    pub theme: ThemeViewModel,
    /// Whether haptics are enabled
    pub haptics_enabled: bool,
    /// Whether spatial audio is enabled
    pub spatial_audio_enabled: bool,
    /// Whether telemetry collection is enabled
    pub telemetry_enabled: bool,
    /// Whether auto-optimize is enabled
    pub auto_optimize: bool,

    // ============================================
    // ERROR STATE
    // ============================================
    /// Current error (if any)
    pub error: Option<ErrorViewModel>,

    // ============================================
    // LOADING STATE
    // ============================================
    /// Global loading state
    pub loading: bool,
    /// Component-specific loading states
    pub loading_telemetry: bool,
    pub loading_processes: bool,
    pub loading_games: bool,
    pub loading_scoring: bool,
}

/// Page/view identifier for the UI
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum PageViewModel {
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

impl From<Page> for PageViewModel {
    fn from(page: Page) -> Self {
        match page {
            Page::Dashboard => PageViewModel::Dashboard,
            Page::Optimize => PageViewModel::Optimize,
            Page::Games => PageViewModel::Games,
            Page::GameDetail => PageViewModel::GameDetail,
            Page::Processes => PageViewModel::Processes,
            Page::Settings => PageViewModel::Settings,
            Page::Chess => PageViewModel::Chess,
            Page::AiChat => PageViewModel::AiChat,
        }
    }
}

/// Thermal state for UI display
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ThermalStateViewModel {
    #[default]
    Nominal,
    Fair,
    Serious,
    Critical,
}

impl From<ThermalState> for ThermalStateViewModel {
    fn from(state: ThermalState) -> Self {
        match state {
            ThermalState::Nominal => ThermalStateViewModel::Nominal,
            ThermalState::Fair => ThermalStateViewModel::Fair,
            ThermalState::Serious => ThermalStateViewModel::Serious,
            ThermalState::Critical => ThermalStateViewModel::Critical,
        }
    }
}

/// Memory pressure for UI display
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum MemoryPressureViewModel {
    #[default]
    Normal,
    Warning,
    Critical,
}

impl From<MemoryPressure> for MemoryPressureViewModel {
    fn from(pressure: MemoryPressure) -> Self {
        match pressure {
            MemoryPressure::Normal => MemoryPressureViewModel::Normal,
            MemoryPressure::Warning => MemoryPressureViewModel::Warning,
            MemoryPressure::Critical => MemoryPressureViewModel::Critical,
        }
    }
}

/// Ring animation state for UI
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RingViewModel {
    /// Current animation phase
    pub phase: RingPhaseViewModel,
    /// Animation progress (0.0 - 1.0)
    pub progress: f32,
    /// Ring energy level
    pub energy: f32,
    /// Whether ring is expanded
    pub expanded: bool,
}

impl From<&RingState> for RingViewModel {
    fn from(ring: &RingState) -> Self {
        RingViewModel {
            phase: RingPhaseViewModel::from(ring.phase),
            progress: ring.progress,
            energy: ring.energy,
            expanded: ring.expanded,
        }
    }
}

/// Ring animation phase for UI
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum RingPhaseViewModel {
    #[default]
    Idle,
    WakingUp,
    Active,
    Optimizing,
    Celebrating,
    Sleeping,
}

impl From<RingPhase> for RingPhaseViewModel {
    fn from(phase: RingPhase) -> Self {
        match phase {
            RingPhase::Idle => RingPhaseViewModel::Idle,
            RingPhase::WakingUp => RingPhaseViewModel::WakingUp,
            RingPhase::Active => RingPhaseViewModel::Active,
            RingPhase::Optimizing => RingPhaseViewModel::Optimizing,
            RingPhase::Celebrating => RingPhaseViewModel::Celebrating,
            RingPhase::Sleeping => RingPhaseViewModel::Sleeping,
        }
    }
}

/// Toast notification for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToastViewModel {
    pub id: String,
    pub message: String,
    pub kind: ToastKindViewModel,
    pub duration_ms: Option<u64>,
}

impl From<&Toast> for ToastViewModel {
    fn from(toast: &Toast) -> Self {
        ToastViewModel {
            id: toast.id.clone(),
            message: toast.message.clone(),
            kind: ToastKindViewModel::from(toast.kind),
            duration_ms: toast.duration_ms,
        }
    }
}

/// Toast kind for UI
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ToastKindViewModel {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

impl From<crate::model::ToastKind> for ToastKindViewModel {
    fn from(kind: crate::model::ToastKind) -> Self {
        match kind {
            crate::model::ToastKind::Info => ToastKindViewModel::Info,
            crate::model::ToastKind::Success => ToastKindViewModel::Success,
            crate::model::ToastKind::Warning => ToastKindViewModel::Warning,
            crate::model::ToastKind::Error => ToastKindViewModel::Error,
        }
    }
}

/// Modal state for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalViewModel {
    pub kind: ModalKindViewModel,
    pub title: String,
    pub message: Option<String>,
}

impl From<&ModalState> for ModalViewModel {
    fn from(modal: &ModalState) -> Self {
        ModalViewModel {
            kind: ModalKindViewModel::from(modal.kind),
            title: modal.title.clone(),
            message: modal.message.clone(),
        }
    }
}

/// Modal kind for UI
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModalKindViewModel {
    Confirm,
    Alert,
    Input,
    GameOptimize,
    StealthModeConfirm,
}

impl From<crate::model::ModalKind> for ModalKindViewModel {
    fn from(kind: crate::model::ModalKind) -> Self {
        match kind {
            crate::model::ModalKind::Confirm => ModalKindViewModel::Confirm,
            crate::model::ModalKind::Alert => ModalKindViewModel::Alert,
            crate::model::ModalKind::Input => ModalKindViewModel::Input,
            crate::model::ModalKind::GameOptimize => ModalKindViewModel::GameOptimize,
            crate::model::ModalKind::StealthModeConfirm => ModalKindViewModel::StealthModeConfirm,
        }
    }
}

/// Theme for UI
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum ThemeViewModel {
    Light,
    Dark,
    #[default]
    System,
}

impl From<Theme> for ThemeViewModel {
    fn from(theme: Theme) -> Self {
        match theme {
            Theme::Light => ThemeViewModel::Light,
            Theme::Dark => ThemeViewModel::Dark,
            Theme::System => ThemeViewModel::System,
        }
    }
}

/// Error state for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorViewModel {
    pub title: String,
    pub message: String,
    pub recoverable: bool,
    pub action: Option<String>,
}

impl From<&ErrorState> for ErrorViewModel {
    fn from(error: &ErrorState) -> Self {
        ErrorViewModel {
            title: error.title.clone(),
            message: error.message.clone(),
            recoverable: error.recoverable,
            action: error.action.clone(),
        }
    }
}

/// Stealth mode result summary for UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthResultViewModel {
    pub terminated_count: u32,
    pub memory_freed_mb: u64,
}

impl From<&Model> for ViewModel {
    fn from(model: &Model) -> Self {
        // Calculate memory usage percentage
        let memory_usage = if model.telemetry.current.memory.total_bytes > 0 {
            (model.telemetry.current.memory.used_bytes as f64
                / model.telemetry.current.memory.total_bytes as f64
                * 100.0) as f32
        } else {
            0.0
        };

        // Get GPU usage if available
        let gpu_usage = model.telemetry.current.gpu.as_ref().map(|g| g.utilization_percent);

        // Calculate score grade
        let score_grade = match model.scoring.opta_score.total {
            90..=100 => "S",
            80..=89 => "A",
            70..=79 => "B",
            60..=69 => "C",
            50..=59 => "D",
            _ => "F",
        }.to_string();

        ViewModel {
            // Navigation
            current_page: PageViewModel::from(model.navigation.current_page),
            can_go_back: !model.navigation.history.is_empty(),
            selected_game_id: model.navigation.selected_game_id.clone(),
            sidebar_expanded: model.navigation.sidebar_expanded,

            // Telemetry
            cpu_usage: model.telemetry.current.cpu.usage_percent,
            memory_usage,
            gpu_usage,
            thermal_state: ThermalStateViewModel::from(model.telemetry.thermal_state),
            memory_pressure: MemoryPressureViewModel::from(model.telemetry.memory_pressure),
            cpu_history: model.telemetry.cpu_history.clone(),
            memory_history: model.telemetry.memory_history.clone(),
            gpu_history: model.telemetry.gpu_history.clone(),
            telemetry_active: model.telemetry.is_collecting,

            // Processes
            process_count: model.processes.processes.len(),
            selected_process_count: model.processes.selected_pids.len(),
            stealth_mode_active: model.processes.stealth_mode_active,
            last_stealth_result: model.processes.last_stealth_result.as_ref().map(|r| {
                StealthResultViewModel {
                    terminated_count: r.terminated_count,
                    memory_freed_mb: r.memory_freed_bytes / 1_000_000,
                }
            }),

            // Games
            game_count: model.games.games.len(),
            games_scanning: model.games.is_scanning,

            // Scoring - scale 0-1000 to 0-100 for UI
            opta_score: (model.scoring.opta_score.total / 10).min(100) as u8,
            score_grade,
            score_calculating: model.scoring.is_calculating,
            score_animation: model.scoring.animation_progress,

            // Ring
            ring: RingViewModel::from(&model.ui.ring),

            // UI
            toasts: model.ui.toasts.iter().map(ToastViewModel::from).collect(),
            modal: model.ui.modal.as_ref().map(ModalViewModel::from),
            onboarding_complete: model.ui.onboarding_complete,

            // Settings
            theme: ThemeViewModel::from(model.settings.theme),
            haptics_enabled: model.settings.haptics_enabled,
            spatial_audio_enabled: model.settings.spatial_audio_enabled,
            telemetry_enabled: model.settings.telemetry_enabled,
            auto_optimize: model.settings.auto_optimize,

            // Error
            error: model.error.as_ref().map(ErrorViewModel::from),

            // Loading
            loading: model.loading.global,
            loading_telemetry: model.loading.telemetry,
            loading_processes: model.loading.processes,
            loading_games: model.loading.games,
            loading_scoring: model.loading.scoring,
        }
    }
}
