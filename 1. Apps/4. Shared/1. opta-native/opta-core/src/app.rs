//! Opta Application Implementation
//!
//! The OptaApp struct provides the pure update function that transforms
//! (Model, Event) -> Vec<Effect> following Elm Architecture principles.
//!
//! Note: We use a custom update signature rather than crux_core::App trait
//! because our architecture returns effects directly rather than using
//! Crux's capability-based side effect system.

use crate::event::Event;
use crate::effect::{Effect, HapticPattern};
use crate::model::{
    Model, Page, RingPhase, Toast, ToastKind,
    ErrorState, StealthModeResultState,
};
use crate::view_model::ViewModel;

/// Capabilities struct for the Opta application.
/// Currently empty as we use Effect enum directly for side effects.
#[derive(Default)]
pub struct Capabilities;

/// The main Opta application following Elm Architecture.
///
/// This struct is stateless - all state lives in the Model.
/// The update function is pure: given an event and model, it
/// returns a new model state and a list of effects to execute.
#[derive(Default)]
pub struct OptaApp;

impl OptaApp {
    /// Create a new OptaApp instance
    pub fn new() -> Self {
        Self
    }

    /// Get the initial model
    pub fn initial_model() -> Model {
        Model::default()
    }

    /// Pure update function: (Event, &mut Model, &Capabilities) -> Vec<Effect>
    ///
    /// This is the heart of the Elm Architecture. Given the current model
    /// and an event, it mutates the model and returns a list of effects
    /// for the shell to execute.
    pub fn update(&self, event: Event, model: &mut Model, _caps: &Capabilities) -> Vec<Effect> {
        match event {
            // ============================================
            // LIFECYCLE
            // ============================================
            Event::AppStarted => {
                model.loading.global = true;

                vec![
                    Effect::LoadSettings {
                        id: Effect::generate_id(),
                    },
                    Effect::collect_telemetry(),
                    Effect::detect_games(),
                    Effect::GetHardwareTier {
                        id: Effect::generate_id(),
                    },
                    Effect::interval(
                        model.settings.telemetry_interval_ms,
                        Event::TelemetryTick,
                    ),
                ]
            }

            Event::AppBackgrounded => {
                // Reduce telemetry frequency when backgrounded
                model.telemetry.is_collecting = false;
                vec![]
            }

            Event::AppForegrounded => {
                // Resume normal telemetry
                model.telemetry.is_collecting = true;
                vec![Effect::collect_telemetry()]
            }

            Event::AppQuitting => {
                // Save any pending state
                vec![Effect::SaveSettings {
                    id: Effect::generate_id(),
                    settings: model.settings.clone(),
                }]
            }

            // ============================================
            // NAVIGATION
            // ============================================
            Event::NavigateTo(page) => {
                // Push current page to history
                model.navigation.history.push(model.navigation.current_page);
                model.navigation.current_page = page;

                // Play transition sound
                vec![Effect::PlaySpatialAudio {
                    id: Effect::generate_id(),
                    sound: crate::effect::SoundEffect::Transition,
                    position: None,
                }]
            }

            Event::NavigateBack => {
                if let Some(previous) = model.navigation.history.pop() {
                    model.navigation.current_page = previous;
                    model.navigation.selected_game_id = None;
                }
                vec![]
            }

            Event::SelectGame(game_id) => {
                model.navigation.selected_game_id = Some(game_id.clone());
                model.navigation.history.push(model.navigation.current_page);
                model.navigation.current_page = Page::GameDetail;

                // Fetch optimization for this game
                vec![Effect::GetOptimization {
                    id: Effect::generate_id(),
                    game_id,
                }]
            }

            Event::ToggleSidebar => {
                model.navigation.sidebar_expanded = !model.navigation.sidebar_expanded;
                vec![]
            }

            // ============================================
            // TELEMETRY
            // ============================================
            Event::StartTelemetry => {
                model.telemetry.is_collecting = true;
                vec![Effect::collect_telemetry()]
            }

            Event::StopTelemetry => {
                model.telemetry.is_collecting = false;
                vec![]
            }

            Event::TelemetryTick => {
                if model.telemetry.is_collecting && model.settings.telemetry_enabled {
                    vec![Effect::collect_telemetry()]
                } else {
                    vec![]
                }
            }

            Event::TelemetryReceived(telemetry) => {
                // Update current telemetry
                model.telemetry.current = telemetry.clone();
                model.telemetry.last_update = telemetry.timestamp_ms;

                // Update history (keep last 60 samples)
                model.telemetry.cpu_history.push(telemetry.cpu.usage_percent);
                if model.telemetry.cpu_history.len() > 60 {
                    model.telemetry.cpu_history.remove(0);
                }

                let memory_percent = (telemetry.memory.used_bytes as f64
                    / telemetry.memory.total_bytes as f64
                    * 100.0) as f32;
                model.telemetry.memory_history.push(memory_percent);
                if model.telemetry.memory_history.len() > 60 {
                    model.telemetry.memory_history.remove(0);
                }

                if let Some(gpu) = &telemetry.gpu {
                    model.telemetry.gpu_history.push(gpu.utilization_percent);
                    if model.telemetry.gpu_history.len() > 60 {
                        model.telemetry.gpu_history.remove(0);
                    }
                }

                model.telemetry.thermal_state = telemetry.thermal.state;
                model.telemetry.memory_pressure = telemetry.memory.pressure;
                model.loading.telemetry = false;
                vec![]
            }

            Event::TelemetryError(error) => {
                model.loading.telemetry = false;
                tracing::error!("Telemetry error: {}", error);
                vec![]
            }

            // ============================================
            // PROCESSES
            // ============================================
            Event::RefreshProcesses => {
                model.loading.processes = true;
                vec![Effect::get_processes(None)]
            }

            Event::ProcessesReceived(processes) => {
                model.processes.processes = processes;
                model.loading.processes = false;
                vec![]
            }

            Event::ProcessesError(error) => {
                model.loading.processes = false;
                model.error = Some(ErrorState {
                    title: "Process Error".to_string(),
                    message: error,
                    recoverable: true,
                    action: Some("Retry".to_string()),
                });
                vec![]
            }

            Event::ToggleProcessSelection(pid) => {
                if model.processes.selected_pids.contains(&pid) {
                    model.processes.selected_pids.retain(|&p| p != pid);
                } else {
                    model.processes.selected_pids.push(pid);
                }
                vec![]
            }

            Event::ClearProcessSelection => {
                model.processes.selected_pids.clear();
                vec![]
            }

            Event::TerminateSelected => {
                let mut effects: Vec<Effect> = model.processes.selected_pids
                    .iter()
                    .map(|pid| Effect::terminate_process(*pid))
                    .collect();

                effects.push(Effect::PlayHaptic {
                    id: Effect::generate_id(),
                    pattern: HapticPattern::Medium,
                });

                effects
            }

            Event::TerminateResult(result) => {
                if result.success {
                    // Remove from process list
                    model.processes.processes.retain(|p| p.pid != result.pid);
                    model.processes.selected_pids.retain(|&p| p != result.pid);
                }
                vec![]
            }

            Event::ExecuteStealthMode => {
                model.processes.stealth_mode_active = true;
                model.ui.ring.phase = RingPhase::Optimizing;

                vec![
                    Effect::stealth_mode(),
                    Effect::PlayHaptic {
                        id: Effect::generate_id(),
                        pattern: HapticPattern::OptimizingPulse,
                    },
                ]
            }

            Event::StealthModeCompleted(result) => {
                model.processes.stealth_mode_active = false;
                model.processes.last_stealth_result = Some(StealthModeResultState {
                    terminated_count: result.terminated.len() as u32,
                    memory_freed_bytes: result.total_memory_freed_bytes,
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                });

                // Show success toast
                let freed_mb = result.total_memory_freed_bytes / 1_000_000;
                model.ui.toasts.push(Toast {
                    id: uuid::Uuid::new_v4().to_string(),
                    message: format!(
                        "Terminated {} processes, freed {}MB",
                        result.terminated.len(),
                        freed_mb
                    ),
                    kind: ToastKind::Success,
                    duration_ms: Some(3000),
                });

                // Update ring to celebrating
                model.ui.ring.phase = RingPhase::Celebrating;

                vec![
                    Effect::PlayHaptic {
                        id: Effect::generate_id(),
                        pattern: HapticPattern::Success,
                    },
                    Effect::get_processes(None),
                ]
            }

            Event::UpdateProcessFilter {
                search,
                min_cpu,
                only_killable,
                sort_by,
                sort_ascending,
            } => {
                if let Some(s) = search {
                    model.processes.filter.search = s;
                }
                if let Some(cpu) = min_cpu {
                    model.processes.filter.min_cpu = cpu;
                }
                if let Some(k) = only_killable {
                    model.processes.filter.only_killable = k;
                }
                if let Some(sort) = sort_by {
                    model.processes.filter.sort_by = sort;
                }
                if let Some(asc) = sort_ascending {
                    model.processes.filter.sort_ascending = asc;
                }
                vec![]
            }

            // ============================================
            // GAMES
            // ============================================
            Event::ScanGames => {
                model.loading.games = true;
                model.games.is_scanning = true;
                vec![Effect::detect_games()]
            }

            Event::GamesReceived(games) => {
                model.games.games = games;
                model.games.is_scanning = false;
                model.games.last_scan = chrono::Utc::now().timestamp_millis() as u64;
                model.loading.games = false;
                vec![]
            }

            Event::GamesError(error) => {
                model.games.is_scanning = false;
                model.loading.games = false;
                tracing::error!("Game detection error: {}", error);
                vec![]
            }

            Event::UpdateGameSearch(search) => {
                model.games.search = search;
                vec![]
            }

            Event::FilterByLauncher(launcher) => {
                model.games.launcher_filter = launcher;
                vec![]
            }

            Event::GetGameOptimization(game_id) => {
                vec![Effect::GetOptimization {
                    id: Effect::generate_id(),
                    game_id,
                }]
            }

            Event::GameOptimizationReceived { game_id: _, optimization: _ } => {
                // Store optimization in model (implementation depends on UI needs)
                vec![]
            }

            Event::ApplyOptimization { game_id, optimization } => {
                model.ui.ring.phase = RingPhase::Optimizing;
                vec![Effect::ApplyOptimization {
                    id: Effect::generate_id(),
                    game_id,
                    optimization,
                }]
            }

            Event::OptimizationApplied { game_id, success, message } => {
                model.ui.ring.phase = if success {
                    RingPhase::Celebrating
                } else {
                    RingPhase::Idle
                };

                model.ui.toasts.push(Toast {
                    id: uuid::Uuid::new_v4().to_string(),
                    message,
                    kind: if success { ToastKind::Success } else { ToastKind::Error },
                    duration_ms: Some(3000),
                });

                if success {
                    // Recalculate score after optimization
                    vec![Effect::CalculateGameScore {
                        id: Effect::generate_id(),
                        game_id,
                    }]
                } else {
                    vec![]
                }
            }

            Event::LaunchGame(game_id) => {
                vec![Effect::LaunchGame {
                    id: Effect::generate_id(),
                    game_id,
                }]
            }

            Event::GameLaunched(game_id) => {
                model.ui.toasts.push(Toast {
                    id: uuid::Uuid::new_v4().to_string(),
                    message: format!("Launched game: {}", game_id),
                    kind: ToastKind::Info,
                    duration_ms: Some(2000),
                });
                vec![]
            }

            // ============================================
            // SCORING
            // ============================================
            Event::CalculateScore => {
                model.loading.scoring = true;
                model.scoring.is_calculating = true;
                vec![Effect::CalculateOptaScore {
                    id: Effect::generate_id(),
                }]
            }

            Event::ScoreCalculated(score) => {
                model.scoring.opta_score = score;
                model.scoring.is_calculating = false;
                model.loading.scoring = false;
                vec![]
            }

            Event::CalculateGameScore(game_id) => {
                vec![Effect::CalculateGameScore {
                    id: Effect::generate_id(),
                    game_id,
                }]
            }

            Event::GameScoreCalculated(score) => {
                // Update or add game score
                if let Some(existing) = model
                    .scoring
                    .game_scores
                    .iter_mut()
                    .find(|s| s.game_id == score.game_id)
                {
                    *existing = score;
                } else {
                    model.scoring.game_scores.push(score);
                }
                vec![]
            }

            Event::ScoreError(error) => {
                model.scoring.is_calculating = false;
                model.loading.scoring = false;
                tracing::error!("Score calculation error: {}", error);
                vec![]
            }

            Event::UpdateScoreAnimation(progress) => {
                model.scoring.animation_progress = progress;
                vec![]
            }

            // ============================================
            // SETTINGS
            // ============================================
            Event::ToggleTelemetryEnabled => {
                model.settings.telemetry_enabled = !model.settings.telemetry_enabled;
                vec![Effect::SaveSettings {
                    id: Effect::generate_id(),
                    settings: model.settings.clone(),
                }]
            }

            Event::SetTelemetryInterval(interval) => {
                model.settings.telemetry_interval_ms = interval;
                vec![]
            }

            Event::ToggleAutoOptimize => {
                model.settings.auto_optimize = !model.settings.auto_optimize;
                vec![]
            }

            Event::ToggleLaunchAtLogin => {
                model.settings.launch_at_login = !model.settings.launch_at_login;
                vec![Effect::SetLaunchAtLogin {
                    id: Effect::generate_id(),
                    enabled: model.settings.launch_at_login,
                }]
            }

            Event::ToggleMenuBar => {
                model.settings.show_menu_bar = !model.settings.show_menu_bar;
                vec![]
            }

            Event::SetTheme(theme) => {
                model.settings.theme = theme;
                vec![]
            }

            Event::ToggleHaptics => {
                model.settings.haptics_enabled = !model.settings.haptics_enabled;
                vec![]
            }

            Event::ToggleSpatialAudio => {
                model.settings.spatial_audio_enabled = !model.settings.spatial_audio_enabled;
                vec![]
            }

            Event::SetHardwareTier(tier) => {
                model.settings.hardware_tier_override = tier;
                vec![]
            }

            Event::SettingsSaved => {
                // Settings saved successfully
                vec![]
            }

            Event::LoadSettings => {
                vec![Effect::LoadSettings {
                    id: Effect::generate_id(),
                }]
            }

            Event::SettingsLoaded(settings) => {
                model.settings = settings;
                model.loading.global = false;
                vec![]
            }

            // ============================================
            // UI
            // ============================================
            Event::UpdateRingPhase(phase) => {
                model.ui.ring.phase = phase;
                vec![]
            }

            Event::UpdateRingProgress(progress) => {
                model.ui.ring.progress = progress;
                vec![]
            }

            Event::SetRingEnergy(energy) => {
                model.ui.ring.energy = energy.clamp(0.0, 1.0);
                vec![]
            }

            Event::ToggleRingExpanded => {
                model.ui.ring.expanded = !model.ui.ring.expanded;
                vec![]
            }

            Event::ShowToast(toast) => {
                model.ui.toasts.push(toast);
                vec![]
            }

            Event::DismissToast(id) => {
                model.ui.toasts.retain(|t| t.id != id);
                vec![]
            }

            Event::ShowModal(modal) => {
                model.ui.modal = Some(modal);
                vec![]
            }

            Event::DismissModal => {
                model.ui.modal = None;
                vec![]
            }

            Event::ModalConfirmed => {
                // Handle modal confirmation based on modal type
                model.ui.modal = None;
                vec![]
            }

            Event::CompleteOnboarding => {
                model.ui.onboarding_complete = true;
                vec![]
            }

            // ============================================
            // ERRORS
            // ============================================
            Event::ShowError {
                title,
                message,
                recoverable,
            } => {
                model.error = Some(ErrorState {
                    title,
                    message,
                    recoverable,
                    action: if recoverable {
                        Some("Retry".to_string())
                    } else {
                        None
                    },
                });
                vec![]
            }

            Event::DismissError => {
                model.error = None;
                vec![]
            }

            Event::PlatformError(error) => {
                model.error = Some(ErrorState {
                    title: "Platform Error".to_string(),
                    message: error.to_string(),
                    recoverable: error.is_recoverable(),
                    action: if error.is_recoverable() {
                        Some("Retry".to_string())
                    } else {
                        None
                    },
                });
                vec![]
            }

            // ============================================
            // EFFECT RESPONSES
            // ============================================
            Event::EffectCompleted { effect_id: _, result: _ } => {
                // Generic effect completion handling
                vec![]
            }

            Event::EffectFailed { effect_id: _, error } => {
                tracing::error!("Effect failed: {}", error);
                vec![]
            }
        }
    }

    /// Create a view model from the current model state.
    /// The ViewModel is a serializable representation of the UI state.
    pub fn view(&self, model: &Model) -> ViewModel {
        ViewModel::from(model)
    }
}
