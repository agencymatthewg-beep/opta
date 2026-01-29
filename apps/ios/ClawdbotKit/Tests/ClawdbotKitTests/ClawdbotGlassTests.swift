//
//  ClawdbotGlassTests.swift
//  ClawdbotKit
//
//  Tests for glass modifiers, obsidian variants, status badges, and glow effects.
//

import XCTest
import SwiftUI
@testable import ClawdbotKit

final class ClawdbotGlassTests: XCTestCase {

    // MARK: - Glass Level Tests

    func testGlassLevelEnum() {
        // Test that all cases exist
        let subtle = GlassLevel.subtle
        let content = GlassLevel.content
        let overlay = GlassLevel.overlay

        XCTAssertNotNil(subtle)
        XCTAssertNotNil(content)
        XCTAssertNotNil(overlay)
    }

    // MARK: - Obsidian State Tests

    func testObsidianStateEnum() {
        // Test that all cases exist
        let dormant = ObsidianState.dormant
        let interactive = ObsidianState.interactive
        let active = ObsidianState.active

        XCTAssertNotNil(dormant)
        XCTAssertNotNil(interactive)
        XCTAssertNotNil(active)
    }

    // MARK: - Glow Intensity Tests

    func testGlowIntensityEnum() {
        // Test that all cases exist
        let sm = GlowIntensity.sm
        let md = GlowIntensity.md
        let lg = GlowIntensity.lg
        let intense = GlowIntensity.intense

        XCTAssertNotNil(sm)
        XCTAssertNotNil(md)
        XCTAssertNotNil(lg)
        XCTAssertNotNil(intense)
    }

    // MARK: - Color Token Tests

    func testExtendedColorTokens() {
        // Test that new colors exist
        let cyan = Color.clawdbotCyan
        let indigo = Color.clawdbotIndigo
        let pink = Color.clawdbotPink
        let coral = Color.clawdbotCoral

        XCTAssertNotNil(cyan)
        XCTAssertNotNil(indigo)
        XCTAssertNotNil(pink)
        XCTAssertNotNil(coral)
    }

    // MARK: - Status Badge Tests

    func testStatusBadgeStatusEnum() {
        // Test that all cases exist
        let active = OptaStatusBadge.Status.active
        let inactive = OptaStatusBadge.Status.inactive
        let connecting = OptaStatusBadge.Status.connecting

        XCTAssertNotNil(active)
        XCTAssertNotNil(inactive)
        XCTAssertNotNil(connecting)
    }

    func testStatusBadgeInitialization() {
        // Test basic initialization
        let badge = OptaStatusBadge(status: .active)
        XCTAssertNotNil(badge)

        // Test with custom label
        let customBadge = OptaStatusBadge(status: .connecting, label: "CUSTOM LABEL")
        XCTAssertNotNil(customBadge)
    }

    func testStatusBadgeCompactInitialization() {
        // Test compact variant
        let compact = OptaStatusBadge.Compact(status: .active)
        XCTAssertNotNil(compact)
    }

    // MARK: - GlassCard Tests

    func testGlassCardInitialization() {
        // Test default initialization
        let card = GlassCard {
            Text("Test")
        }
        XCTAssertNotNil(card)
    }

    func testGlassCardCustomization() {
        // Test custom parameters
        let card = GlassCard(
            level: .overlay,
            cornerRadius: 20,
            padding: 24
        ) {
            Text("Custom")
        }
        XCTAssertNotNil(card)
    }

    // MARK: - Design System Version

    func testDesignSystemVersion() {
        // Version should be updated to 1.1.0 or higher
        let version = ClawdbotDesign.version
        XCTAssertTrue(version >= "1.1.0", "Design version should be at least 1.1.0")
    }
}
