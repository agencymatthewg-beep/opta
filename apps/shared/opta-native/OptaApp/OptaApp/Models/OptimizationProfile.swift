//
//  OptimizationProfile.swift
//  OptaApp
//
//  Optimization profile model and persistence manager.
//  Profiles are saved to ~/Library/Application Support/Opta/profiles/
//

import Foundation

// MARK: - OptimizationProfile

/// A saved configuration profile for optimization settings.
///
/// Profiles allow users to save and restore their preferred optimization
/// configurations, including quality settings, haptics, and process termination lists.
struct OptimizationProfile: Codable, Identifiable, Hashable {
    /// Unique identifier
    let id: UUID

    /// User-defined profile name
    var name: String

    /// Quality level (0: Low, 1: Medium, 2: High, 3: Ultra, 4: Adaptive)
    var qualityLevel: Int

    /// Whether haptic feedback is enabled
    var enableHaptics: Bool

    /// Whether auto-optimize on launch is enabled
    var autoOptimize: Bool

    /// List of processes to terminate during optimization
    var processTerminationList: [String]

    /// When the profile was created
    let createdAt: Date

    /// When the profile was last applied
    var lastUsedAt: Date?

    /// Create a new profile with current date
    init(
        id: UUID = UUID(),
        name: String,
        qualityLevel: Int = 2,
        enableHaptics: Bool = true,
        autoOptimize: Bool = false,
        processTerminationList: [String] = [],
        createdAt: Date = Date(),
        lastUsedAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.qualityLevel = qualityLevel
        self.enableHaptics = enableHaptics
        self.autoOptimize = autoOptimize
        self.processTerminationList = processTerminationList
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
    }

    /// Human-readable quality level name
    var qualityLevelName: String {
        switch qualityLevel {
        case 0: return "Low"
        case 1: return "Medium"
        case 2: return "High"
        case 3: return "Ultra"
        case 4: return "Adaptive"
        default: return "Unknown"
        }
    }
}

// MARK: - ProfileManager

/// Manages saving, loading, and exporting optimization profiles.
///
/// Profiles are persisted to disk at:
/// `~/Library/Application Support/Opta/profiles/`
///
/// Each profile is saved as a JSON file named by its UUID.
final class ProfileManager: ObservableObject {

    // MARK: - Properties

    /// All loaded profiles
    @Published private(set) var profiles: [OptimizationProfile] = []

    /// Profiles directory URL
    private let profilesDirectory: URL

    /// File manager instance
    private let fileManager = FileManager.default

    /// JSON encoder with pretty printing
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()

    /// JSON decoder
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    // MARK: - Singleton

    /// Shared instance
    static let shared = ProfileManager()

    // MARK: - Initialization

    private init() {
        // Get Application Support directory
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let optaDirectory = appSupport.appendingPathComponent("Opta", isDirectory: true)
        profilesDirectory = optaDirectory.appendingPathComponent("profiles", isDirectory: true)

        // Create directories if needed
        createDirectoriesIfNeeded()

        // Load all profiles
        loadAllProfiles()
    }

    // MARK: - Directory Management

    /// Create the profiles directory if it doesn't exist
    private func createDirectoriesIfNeeded() {
        if !fileManager.fileExists(atPath: profilesDirectory.path) {
            do {
                try fileManager.createDirectory(
                    at: profilesDirectory,
                    withIntermediateDirectories: true,
                    attributes: nil
                )
                print("[ProfileManager] Created profiles directory at: \(profilesDirectory.path)")
            } catch {
                print("[ProfileManager] Error creating profiles directory: \(error)")
            }
        }
    }

    // MARK: - File Operations

    /// Get the file URL for a profile
    private func fileURL(for id: UUID) -> URL {
        profilesDirectory.appendingPathComponent("\(id.uuidString).json")
    }

    // MARK: - CRUD Operations

    /// Save a profile to disk
    /// - Parameter profile: The profile to save
    /// - Returns: Whether the save succeeded
    @discardableResult
    func save(profile: OptimizationProfile) -> Bool {
        let url = fileURL(for: profile.id)

        do {
            let data = try encoder.encode(profile)
            try data.write(to: url, options: .atomic)

            // Update in-memory list
            if let index = profiles.firstIndex(where: { $0.id == profile.id }) {
                profiles[index] = profile
            } else {
                profiles.append(profile)
            }

            // Sort by last used (most recent first), then by name
            profiles.sort { lhs, rhs in
                if let lhsUsed = lhs.lastUsedAt, let rhsUsed = rhs.lastUsedAt {
                    return lhsUsed > rhsUsed
                } else if lhs.lastUsedAt != nil {
                    return true
                } else if rhs.lastUsedAt != nil {
                    return false
                } else {
                    return lhs.name < rhs.name
                }
            }

            print("[ProfileManager] Saved profile: \(profile.name)")
            return true
        } catch {
            print("[ProfileManager] Error saving profile: \(error)")
            return false
        }
    }

    /// Load a specific profile by ID
    /// - Parameter id: The profile UUID
    /// - Returns: The loaded profile, or nil if not found
    func load(id: UUID) -> OptimizationProfile? {
        let url = fileURL(for: id)

        guard fileManager.fileExists(atPath: url.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: url)
            let profile = try decoder.decode(OptimizationProfile.self, from: data)
            return profile
        } catch {
            print("[ProfileManager] Error loading profile \(id): \(error)")
            return nil
        }
    }

    /// Load all profiles from disk
    private func loadAllProfiles() {
        profiles = []

        guard let enumerator = fileManager.enumerator(
            at: profilesDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else {
            return
        }

        while let url = enumerator.nextObject() as? URL {
            guard url.pathExtension == "json" else { continue }

            do {
                let data = try Data(contentsOf: url)
                let profile = try decoder.decode(OptimizationProfile.self, from: data)
                profiles.append(profile)
            } catch {
                print("[ProfileManager] Error loading profile at \(url): \(error)")
            }
        }

        // Sort by last used (most recent first), then by name
        profiles.sort { lhs, rhs in
            if let lhsUsed = lhs.lastUsedAt, let rhsUsed = rhs.lastUsedAt {
                return lhsUsed > rhsUsed
            } else if lhs.lastUsedAt != nil {
                return true
            } else if rhs.lastUsedAt != nil {
                return false
            } else {
                return lhs.name < rhs.name
            }
        }

        print("[ProfileManager] Loaded \(profiles.count) profiles")
    }

    /// Reload all profiles from disk
    func loadAll() -> [OptimizationProfile] {
        loadAllProfiles()
        return profiles
    }

    /// Delete a profile by ID
    /// - Parameter id: The profile UUID to delete
    /// - Returns: Whether the deletion succeeded
    @discardableResult
    func delete(id: UUID) -> Bool {
        let url = fileURL(for: id)

        do {
            try fileManager.removeItem(at: url)
            profiles.removeAll { $0.id == id }
            print("[ProfileManager] Deleted profile: \(id)")
            return true
        } catch {
            print("[ProfileManager] Error deleting profile: \(error)")
            return false
        }
    }

    // MARK: - Export/Import

    /// Export a profile to the Downloads folder
    /// - Parameter profile: The profile to export
    /// - Returns: The URL of the exported file, or nil if export failed
    func export(profile: OptimizationProfile) -> URL? {
        guard let downloadsURL = fileManager.urls(for: .downloadsDirectory, in: .userDomainMask).first else {
            print("[ProfileManager] Could not access Downloads directory")
            return nil
        }

        // Create filename with profile name (sanitized)
        let sanitizedName = profile.name
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        let fileName = "Opta-Profile-\(sanitizedName).json"
        let exportURL = downloadsURL.appendingPathComponent(fileName)

        do {
            let data = try encoder.encode(profile)
            try data.write(to: exportURL, options: .atomic)
            print("[ProfileManager] Exported profile to: \(exportURL.path)")
            return exportURL
        } catch {
            print("[ProfileManager] Error exporting profile: \(error)")
            return nil
        }
    }

    /// Import a profile from a URL
    /// - Parameter url: The URL of the JSON file to import
    /// - Returns: The imported profile, or nil if import failed
    func importProfile(from url: URL) -> OptimizationProfile? {
        do {
            let data = try Data(contentsOf: url)
            var profile = try decoder.decode(OptimizationProfile.self, from: data)

            // Generate new ID to avoid conflicts
            profile = OptimizationProfile(
                id: UUID(),
                name: profile.name + " (Imported)",
                qualityLevel: profile.qualityLevel,
                enableHaptics: profile.enableHaptics,
                autoOptimize: profile.autoOptimize,
                processTerminationList: profile.processTerminationList,
                createdAt: Date(),
                lastUsedAt: nil
            )

            // Save the imported profile
            save(profile: profile)

            print("[ProfileManager] Imported profile: \(profile.name)")
            return profile
        } catch {
            print("[ProfileManager] Error importing profile: \(error)")
            return nil
        }
    }

    /// Mark a profile as recently used
    /// - Parameter id: The profile UUID
    func markAsUsed(id: UUID) {
        guard var profile = profiles.first(where: { $0.id == id }) else { return }
        profile.lastUsedAt = Date()
        save(profile: profile)
    }
}
