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
//
//  Created by Matthew Byrden
//

import Foundation

/// Design system namespace for Clawdbot apps
public enum ClawdbotDesign {
    /// Module status
    public static let status = "active"

    /// Design system version (tracks design token changes)
    public static let version = "1.0.0"
}
