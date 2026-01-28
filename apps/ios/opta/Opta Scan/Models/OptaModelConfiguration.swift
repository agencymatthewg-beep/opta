//
//  OptaModelConfiguration.swift
//  Opta Scan
//
//  MLX model configurations for Opta
//  Defines available models for on-device inference
//

import Foundation

/// Configuration for MLX models available in Opta
struct OptaModelConfiguration: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let displayName: String
    let description: String
    let sizeGB: Double
    let contextLength: Int
    let supportsVision: Bool
    let minimumRAM: Int // GB

    // MARK: - Available Models

    /// Llama 3.2 11B Vision - Full vision capabilities with image understanding
    /// Requires iPhone 15 Pro Max (8GB RAM) or iPad Pro M1+ (16GB RAM)
    static let llama32_11B_Vision = OptaModelConfiguration(
        id: "llama-3.2-11b-vision",
        name: "mlx-community/Llama-3.2-11B-Vision-Instruct-4bit",
        displayName: "Llama 3.2 11B Vision",
        description: "Full vision capabilities with image understanding",
        sizeGB: 6.5,
        contextLength: 8192,
        supportsVision: true,
        minimumRAM: 8
    )

    /// Llama 3.2 3B - Compact text-only model for faster responses
    /// Works on most A14+ devices
    static let llama32_3B = OptaModelConfiguration(
        id: "llama-3.2-3b",
        name: "mlx-community/Llama-3.2-3B-Instruct-4bit",
        displayName: "Llama 3.2 3B",
        description: "Compact model for faster responses",
        sizeGB: 2.0,
        contextLength: 4096,
        supportsVision: false,
        minimumRAM: 4
    )

    /// Llama 3.2 1B - Ultra-compact model for quick queries
    /// Works on most A14+ devices
    static let llama32_1B = OptaModelConfiguration(
        id: "llama-3.2-1b",
        name: "mlx-community/Llama-3.2-1B-Instruct-4bit",
        displayName: "Llama 3.2 1B",
        description: "Ultra-compact model for quick queries",
        sizeGB: 0.8,
        contextLength: 2048,
        supportsVision: false,
        minimumRAM: 2
    )

    // MARK: - Collections

    /// All available model configurations
    static let all: [OptaModelConfiguration] = [
        .llama32_11B_Vision,
        .llama32_3B,
        .llama32_1B
    ]

    /// Models with vision support
    static let visionModels: [OptaModelConfiguration] = all.filter { $0.supportsVision }

    /// Text-only models
    static let textModels: [OptaModelConfiguration] = all.filter { !$0.supportsVision }

    /// Default model (vision-capable)
    static let `default` = llama32_11B_Vision

    // MARK: - Helpers

    /// Check if device has enough RAM for this model
    func isCompatibleWithDevice() -> Bool {
        let deviceRAM = ProcessInfo.processInfo.physicalMemory / (1024 * 1024 * 1024)
        return Int(deviceRAM) >= minimumRAM
    }

    /// Human-readable size string
    var sizeString: String {
        if sizeGB < 1.0 {
            return String(format: "%.0f MB", sizeGB * 1024)
        } else {
            return String(format: "%.1f GB", sizeGB)
        }
    }

    /// Human-readable RAM requirement
    var ramRequirementString: String {
        "\(minimumRAM) GB RAM"
    }
}

// MARK: - Model Download State

/// Tracks the download and installation state of a model
enum ModelDownloadState: Equatable {
    case notDownloaded
    case downloading(progress: Double)
    case downloaded
    case failed(String)

    var isDownloaded: Bool {
        if case .downloaded = self { return true }
        return false
    }

    var isDownloading: Bool {
        if case .downloading = self { return true }
        return false
    }
}
