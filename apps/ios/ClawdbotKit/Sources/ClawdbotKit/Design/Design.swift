//
//  Design.swift
//  ClawdbotKit
//
//  Design system module for Clawdbot native apps.
//  Ported from Opta iOS design system (Phase 1, Plan 02).
//
//  Components:
//  - ClawdbotColors.swift: OLED-optimized color tokens
//  - ClawdbotAnimations.swift: Spring physics presets
//  - PhysicsSpring.swift: Configurable spring physics
//  - ClawdbotHaptics.swift: Cross-platform haptic feedback
//  - ClawdbotGlassModifiers.swift: 3-level glass system + obsidian variants
//  - ClawdbotGlowEffects.swift: Glow intensity modifiers
//  - OptaStatusBadge.swift: Status indicator badge component
//
//  Created by Matthew Byrden
//

import Foundation

/// Design system namespace for Clawdbot apps
public enum ClawdbotDesign {
    /// Module status
    public static let status = "active"

    /// Design system version (tracks design token changes)
    /// v1.1.0: Added glass, obsidian, glow effects, status badge
    public static let version = "1.1.0"
}
