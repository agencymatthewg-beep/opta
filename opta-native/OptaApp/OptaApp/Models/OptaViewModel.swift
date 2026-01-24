//
//  OptaViewModel.swift
//  OptaApp
//
//  Swift representations of Crux ViewModel and Event types.
//  These mirror the Rust types for type-safe JSON decoding.
//

import Foundation

// MARK: - ViewModel

/// Swift representation of the Crux ViewModel.
///
/// This struct mirrors the Rust `ViewModel` for type-safe JSON decoding.
/// The ViewModel is the serializable representation of the UI state
/// that gets sent from the Crux core to the SwiftUI shell.
struct OptaViewModel: Codable {

    // MARK: - Navigation

    /// Current page/view being displayed
    var currentPage: PageViewModel = .dashboard

    /// Whether back navigation is available
    var canGoBack: Bool = false

    /// Selected game ID (if on game detail view)
    var selectedGameId: String? = nil

    /// Whether sidebar is expanded
    var sidebarExpanded: Bool = true

    // MARK: - Telemetry Summary

    /// Current CPU usage percentage
    var cpuUsage: Float = 0

    /// Current memory usage percentage
    var memoryUsage: Float = 0

    /// Current GPU usage percentage (if available)
    var gpuUsage: Float? = nil

    /// Current thermal state
    var thermalState: ThermalStateViewModel = .nominal

    /// Current memory pressure
    var memoryPressure: MemoryPressureViewModel = .normal

    /// CPU usage history (last 60 samples)
    var cpuHistory: [Float] = []

    /// Memory usage history (last 60 samples)
    var memoryHistory: [Float] = []

    /// GPU usage history (last 60 samples)
    var gpuHistory: [Float] = []

    /// Whether telemetry is being collected
    var telemetryActive: Bool = false

    // MARK: - Processes

    /// Number of running processes
    var processCount: Int = 0

    /// Number of selected processes
    var selectedProcessCount: Int = 0

    /// List of running processes (populated when on Processes page)
    var processes: [ProcessViewModel] = []

    /// Current process filter state
    var processFilter: ProcessFilterViewModel = ProcessFilterViewModel()

    /// PIDs of selected processes
    var selectedPids: [UInt32] = []

    /// Whether stealth mode is active
    var stealthModeActive: Bool = false

    /// Last stealth mode result summary
    var lastStealthResult: StealthResultViewModel? = nil

    // MARK: - Games

    /// Number of detected games
    var gameCount: Int = 0

    /// Whether game scanning is in progress
    var gamesScanning: Bool = false

    // MARK: - Scoring

    /// Current Opta Score (0-100)
    var optaScore: UInt8 = 0

    /// Score grade (S, A, B, C, D, F)
    var scoreGrade: String = "F"

    /// Whether score is being calculated
    var scoreCalculating: Bool = false

    /// Score animation progress (0.0 - 1.0)
    var scoreAnimation: Float = 0

    // MARK: - Ring State

    /// Ring animation state
    var ring: RingViewModel = RingViewModel()

    // MARK: - UI State

    /// Active toasts to display
    var toasts: [ToastViewModel] = []

    /// Current modal (if any)
    var modal: ModalViewModel? = nil

    /// Whether onboarding is complete
    var onboardingComplete: Bool = false

    // MARK: - Settings

    /// Current theme
    var theme: ThemeViewModel = .system

    /// Whether haptics are enabled
    var hapticsEnabled: Bool = true

    /// Whether spatial audio is enabled
    var spatialAudioEnabled: Bool = true

    /// Whether telemetry collection is enabled
    var telemetryEnabled: Bool = true

    /// Whether auto-optimize is enabled
    var autoOptimize: Bool = false

    // MARK: - Error State

    /// Current error (if any)
    var error: ErrorViewModel? = nil

    // MARK: - Loading State

    /// Global loading state
    var loading: Bool = false

    /// Component-specific loading states
    var loadingTelemetry: Bool = false
    var loadingProcesses: Bool = false
    var loadingGames: Bool = false
    var loadingScoring: Bool = false

    // MARK: - JSON Decoding

    /// Decode from JSON string
    static func from(json: String) -> OptaViewModel? {
        guard let data = json.data(using: .utf8) else {
            print("[OptaViewModel] Failed to convert JSON string to data")
            return nil
        }

        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(OptaViewModel.self, from: data)
        } catch {
            print("[OptaViewModel] Failed to decode JSON: \(error)")
            return nil
        }
    }

    /// Encode to JSON string
    func toJson() -> String? {
        do {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            let data = try encoder.encode(self)
            return String(data: data, encoding: .utf8)
        } catch {
            print("[OptaViewModel] Failed to encode to JSON: \(error)")
            return nil
        }
    }
}

// MARK: - Page View Model

/// Page/view identifier for the UI
enum PageViewModel: String, Codable {
    case dashboard = "Dashboard"
    case optimize = "Optimize"
    case games = "Games"
    case gameDetail = "GameDetail"
    case processes = "Processes"
    case settings = "Settings"
    case chess = "Chess"
    case aiChat = "AiChat"
    case score = "Score"
}

// MARK: - Thermal State

/// Thermal state for UI display
enum ThermalStateViewModel: String, Codable {
    case nominal = "Nominal"
    case fair = "Fair"
    case serious = "Serious"
    case critical = "Critical"
}

// MARK: - Memory Pressure

/// Memory pressure for UI display
enum MemoryPressureViewModel: String, Codable {
    case normal = "Normal"
    case warning = "Warning"
    case critical = "Critical"
}

// MARK: - Ring View Model

/// Ring animation state for UI
struct RingViewModel: Codable {
    /// Current animation phase
    var phase: RingPhaseViewModel = .idle

    /// Animation progress (0.0 - 1.0)
    var progress: Float = 0

    /// Ring energy level
    var energy: Float = 0

    /// Whether ring is expanded
    var expanded: Bool = false
}

/// Ring animation phase for UI
enum RingPhaseViewModel: String, Codable {
    case idle = "Idle"
    case wakingUp = "WakingUp"
    case active = "Active"
    case optimizing = "Optimizing"
    case celebrating = "Celebrating"
    case sleeping = "Sleeping"
}

// MARK: - Toast View Model

/// Toast notification for UI
struct ToastViewModel: Codable, Identifiable {
    var id: String
    var message: String
    var kind: ToastKindViewModel
    var durationMs: UInt64?
}

/// Toast kind for UI
enum ToastKindViewModel: String, Codable {
    case info = "Info"
    case success = "Success"
    case warning = "Warning"
    case error = "Error"
}

// MARK: - Modal View Model

/// Modal state for UI
struct ModalViewModel: Codable {
    var kind: ModalKindViewModel
    var title: String
    var message: String?
}

/// Modal kind for UI
enum ModalKindViewModel: String, Codable {
    case confirm = "Confirm"
    case alert = "Alert"
    case input = "Input"
    case gameOptimize = "GameOptimize"
    case stealthModeConfirm = "StealthModeConfirm"
}

// MARK: - Theme View Model

/// Theme for UI
enum ThemeViewModel: String, Codable {
    case light = "Light"
    case dark = "Dark"
    case system = "System"
}

// MARK: - Error View Model

/// Error state for UI
struct ErrorViewModel: Codable {
    var title: String
    var message: String
    var recoverable: Bool
    var action: String?
}

// MARK: - Stealth Result View Model

/// Stealth mode result summary for UI
struct StealthResultViewModel: Codable {
    var terminatedCount: UInt32
    var memoryFreedMb: UInt64
}

// MARK: - Process View Model

/// Individual process for display in ProcessesView
struct ProcessViewModel: Identifiable, Equatable {
    var id: UInt32 { pid }
    var pid: UInt32
    var name: String
    var cpuPercent: Float
    var memoryBytes: UInt64
    var user: String
    var isKillable: Bool

    /// Memory in MB for display
    var memoryMb: Float {
        Float(memoryBytes) / 1_000_000.0
    }

    enum CodingKeys: String, CodingKey {
        case pid, name, cpuPercent, memoryBytes, user, isKillable
    }
}

extension ProcessViewModel: Codable {}

// MARK: - Process Filter View Model

/// Process filter state for UI
struct ProcessFilterViewModel: Codable, Equatable {
    var search: String = ""
    var minCpu: Float = 0
    var onlyKillable: Bool = false
    var sortBy: ProcessSortViewModel = .cpu
    var sortAscending: Bool = false
}

// MARK: - Process Sort View Model

/// Process sort options
enum ProcessSortViewModel: String, Codable, CaseIterable {
    case cpu = "Cpu"
    case memory = "Memory"
    case name = "Name"
    case pid = "Pid"

    var displayName: String {
        switch self {
        case .cpu: return "CPU"
        case .memory: return "Memory"
        case .name: return "Name"
        case .pid: return "PID"
        }
    }

    var icon: String {
        switch self {
        case .cpu: return "cpu"
        case .memory: return "memorychip"
        case .name: return "textformat"
        case .pid: return "number"
        }
    }
}

// MARK: - OptaEvent

/// Events that can be dispatched to Crux.
///
/// These mirror the Rust Event enum variants with Swift-friendly naming.
/// Events are the only way to trigger state changes in the Crux core.
enum OptaEvent {
    // MARK: - Lifecycle Events

    case appStarted
    case appBackgrounded
    case appForegrounded
    case appQuitting

    // MARK: - Navigation Events

    case navigateTo(page: PageViewModel)
    case navigateBack
    case selectGame(gameId: String)
    case toggleSidebar

    // MARK: - Telemetry Events

    case startTelemetry
    case stopTelemetry
    case telemetryTick

    // MARK: - Process Events

    case refreshProcesses
    case toggleProcessSelection(pid: UInt32)
    case clearProcessSelection
    case terminateSelected
    case executeStealthMode
    case updateProcessFilter(
        search: String?,
        minCpu: Float?,
        onlyKillable: Bool?,
        sortBy: ProcessSortViewModel?,
        sortAscending: Bool?
    )

    // MARK: - Game Events

    case scanGames
    case launchGame(gameId: String)

    // MARK: - Scoring Events

    case calculateScore
    case calculateGameScore(gameId: String)

    // MARK: - Settings Events

    case toggleTelemetryEnabled
    case toggleAutoOptimize
    case toggleLaunchAtLogin
    case toggleMenuBar
    case setTheme(theme: ThemeViewModel)
    case toggleHaptics
    case toggleSpatialAudio

    // MARK: - UI Events

    case updateRingPhase(phase: RingPhaseViewModel)
    case updateRingProgress(progress: Float)
    case setRingEnergy(energy: Float)
    case toggleRingExpanded
    case dismissToast(id: String)
    case dismissModal
    case modalConfirmed
    case completeOnboarding

    // MARK: - Error Events

    case showError(title: String, message: String, recoverable: Bool)
    case dismissError

    // MARK: - JSON Encoding

    /// Convert event to JSON string for FFI
    func toJson() -> String {
        switch self {
        // Lifecycle
        case .appStarted:
            return "\"AppStarted\""
        case .appBackgrounded:
            return "\"AppBackgrounded\""
        case .appForegrounded:
            return "\"AppForegrounded\""
        case .appQuitting:
            return "\"AppQuitting\""

        // Navigation
        case .navigateTo(let page):
            return "{\"NavigateTo\":\"\(page.rawValue)\"}"
        case .navigateBack:
            return "\"NavigateBack\""
        case .selectGame(let gameId):
            return "{\"SelectGame\":\"\(gameId)\"}"
        case .toggleSidebar:
            return "\"ToggleSidebar\""

        // Telemetry
        case .startTelemetry:
            return "\"StartTelemetry\""
        case .stopTelemetry:
            return "\"StopTelemetry\""
        case .telemetryTick:
            return "\"TelemetryTick\""

        // Processes
        case .refreshProcesses:
            return "\"RefreshProcesses\""
        case .toggleProcessSelection(let pid):
            return "{\"ToggleProcessSelection\":\(pid)}"
        case .clearProcessSelection:
            return "\"ClearProcessSelection\""
        case .terminateSelected:
            return "\"TerminateSelected\""
        case .executeStealthMode:
            return "\"ExecuteStealthMode\""
        case .updateProcessFilter(let search, let minCpu, let onlyKillable, let sortBy, let sortAscending):
            var fields: [String] = []
            if let s = search { fields.append("\"search\":\"\(s)\"") }
            if let cpu = minCpu { fields.append("\"min_cpu\":\(cpu)") }
            if let k = onlyKillable { fields.append("\"only_killable\":\(k)") }
            if let sort = sortBy { fields.append("\"sort_by\":\"\(sort.rawValue)\"") }
            if let asc = sortAscending { fields.append("\"sort_ascending\":\(asc)") }
            return "{\"UpdateProcessFilter\":{\(fields.joined(separator: ","))}}"

        // Games
        case .scanGames:
            return "\"ScanGames\""
        case .launchGame(let gameId):
            return "{\"LaunchGame\":\"\(gameId)\"}"

        // Scoring
        case .calculateScore:
            return "\"CalculateScore\""
        case .calculateGameScore(let gameId):
            return "{\"CalculateGameScore\":\"\(gameId)\"}"

        // Settings
        case .toggleTelemetryEnabled:
            return "\"ToggleTelemetryEnabled\""
        case .toggleAutoOptimize:
            return "\"ToggleAutoOptimize\""
        case .toggleLaunchAtLogin:
            return "\"ToggleLaunchAtLogin\""
        case .toggleMenuBar:
            return "\"ToggleMenuBar\""
        case .setTheme(let theme):
            return "{\"SetTheme\":\"\(theme.rawValue)\"}"
        case .toggleHaptics:
            return "\"ToggleHaptics\""
        case .toggleSpatialAudio:
            return "\"ToggleSpatialAudio\""

        // UI
        case .updateRingPhase(let phase):
            return "{\"UpdateRingPhase\":\"\(phase.rawValue)\"}"
        case .updateRingProgress(let progress):
            return "{\"UpdateRingProgress\":\(progress)}"
        case .setRingEnergy(let energy):
            return "{\"SetRingEnergy\":\(energy)}"
        case .toggleRingExpanded:
            return "\"ToggleRingExpanded\""
        case .dismissToast(let id):
            return "{\"DismissToast\":\"\(id)\"}"
        case .dismissModal:
            return "\"DismissModal\""
        case .modalConfirmed:
            return "\"ModalConfirmed\""
        case .completeOnboarding:
            return "\"CompleteOnboarding\""

        // Errors
        case .showError(let title, let message, let recoverable):
            return "{\"ShowError\":{\"title\":\"\(title)\",\"message\":\"\(message)\",\"recoverable\":\(recoverable)}}"
        case .dismissError:
            return "\"DismissError\""
        }
    }
}

// MARK: - Optimize Computed Properties

extension OptaViewModel {

    /// Summary of current system health for the optimize page
    var systemHealthStatus: String {
        if thermalState == .critical || memoryPressure == .critical {
            return "Needs Optimization"
        } else if thermalState == .serious || memoryPressure == .warning {
            return "Could Improve"
        } else {
            return "Running Well"
        }
    }

    /// Whether optimization is recommended based on current system state
    var optimizationRecommended: Bool {
        cpuUsage > 70 || memoryUsage > 80 || thermalState != .nominal
    }
}

// MARK: - Model Slices

/// Model slices for efficient partial updates.
///
/// Instead of fetching the entire model, you can request
/// just the slice you need for better performance.
enum ModelSlice: String {
    case navigation
    case telemetry
    case processes
    case games
    case scoring
    case settings
    case ui
    case loading
    case error
}
