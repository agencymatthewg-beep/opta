//
//  GamesLibraryView.swift
//  OptaApp
//
//  Main games library view with search, filtering, and grid layout.
//  Displays detected games from Steam, Epic, GOG, and native macOS.
//

import SwiftUI

// MARK: - GamesLibraryView

/// The main games library view showing all detected games.
///
/// Features:
/// - Header with title and scan button
/// - Search bar for filtering games
/// - Platform filter pills (All, Steam, Epic, GOG, Native)
/// - Sort options (Name, Last Played, Playtime)
/// - Responsive grid layout (LazyVGrid)
/// - Empty state when no games found
/// - Loading state during scan
struct GamesLibraryView: View {

    // MARK: - Environment

    @Environment(\.optaCoreManager) private var coreManager: OptaCoreManager?

    // MARK: - State

    /// Detected games
    @State private var games: [Game] = []

    /// Whether a scan is in progress
    @State private var isScanning = false

    /// Search filter text
    @State private var searchText = ""

    /// Selected platform filter (nil = all)
    @State private var selectedPlatform: GamePlatform?

    /// Current sort option
    @State private var sortOption: GameSortOption = .name

    /// Sort direction (true = ascending)
    @State private var sortAscending = true

    /// Selected game for navigation
    @State private var selectedGameId: UUID?

    // MARK: - Computed Properties

    /// Filtered and sorted games based on current filters
    private var filteredGames: [Game] {
        var result = games

        // Apply search filter
        if !searchText.isEmpty {
            result = result.filter { game in
                game.name.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Apply platform filter
        if let platform = selectedPlatform {
            result = result.filter { $0.platform == platform }
        }

        // Apply sort
        result.sort { lhs, rhs in
            let comparison: ComparisonResult
            switch sortOption {
            case .name:
                comparison = lhs.name.localizedCaseInsensitiveCompare(rhs.name)
            case .lastPlayed:
                let lhsDate = lhs.lastPlayed ?? Date.distantPast
                let rhsDate = rhs.lastPlayed ?? Date.distantPast
                comparison = lhsDate.compare(rhsDate)
            case .playtime:
                if lhs.totalPlaytime < rhs.totalPlaytime {
                    comparison = .orderedAscending
                } else if lhs.totalPlaytime > rhs.totalPlaytime {
                    comparison = .orderedDescending
                } else {
                    comparison = .orderedSame
                }
            case .platform:
                comparison = lhs.platform.displayName.compare(rhs.platform.displayName)
            }

            return sortAscending
                ? comparison == .orderedAscending
                : comparison == .orderedDescending
        }

        return result
    }

    /// Grid columns (adaptive, minimum 280 width)
    private let columns = [
        GridItem(.adaptive(minimum: 280, maximum: 400), spacing: 12)
    ]

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            // Filters
            filtersView

            // Content
            if isScanning {
                loadingView
            } else if games.isEmpty {
                emptyStateView
            } else if filteredGames.isEmpty {
                noResultsView
            } else {
                gamesGrid
            }
        }
        .background(Color(hex: "09090B"))
        .task {
            await scanForGames()
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            // Back button
            Button {
                coreManager?.navigate(to: .dashboard)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Dashboard")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(.white.opacity(0.6))
            }
            .buttonStyle(.plain)

            Spacer()

            // Title
            Text("Games Library")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)

            Spacer()

            // Scan button
            Button {
                Task {
                    await scanForGames(forceRefresh: true)
                }
            } label: {
                HStack(spacing: 6) {
                    if isScanning {
                        ProgressView()
                            .scaleEffect(0.7)
                            .frame(width: 14, height: 14)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    Text("Scan")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(Color(hex: "8B5CF6"))
                )
            }
            .buttonStyle(.plain)
            .disabled(isScanning)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(
            Color(hex: "09090B")
                .overlay(
                    Rectangle()
                        .fill(Color.white.opacity(0.05))
                        .frame(height: 1),
                    alignment: .bottom
                )
        )
    }

    // MARK: - Filters

    private var filtersView: some View {
        VStack(spacing: 12) {
            // Search bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.5))

                TextField("Search games...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(.white)

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )

            // Platform filters and sort options
            HStack(spacing: 16) {
                // Platform pills
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        platformPill(nil, label: "All")

                        ForEach(GamePlatform.allCases) { platform in
                            platformPill(platform, label: platform.displayName)
                        }
                    }
                }

                Spacer()

                // Sort menu
                Menu {
                    ForEach(GameSortOption.allCases) { option in
                        Button {
                            if sortOption == option {
                                sortAscending.toggle()
                            } else {
                                sortOption = option
                                sortAscending = true
                            }
                        } label: {
                            HStack {
                                Label(option.rawValue, systemImage: option.iconName)
                                if sortOption == option {
                                    Image(systemName: sortAscending ? "chevron.up" : "chevron.down")
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: sortOption.iconName)
                            .font(.system(size: 11))
                        Text(sortOption.rawValue)
                            .font(.system(size: 12, weight: .medium))
                        Image(systemName: sortAscending ? "chevron.up" : "chevron.down")
                            .font(.system(size: 9))
                    }
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(0.08))
                    )
                }
                .menuStyle(.borderlessButton)
            }

            // Results count
            HStack {
                Text("\(filteredGames.count) game\(filteredGames.count == 1 ? "" : "s")")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))

                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    /// Platform filter pill button
    private func platformPill(_ platform: GamePlatform?, label: String) -> some View {
        Button {
            selectedPlatform = platform
        } label: {
            HStack(spacing: 4) {
                if let p = platform {
                    Image(systemName: p.iconName)
                        .font(.system(size: 10))
                }
                Text(label)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(
                selectedPlatform == platform ? .white : .white.opacity(0.6)
            )
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(
                        selectedPlatform == platform
                            ? Color(hex: "8B5CF6")
                            : Color.white.opacity(0.08)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Games Grid

    private var gamesGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(filteredGames) { game in
                    GameCardView(
                        game: game,
                        onSelect: {
                            coreManager?.navigateToGame(id: game.id)
                        },
                        onOptimize: {
                            optimizeGame(game)
                        }
                    )
                }
            }
            .padding(20)
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            Spacer()

            ProgressView()
                .scaleEffect(1.2)

            Text("Scanning for games...")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.6))

            Text("Checking Steam, Epic, GOG, and Applications")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.4))

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "gamecontroller")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.2))

            Text("No Games Found")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)

            Text("Click Scan to detect games from Steam, Epic Games,\nGOG, and your Applications folder.")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.5))
                .multilineTextAlignment(.center)

            Button {
                Task {
                    await scanForGames(forceRefresh: true)
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                    Text("Scan for Games")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(hex: "8B5CF6"))
                )
            }
            .buttonStyle(.plain)
            .padding(.top, 8)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - No Results View

    private var noResultsView: some View {
        VStack(spacing: 12) {
            Spacer()

            Image(systemName: "magnifyingglass")
                .font(.system(size: 32))
                .foregroundStyle(.white.opacity(0.2))

            Text("No games match your search")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.white)

            if !searchText.isEmpty || selectedPlatform != nil {
                Button {
                    searchText = ""
                    selectedPlatform = nil
                } label: {
                    Text("Clear filters")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "8B5CF6"))
                }
                .buttonStyle(.plain)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Actions

    /// Scan for games using GameDetectionService
    private func scanForGames(forceRefresh: Bool = false) async {
        isScanning = true

        let detectedGames = await GameDetectionService.shared.scanForGames(forceRefresh: forceRefresh)
        games = detectedGames

        isScanning = false
    }

    /// Trigger optimization for a game
    private func optimizeGame(_ game: Game) {
        print("[GamesLibraryView] Quick optimize: \(game.name)")

        // TODO: Dispatch optimization event via coreManager
        // For now, just update the profile
        var updatedGame = game
        if updatedGame.optimizationProfile == nil {
            updatedGame.optimizationProfile = GameOptimizationProfile()
        }
        updatedGame.optimizationProfile?.lastOptimizedAt = Date()

        // Update in list
        if let index = games.firstIndex(where: { $0.id == game.id }) {
            games[index] = updatedGame
        }

        // Update in service cache
        Task {
            await GameDetectionService.shared.updateGame(updatedGame)
        }
    }
}

// MARK: - Preview

#Preview {
    GamesLibraryView()
        .frame(width: 900, height: 600)
}
