//
//  GameDetectionService.swift
//  OptaApp
//
//  Service for detecting installed games across Steam, Epic, GOG, and native macOS apps.
//  Uses FileManager to scan known game directories and extract app metadata.
//

import Foundation
import AppKit

// MARK: - GameDetectionService

/// Thread-safe service for detecting and managing installed games.
///
/// Scans standard installation locations for games from:
/// - Steam: ~/Library/Application Support/Steam/steamapps/common/
/// - Epic Games: ~/Library/Application Support/Epic/
/// - Native macOS: /Applications/ (filtered by category)
///
/// Usage:
/// ```swift
/// let games = await GameDetectionService.shared.scanForGames()
/// ```
actor GameDetectionService {

    // MARK: - Singleton

    /// Shared instance for app-wide access
    static let shared = GameDetectionService()

    // MARK: - Properties

    /// Cached list of detected games
    private var cachedGames: [Game] = []

    /// When the cache was last updated
    private var lastScanTime: Date?

    /// Cache validity duration (5 minutes)
    private let cacheValidityDuration: TimeInterval = 300

    /// File manager instance
    private let fileManager = FileManager.default

    // MARK: - Known Directories

    /// Steam games directory
    private var steamDirectory: URL? {
        let homeDir = fileManager.homeDirectoryForCurrentUser
        let steamPath = homeDir
            .appendingPathComponent("Library")
            .appendingPathComponent("Application Support")
            .appendingPathComponent("Steam")
            .appendingPathComponent("steamapps")
            .appendingPathComponent("common")
        return fileManager.fileExists(atPath: steamPath.path) ? steamPath : nil
    }

    /// Epic Games directory
    private var epicDirectory: URL? {
        let homeDir = fileManager.homeDirectoryForCurrentUser
        let epicPath = homeDir
            .appendingPathComponent("Library")
            .appendingPathComponent("Application Support")
            .appendingPathComponent("Epic")
        return fileManager.fileExists(atPath: epicPath.path) ? epicPath : nil
    }

    /// GOG Games directory
    private var gogDirectory: URL? {
        let homeDir = fileManager.homeDirectoryForCurrentUser
        let gogPath = homeDir
            .appendingPathComponent("Library")
            .appendingPathComponent("Application Support")
            .appendingPathComponent("GOG.com")
            .appendingPathComponent("Games")
        return fileManager.fileExists(atPath: gogPath.path) ? gogPath : nil
    }

    /// Applications directory
    private var applicationsDirectory: URL {
        URL(fileURLWithPath: "/Applications")
    }

    // MARK: - Initialization

    private init() {
        print("[GameDetectionService] Initialized")
    }

    // MARK: - Public API

    /// Scan all platforms for installed games.
    ///
    /// Returns cached results if available and recent, otherwise performs a full scan.
    /// - Parameter forceRefresh: If true, ignores cache and performs a full scan
    /// - Returns: Array of detected games sorted by name
    func scanForGames(forceRefresh: Bool = false) async -> [Game] {
        // Return cached games if still valid
        if !forceRefresh,
           let lastScan = lastScanTime,
           Date().timeIntervalSince(lastScan) < cacheValidityDuration,
           !cachedGames.isEmpty {
            print("[GameDetectionService] Returning cached games (\(cachedGames.count))")
            return cachedGames
        }

        print("[GameDetectionService] Starting full game scan...")

        var allGames: [Game] = []

        // Scan all platforms in parallel
        async let steamGames = detectSteamGames()
        async let epicGames = detectEpicGames()
        async let gogGames = detectGOGGames()
        async let nativeGames = detectNativeGames()

        // Combine results
        allGames.append(contentsOf: await steamGames)
        allGames.append(contentsOf: await epicGames)
        allGames.append(contentsOf: await gogGames)
        allGames.append(contentsOf: await nativeGames)

        // Sort by name
        allGames.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

        // Update cache
        cachedGames = allGames
        lastScanTime = Date()

        print("[GameDetectionService] Scan complete: \(allGames.count) games found")
        return allGames
    }

    /// Detect Steam games.
    ///
    /// Scans ~/Library/Application Support/Steam/steamapps/common/
    /// for game directories containing .app bundles or executables.
    /// - Returns: Array of detected Steam games
    func detectSteamGames() async -> [Game] {
        guard let steamDir = steamDirectory else {
            print("[GameDetectionService] Steam directory not found")
            return []
        }

        print("[GameDetectionService] Scanning Steam directory: \(steamDir.path)")
        var games: [Game] = []

        do {
            let contents = try fileManager.contentsOfDirectory(
                at: steamDir,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            )

            for itemURL in contents {
                // Look for .app bundles in the game directory
                if let game = await scanDirectoryForGame(
                    at: itemURL,
                    platform: .steam,
                    fallbackName: itemURL.lastPathComponent
                ) {
                    games.append(game)
                }
            }
        } catch {
            print("[GameDetectionService] Error scanning Steam directory: \(error)")
        }

        print("[GameDetectionService] Found \(games.count) Steam games")
        return games
    }

    /// Detect Epic Games.
    ///
    /// Scans ~/Library/Application Support/Epic/
    /// - Returns: Array of detected Epic games
    func detectEpicGames() async -> [Game] {
        guard let epicDir = epicDirectory else {
            print("[GameDetectionService] Epic Games directory not found")
            return []
        }

        print("[GameDetectionService] Scanning Epic Games directory: \(epicDir.path)")
        var games: [Game] = []

        do {
            let contents = try fileManager.contentsOfDirectory(
                at: epicDir,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            )

            for itemURL in contents {
                if let game = await scanDirectoryForGame(
                    at: itemURL,
                    platform: .epic,
                    fallbackName: itemURL.lastPathComponent
                ) {
                    games.append(game)
                }
            }
        } catch {
            print("[GameDetectionService] Error scanning Epic Games directory: \(error)")
        }

        print("[GameDetectionService] Found \(games.count) Epic games")
        return games
    }

    /// Detect GOG games.
    ///
    /// Scans ~/Library/Application Support/GOG.com/Games/
    /// - Returns: Array of detected GOG games
    func detectGOGGames() async -> [Game] {
        guard let gogDir = gogDirectory else {
            print("[GameDetectionService] GOG directory not found")
            return []
        }

        print("[GameDetectionService] Scanning GOG directory: \(gogDir.path)")
        var games: [Game] = []

        do {
            let contents = try fileManager.contentsOfDirectory(
                at: gogDir,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            )

            for itemURL in contents {
                if let game = await scanDirectoryForGame(
                    at: itemURL,
                    platform: .gog,
                    fallbackName: itemURL.lastPathComponent
                ) {
                    games.append(game)
                }
            }
        } catch {
            print("[GameDetectionService] Error scanning GOG directory: \(error)")
        }

        print("[GameDetectionService] Found \(games.count) GOG games")
        return games
    }

    /// Detect native macOS games from /Applications.
    ///
    /// Filters applications by:
    /// - LSApplicationCategoryType containing "games"
    /// - Bundle identifier containing "game", "unity", "unreal"
    /// - Known game developers/publishers
    ///
    /// - Returns: Array of detected native macOS games
    func detectNativeGames() async -> [Game] {
        print("[GameDetectionService] Scanning /Applications for native games")
        var games: [Game] = []

        do {
            let contents = try fileManager.contentsOfDirectory(
                at: applicationsDirectory,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            )

            for itemURL in contents {
                guard itemURL.pathExtension == "app" else { continue }

                if let game = await scanAppBundle(at: itemURL, platform: .native) {
                    games.append(game)
                }
            }
        } catch {
            print("[GameDetectionService] Error scanning /Applications: \(error)")
        }

        print("[GameDetectionService] Found \(games.count) native games")
        return games
    }

    // MARK: - Private Helpers

    /// Scan a directory for a game app bundle or executable.
    private func scanDirectoryForGame(
        at directoryURL: URL,
        platform: GamePlatform,
        fallbackName: String
    ) async -> Game? {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: directoryURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return nil
        }

        // Look for .app bundles inside
        do {
            let contents = try fileManager.contentsOfDirectory(
                at: directoryURL,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            )

            // Find the first .app bundle
            for itemURL in contents {
                if itemURL.pathExtension == "app" {
                    return await createGameFromAppBundle(at: itemURL, platform: platform)
                }
            }

            // No .app found, check for executable with same name as directory
            let executableURL = directoryURL.appendingPathComponent(fallbackName)
            if fileManager.isExecutableFile(atPath: executableURL.path) {
                return Game(
                    name: fallbackName,
                    executablePath: executableURL.path,
                    platform: platform
                )
            }
        } catch {
            print("[GameDetectionService] Error scanning directory \(directoryURL.lastPathComponent): \(error)")
        }

        return nil
    }

    /// Scan an app bundle and determine if it's a game.
    private func scanAppBundle(at appURL: URL, platform: GamePlatform) async -> Game? {
        // Get Info.plist
        let infoPlistURL = appURL.appendingPathComponent("Contents/Info.plist")

        guard let plistData = try? Data(contentsOf: infoPlistURL),
              let plist = try? PropertyListSerialization.propertyList(
                  from: plistData,
                  format: nil
              ) as? [String: Any] else {
            return nil
        }

        // Check if this is a game
        if !isGameApp(plist: plist, bundleURL: appURL) {
            return nil
        }

        return await createGameFromAppBundle(at: appURL, platform: platform)
    }

    /// Check if an app is a game based on its Info.plist.
    private func isGameApp(plist: [String: Any], bundleURL: URL) -> Bool {
        // Check category
        if let category = plist["LSApplicationCategoryType"] as? String {
            if category.lowercased().contains("game") {
                return true
            }
        }

        // Check bundle identifier for game-related keywords
        if let bundleId = plist["CFBundleIdentifier"] as? String {
            let lowercasedId = bundleId.lowercased()
            let gameKeywords = ["game", "unity", "unreal", "steam", "epic", "gog"]
            if gameKeywords.contains(where: { lowercasedId.contains($0) }) {
                return true
            }
        }

        // Check bundle name
        let bundleName = bundleURL.deletingPathExtension().lastPathComponent.lowercased()
        let knownGames = [
            "minecraft", "fortnite", "league of legends", "dota", "steam",
            "world of warcraft", "hearthstone", "overwatch", "diablo",
            "starcraft", "counter-strike", "valorant", "apex legends"
        ]
        if knownGames.contains(where: { bundleName.contains($0) }) {
            return true
        }

        return false
    }

    /// Create a Game model from an app bundle.
    private func createGameFromAppBundle(at appURL: URL, platform: GamePlatform) async -> Game? {
        let infoPlistURL = appURL.appendingPathComponent("Contents/Info.plist")

        // Read Info.plist
        let plist: [String: Any]?
        if let data = try? Data(contentsOf: infoPlistURL) {
            plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        } else {
            plist = nil
        }

        // Extract name
        let name = plist?["CFBundleName"] as? String
            ?? plist?["CFBundleDisplayName"] as? String
            ?? appURL.deletingPathExtension().lastPathComponent

        // Extract bundle identifier
        let bundleId = plist?["CFBundleIdentifier"] as? String

        // Get icon data
        let iconData = await extractAppIcon(at: appURL)

        return Game(
            name: name,
            bundleIdentifier: bundleId,
            executablePath: appURL.path,
            iconData: iconData,
            platform: platform
        )
    }

    /// Extract the app icon as PNG data.
    private func extractAppIcon(at appURL: URL) async -> Data? {
        // Use NSWorkspace to get the icon
        let icon = await MainActor.run {
            NSWorkspace.shared.icon(forFile: appURL.path)
        }

        // Convert to PNG data
        guard let tiffData = icon.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            return nil
        }

        return pngData
    }

    // MARK: - Game Management

    /// Clear the cached games list
    func clearCache() {
        cachedGames = []
        lastScanTime = nil
        print("[GameDetectionService] Cache cleared")
    }

    /// Get a specific game by ID from cache
    func getGame(id: UUID) -> Game? {
        cachedGames.first { $0.id == id }
    }

    /// Update a game in the cache
    func updateGame(_ game: Game) {
        if let index = cachedGames.firstIndex(where: { $0.id == game.id }) {
            cachedGames[index] = game
            print("[GameDetectionService] Updated game: \(game.name)")
        }
    }
}
