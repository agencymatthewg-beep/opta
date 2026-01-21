//
//  ModelDownloadManager.swift
//  Opta Scan
//
//  Manages MLX model downloads from Hugging Face Hub
//  All processing is local - models are cached on device
//
//  Created by Matthew Byrden
//

import Foundation
import SwiftUI

#if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
import MLX
import MLXLLM
import MLXLMCommon
#endif

// MARK: - Model Download Manager

@MainActor
@Observable
final class ModelDownloadManager {
    static let shared = ModelDownloadManager()

    // MARK: - State

    private(set) var downloadStates: [String: ModelDownloadState] = [:]
    private(set) var activeDownloadId: String?
    private(set) var downloadProgress: Double = 0

    // MARK: - Initialization

    private init() {
        loadDownloadedModels()
    }

    // MARK: - Download State Per Model

    func state(for model: OptaModelConfiguration) -> ModelDownloadState {
        downloadStates[model.id] ?? .notDownloaded
    }

    // MARK: - Download

    func downloadModel(_ config: OptaModelConfiguration) async throws {
        guard activeDownloadId == nil else {
            throw ModelDownloadError.downloadInProgress
        }

        guard config.isCompatibleWithDevice() else {
            throw ModelDownloadError.insufficientMemory(required: config.minimumRAM)
        }

        // Check available storage
        let requiredBytes = Int64(config.sizeGB * 1024 * 1024 * 1024)
        guard hasAvailableStorage(bytes: requiredBytes) else {
            throw ModelDownloadError.insufficientStorage(required: config.sizeGB)
        }

        activeDownloadId = config.id
        downloadProgress = 0
        downloadStates[config.id] = .downloading(progress: 0)

        do {
            #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
            // Set GPU cache limit
            GPU.set(cacheLimit: 20 * 1024 * 1024)

            // Load model (downloads if not cached)
            let modelConfig = ModelConfiguration(id: config.name)

            let container = try await LLMModelFactory.shared.loadContainer(
                configuration: modelConfig
            ) { [weak self] progress in
                Task { @MainActor in
                    self?.downloadProgress = progress.fractionCompleted
                    self?.downloadStates[config.id] = .downloading(progress: progress.fractionCompleted)
                }
            }

            // Store reference for later use
            await ModelCache.shared.store(container: container, for: config)
            #endif

            downloadStates[config.id] = .downloaded
            saveDownloadedModelId(config.id)

        } catch {
            downloadStates[config.id] = .failed(error.localizedDescription)
            activeDownloadId = nil
            downloadProgress = 0
            throw error
        }

        activeDownloadId = nil
        downloadProgress = 0
    }

    // MARK: - Cancel

    func cancelDownload() {
        // Note: MLX doesn't provide native cancellation
        // This resets state but download may continue in background
        if let id = activeDownloadId {
            downloadStates[id] = .notDownloaded
        }
        activeDownloadId = nil
        downloadProgress = 0
    }

    // MARK: - Remove State

    func removeDownloadState(for config: OptaModelConfiguration) {
        downloadStates.removeValue(forKey: config.id)
    }

    // MARK: - Delete Model

    func deleteModel(_ config: OptaModelConfiguration) async {
        // Remove from cache
        await ModelCache.shared.remove(for: config)

        // Update state
        downloadStates[config.id] = .notDownloaded

        // Remove from persisted list
        var downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        downloaded.removeAll { $0 == config.id }
        UserDefaults.standard.set(downloaded, forKey: "downloadedModels")
    }

    // MARK: - Storage Validation

    private func hasAvailableStorage(bytes: Int64) -> Bool {
        let fileManager = FileManager.default
        guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return false
        }

        do {
            let values = try documentsURL.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            if let available = values.volumeAvailableCapacityForImportantUsage {
                // Require 20% buffer
                return available > Int64(Double(bytes) * 1.2)
            }
        } catch {
            print("Storage check failed: \(error)")
        }

        return false
    }

    // MARK: - Persistence

    private func saveDownloadedModelId(_ id: String) {
        var downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        if !downloaded.contains(id) {
            downloaded.append(id)
            UserDefaults.standard.set(downloaded, forKey: "downloadedModels")
        }
    }

    func loadDownloadedModels() {
        let downloaded = UserDefaults.standard.stringArray(forKey: "downloadedModels") ?? []
        for id in downloaded {
            downloadStates[id] = .downloaded
        }
    }

    func isModelDownloaded(_ config: OptaModelConfiguration) -> Bool {
        downloadStates[config.id]?.isDownloaded ?? false
    }
}

// MARK: - Model Cache

actor ModelCache {
    static let shared = ModelCache()

    #if canImport(MLX) && canImport(MLXLLM) && !targetEnvironment(simulator)
    private var containers: [String: ModelContainer] = [:]

    func store(container: ModelContainer, for config: OptaModelConfiguration) {
        containers[config.id] = container
    }

    func retrieve(for config: OptaModelConfiguration) -> ModelContainer? {
        containers[config.id]
    }

    func remove(for config: OptaModelConfiguration) {
        containers.removeValue(forKey: config.id)
    }
    #else
    func store(container: Any, for config: OptaModelConfiguration) {}
    func retrieve(for config: OptaModelConfiguration) -> Any? { nil }
    func remove(for config: OptaModelConfiguration) {}
    #endif
}

// MARK: - Errors

enum ModelDownloadError: LocalizedError {
    case downloadInProgress
    case insufficientMemory(required: Int)
    case insufficientStorage(required: Double)
    case networkError(String)
    case modelNotFound(String)

    var errorDescription: String? {
        switch self {
        case .downloadInProgress:
            return "A download is already in progress."
        case .insufficientMemory(let required):
            return "This model requires \(required) GB RAM. Your device may not support it."
        case .insufficientStorage(let required):
            return "Not enough storage. \(String(format: "%.1f", required)) GB required."
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .modelNotFound(let name):
            return "Model not found: \(name)"
        }
    }
}
