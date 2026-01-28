//
//  ProcessingGlowView.swift
//  Opta Scan
//
//  Animated glow effect for processing/loading states
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

import SwiftUI
import UIKit

/// Wraps content with an animated pulsing glow when processing
@available(iOS 17.0, *)
struct ProcessingGlowView<Content: View>: View {
    let isProcessing: Bool
    let glowColor: Color
    @ViewBuilder let content: () -> Content

    @State private var animationTime: Double = 0

    init(
        isProcessing: Bool,
        glowColor: Color = .optaPurpleGlow,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isProcessing = isProcessing
        self.glowColor = glowColor
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60, paused: !isProcessing)) { timeline in
            content()
                .pulsingGlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    glowColor: glowColor,
                    pulseSpeed: 1.5,
                    minIntensity: 0.15,
                    maxIntensity: 0.5,
                    isEnabled: isProcessing
                )
        }
    }
}

/// Convenience modifier for processing glow
@available(iOS 17.0, *)
extension View {
    /// Add processing glow animation when condition is true
    func processingGlow(
        _ isProcessing: Bool,
        color: Color = .optaPurpleGlow
    ) -> some View {
        ProcessingGlowView(isProcessing: isProcessing, glowColor: color) {
            self
        }
    }
}

// MARK: - iOS 16 Fallback

extension View {
    /// Processing glow with iOS 16 fallback (uses opacity animation)
    @ViewBuilder
    func optaProcessingGlow(_ isProcessing: Bool) -> some View {
        if #available(iOS 17.0, *) {
            self.processingGlow(isProcessing)
        } else {
            // Fallback: simple opacity pulse
            self.overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.optaPurpleGlow, lineWidth: 2)
                    .opacity(isProcessing ? 0.6 : 0)
                    .animation(
                        isProcessing ?
                            .easeInOut(duration: 0.8).repeatForever(autoreverses: true) :
                            .default,
                        value: isProcessing
                    )
            )
        }
    }
}
