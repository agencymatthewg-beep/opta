//
//  ShaderEffects.swift
//  Opta Scan
//
//  SwiftUI extensions for Metal shader effects
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

import SwiftUI
import UIKit

// MARK: - Shader Effect Availability

/// Check if Metal shaders are available (iOS 17+)
@available(iOS 17.0, *)
enum OptaShaderEffects {
    /// Whether shader effects should be enabled (respects reduce motion)
    static var isEnabled: Bool {
        !UIAccessibility.isReduceMotionEnabled
    }
}

// MARK: - Color Tint Effect

@available(iOS 17.0, *)
extension View {
    /// Apply a color tint shader effect
    /// - Parameters:
    ///   - color: The tint color to apply
    ///   - intensity: Tint intensity from 0 (none) to 1 (full)
    ///   - isEnabled: Whether the effect is active
    func shaderTint(
        _ color: Color,
        intensity: Double = 0.3,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.colorTint(
                .color(color),
                .float(intensity)
            ),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }

    /// Apply brightness adjustment shader
    /// - Parameters:
    ///   - amount: Brightness adjustment (-1 to 1, 0 = no change)
    ///   - isEnabled: Whether the effect is active
    func shaderBrightness(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.brightness(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }

    /// Apply saturation adjustment shader
    /// - Parameters:
    ///   - amount: Saturation level (0 = grayscale, 1 = normal, >1 = oversaturated)
    ///   - isEnabled: Whether the effect is active
    func shaderSaturation(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.saturation(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }
}

// MARK: - Obsidian Glass Effect

@available(iOS 17.0, *)
extension View {
    /// Apply obsidian glass shader effect
    /// - Parameters:
    ///   - depth: Glass depth level (0 = shallow, 1 = deep)
    ///   - glowColor: Inner glow color (default: purple)
    ///   - glowIntensity: Glow strength 0-1 (default: 0.3)
    ///   - noiseAmount: Subtle noise texture 0-1 (default: 0.5)
    ///   - isEnabled: Whether the effect is active
    func obsidianGlass(
        depth: Double = 0.5,
        glowColor: Color = .optaPurple,
        glowIntensity: Double = 0.3,
        noiseAmount: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.obsidianGlass(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(depth),
                    .color(glowColor),
                    .float(glowIntensity),
                    .float(noiseAmount)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply glass highlight sweep effect
    /// - Parameters:
    ///   - angle: Highlight angle in degrees (default: 45)
    ///   - width: Highlight band width 0-1 (default: 0.3)
    ///   - intensity: Highlight brightness 0-1 (default: 0.5)
    ///   - isEnabled: Whether the effect is active
    func glassHighlight(
        angle: Double = 45,
        width: Double = 0.3,
        intensity: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.glassHighlight(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(angle * .pi / 180), // Convert to radians
                    .float(width),
                    .float(intensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }
}

// MARK: - Fallback for iOS 16

extension View {
    /// Conditional shader tint with iOS 16 fallback
    @ViewBuilder
    func optaTint(_ color: Color, intensity: Double = 0.3) -> some View {
        if #available(iOS 17.0, *) {
            self.shaderTint(color, intensity: intensity)
        } else {
            self.colorMultiply(color.opacity(intensity))
        }
    }
}
