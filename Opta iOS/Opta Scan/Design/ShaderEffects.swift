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
