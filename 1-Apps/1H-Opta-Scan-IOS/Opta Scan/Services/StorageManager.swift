//
//  StorageManager.swift
//  Opta Scan
//
//  Manages model storage space and cleanup
//  All processing is local - tracks on-device model storage
//
//  Created by Matthew Byrden
//

import Foundation

// MARK: - Storage Manager

@MainActor
@Observable
final class StorageManager {
    static let shared = StorageManager()

    // MARK: - State

    private(set) var totalStorageBytes: Int64 = 0
    private(set) var availableStorageBytes: Int64 = 0
    private(set) var modelStorageBytes: Int64 = 0

    // MARK: - Computed Properties

    var availableStorageGB: Double {
        Double(availableStorageBytes) / (1024 * 1024 * 1024)
    }

    var modelStorageGB: Double {
        Double(modelStorageBytes) / (1024 * 1024 * 1024)
    }

    var availableStorageString: String {
        ByteCountFormatter.string(fromByteCount: availableStorageBytes, countStyle: .file)
    }

    var modelStorageString: String {
        ByteCountFormatter.string(fromByteCount: modelStorageBytes, countStyle: .file)
    }

    // MARK: - URLs

    private var modelCacheURL: URL? {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?
            .appendingPathComponent("huggingface", isDirectory: true)
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Refresh

    func refresh() async {
        await updateStorageInfo()
        await calculateModelStorage()
    }

    private func updateStorageInfo() async {
        guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return
        }

        do {
            let values = try documentsURL.resourceValues(forKeys: [
                .volumeTotalCapacityKey,
                .volumeAvailableCapacityForImportantUsageKey
            ])

            if let total = values.volumeTotalCapacity {
                totalStorageBytes = Int64(total)
            }

            if let available = values.volumeAvailableCapacityForImportantUsage {
                availableStorageBytes = available
            }
        } catch {
            print("Failed to get storage info: \(error)")
        }
    }

    private func calculateModelStorage() async {
        guard let cacheURL = modelCacheURL else {
            modelStorageBytes = 0
            return
        }

        modelStorageBytes = directorySize(at: cacheURL)
    }

    private func directorySize(at url: URL) -> Int64 {
        let fileManager = FileManager.default
        var size: Int64 = 0

        guard let enumerator = fileManager.enumerator(
            at: url,
            includingPropertiesForKeys: [.fileSizeKey, .isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return 0
        }

        for case let fileURL as URL in enumerator {
            do {
                let values = try fileURL.resourceValues(forKeys: [.fileSizeKey, .isDirectoryKey])
                if values.isDirectory == false, let fileSize = values.fileSize {
                    size += Int64(fileSize)
                }
            } catch {
                continue
            }
        }

        return size
    }

    // MARK: - Validation

    func canDownloadModel(_ config: OptaModelConfiguration) -> (Bool, String?) {
        let requiredBytes = Int64(config.sizeGB * 1024 * 1024 * 1024 * 1.2) // 20% buffer

        if availableStorageBytes < requiredBytes {
            let needed = ByteCountFormatter.string(fromByteCount: requiredBytes, countStyle: .file)
            let available = availableStorageString
            return (false, "Need \(needed), only \(available) available")
        }

        return (true, nil)
    }

    // MARK: - Cleanup

    func deleteModel(_ config: OptaModelConfiguration) async throws {
        // Remove from ModelCache
        await ModelCache.shared.remove(for: config)

        // Remove from download states
        ModelDownloadManager.shared.removeDownloadState(for: config)

        // Remove from UserDefaults
        var downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        downloaded.removeAll { $0 == config.id }
        UserDefaults.standard.set(downloaded, forKey: "downloadedModels")

        // Clear selection if this model was selected
        if UserDefaults.standard.string(forKey: "opta.selectedModelId") == config.id {
            UserDefaults.standard.removeObject(forKey: "opta.selectedModelId")
        }

        // Note: Actual file deletion is managed by HubApi cache
        // Files are stored in ~/Documents/huggingface/hub/
        // For now, we just clear our tracking. Full file deletion would require
        // iterating the hub cache directory.

        await refresh()
    }

    func clearAllModels() async throws {
        guard let cacheURL = modelCacheURL else { return }

        let fileManager = FileManager.default

        if fileManager.fileExists(atPath: cacheURL.path) {
            try fileManager.removeItem(at: cacheURL)
        }

        // Clear all states
        for config in OptaModelConfiguration.all {
            await ModelCache.shared.remove(for: config)
            ModelDownloadManager.shared.removeDownloadState(for: config)
        }

        UserDefaults.standard.removeObject(forKey: "downloadedModels")
        UserDefaults.standard.removeObject(forKey: "opta.selectedModelId")

        await refresh()
    }
}
