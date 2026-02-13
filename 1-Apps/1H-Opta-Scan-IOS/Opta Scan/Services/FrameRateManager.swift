//
//  FrameRateManager.swift
//  Opta Scan
//
//  Frame rate management and ProMotion support
//  Part of Phase 15: Performance Tuning
//

import SwiftUI
import QuartzCore

// MARK: - Display Info

/// Information about the current display
struct DisplayInfo {
    let maximumFrameRate: Int
    let supportsProMotion: Bool
    let currentRefreshRate: Int

    static var current: DisplayInfo {
        let maxRate = UIScreen.main.maximumFramesPerSecond
        return DisplayInfo(
            maximumFrameRate: maxRate,
            supportsProMotion: maxRate >= 120,
            currentRefreshRate: maxRate
        )
    }
}

// MARK: - Frame Rate Target

/// Target frame rates for different scenarios
enum FrameRateTarget {
    case maximum      // Full device capability
    case high         // 60fps
    case standard     // 30fps
    case low          // 24fps (cinematic)

    var fps: Int {
        let maxRate = DisplayInfo.current.maximumFrameRate
        switch self {
        case .maximum: return maxRate
        case .high: return min(60, maxRate)
        case .standard: return 30
        case .low: return 24
        }
    }

    var frameDuration: TimeInterval {
        1.0 / Double(fps)
    }
}

// MARK: - Frame Rate Manager

/// Manages frame rate targeting and display link
@Observable
final class FrameRateManager {
    static let shared = FrameRateManager()

    // MARK: - State

    private(set) var currentTarget: FrameRateTarget = .high
    private(set) var displayInfo: DisplayInfo
    private(set) var actualFrameRate: Double = 60

    private var displayLink: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0
    private var frameCount: Int = 0
    private var frameRateAccumulator: Double = 0

    // MARK: - Init

    private init() {
        displayInfo = DisplayInfo.current
        updateTarget(for: PerformanceManager.shared.currentQuality)
    }

    // MARK: - Target Management

    /// Update frame rate target based on quality tier
    func updateTarget(for quality: QualityTier) {
        switch quality {
        case .ultra:
            currentTarget = displayInfo.supportsProMotion ? .maximum : .high
        case .high:
            currentTarget = .high
        case .medium, .low:
            currentTarget = .standard
        }
    }

    /// Set explicit frame rate target
    func setTarget(_ target: FrameRateTarget) {
        currentTarget = target
    }

    // MARK: - Frame Rate Monitoring

    /// Start monitoring actual frame rate
    func startMonitoring() {
        guard displayLink == nil else { return }

        displayLink = CADisplayLink(target: self, selector: #selector(handleDisplayLink))
        displayLink?.preferredFrameRateRange = CAFrameRateRange(
            minimum: Float(currentTarget.fps / 2),
            maximum: Float(currentTarget.fps),
            preferred: Float(currentTarget.fps)
        )
        displayLink?.add(to: .main, forMode: .common)
    }

    /// Stop monitoring
    func stopMonitoring() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func handleDisplayLink(_ link: CADisplayLink) {
        if lastTimestamp > 0 {
            let delta = link.timestamp - lastTimestamp
            let instantFPS = 1.0 / delta
            frameRateAccumulator += instantFPS
            frameCount += 1

            // Update every 30 frames
            if frameCount >= 30 {
                actualFrameRate = frameRateAccumulator / Double(frameCount)
                frameRateAccumulator = 0
                frameCount = 0
            }
        }
        lastTimestamp = link.timestamp
    }

    // MARK: - ProMotion Helpers

    /// Whether ProMotion is available and enabled
    var isProMotionActive: Bool {
        displayInfo.supportsProMotion && currentTarget == .maximum
    }

    /// Suggested animation duration multiplier for current frame rate
    var animationDurationMultiplier: Double {
        // Faster animations look better at higher frame rates
        switch currentTarget {
        case .maximum: return 0.8
        case .high: return 1.0
        case .standard: return 1.2
        case .low: return 1.5
        }
    }
}

// MARK: - Frame Budget

/// Tracks frame budget for complex operations
struct FrameBudget {
    let targetFrameTime: TimeInterval
    let startTime: CFAbsoluteTime

    init(target: FrameRateTarget = .high) {
        self.targetFrameTime = target.frameDuration
        self.startTime = CFAbsoluteTimeGetCurrent()
    }

    /// Remaining time in current frame budget
    var remaining: TimeInterval {
        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        return max(0, targetFrameTime - elapsed)
    }

    /// Whether we're within budget
    var isWithinBudget: Bool {
        remaining > 0
    }

    /// Percentage of budget used
    var usage: Double {
        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        return min(1.0, elapsed / targetFrameTime)
    }
}

// MARK: - Efficient Rendering Modifier

/// Modifier for GPU-efficient rendering
struct EfficientRenderingModifier: ViewModifier {
    let drawsAsynchronously: Bool
    let shouldRasterize: Bool

    func body(content: Content) -> some View {
        content
            .drawingGroup(opaque: false, colorMode: .nonLinear)
    }
}

extension View {
    /// Apply efficient rendering for complex views
    func efficientRendering(
        drawsAsynchronously: Bool = true,
        shouldRasterize: Bool = false
    ) -> some View {
        modifier(EfficientRenderingModifier(
            drawsAsynchronously: drawsAsynchronously,
            shouldRasterize: shouldRasterize
        ))
    }

    /// Flatten view hierarchy for better performance
    func flattened() -> some View {
        drawingGroup()
    }
}

// MARK: - Frame Rate Aware Animation

extension Animation {
    /// Animation optimized for current frame rate
    static var frameRateAware: Animation {
        let manager = FrameRateManager.shared
        let multiplier = manager.animationDurationMultiplier
        return .spring(response: 0.3 * multiplier, dampingFraction: 0.7)
    }
}
