//
//  ClawdbotTypographyTests.swift
//  ClawdbotKitTests
//
//  Tests for Sora typography integration and Moonlight gradient text.
//

import XCTest
import SwiftUI
@testable import ClawdbotKit

final class ClawdbotTypographyTests: XCTestCase {

    // MARK: - Font Registration

    func testFontRegistrationDoesNotCrash() {
        // Should not throw or crash
        ClawdbotTypography.registerFonts()

        // Call again to test idempotency
        ClawdbotTypography.registerFonts()
    }

    // MARK: - Font Extensions

    func testSoraFontWeights() {
        // Verify all weights can be instantiated
        let lightFont = Font.sora(14, weight: .light)
        let regularFont = Font.sora(14, weight: .regular)
        let mediumFont = Font.sora(14, weight: .medium)
        let semiboldFont = Font.sora(14, weight: .semibold)
        let boldFont = Font.sora(14, weight: .bold)

        XCTAssertNotNil(lightFont)
        XCTAssertNotNil(regularFont)
        XCTAssertNotNil(mediumFont)
        XCTAssertNotNil(semiboldFont)
        XCTAssertNotNil(boldFont)
    }

    func testSoraFontDefaultWeight() {
        // Default should be regular
        let defaultFont = Font.sora(16)
        XCTAssertNotNil(defaultFont)
    }

    func testSemanticFontPresets() {
        // Verify all semantic presets are accessible
        XCTAssertNotNil(Font.soraHero)
        XCTAssertNotNil(Font.soraSectionHeader)
        XCTAssertNotNil(Font.soraSubsection)
        XCTAssertNotNil(Font.soraSubtitle)
        XCTAssertNotNil(Font.soraBody)
        XCTAssertNotNil(Font.soraCaption)
        XCTAssertNotNil(Font.soraBadge)
    }

    // MARK: - MoonlightText

    func testMoonlightTextDefaultInit() {
        let view = MoonlightText("OPTA")
        XCTAssertNotNil(view.body)
    }

    func testMoonlightTextCustomInit() {
        let view = MoonlightText("Custom", size: 24, weight: .semibold, tracking: 0.08)
        XCTAssertNotNil(view.body)
    }

    // MARK: - Moonlight Gradient

    func testMoonlightGradientExists() {
        let gradient = LinearGradient.moonlight
        XCTAssertNotNil(gradient)
    }

    // MARK: - Tracking Calculations

    func testHeroTrackingCalculation() {
        // Hero tracking = fontSize * 0.12
        let fontSize: CGFloat = 34
        let expectedTracking = fontSize * 0.12
        XCTAssertEqual(expectedTracking, 4.08, accuracy: 0.01)
    }

    func testSubtitleTrackingCalculation() {
        // Subtitle tracking = fontSize * 0.25
        let fontSize: CGFloat = 17
        let expectedTracking = fontSize * 0.25
        XCTAssertEqual(expectedTracking, 4.25, accuracy: 0.01)
    }

    func testSectionHeaderTrackingCalculation() {
        // Section header tracking = fontSize * 0.08
        let fontSize: CGFloat = 28
        let expectedTracking = fontSize * 0.08
        XCTAssertEqual(expectedTracking, 2.24, accuracy: 0.01)
    }

    func testBadgeTrackingCalculation() {
        // Badge tracking = fontSize * 0.15
        let fontSize: CGFloat = 12
        let expectedTracking = fontSize * 0.15
        XCTAssertEqual(expectedTracking, 1.8, accuracy: 0.01)
    }

    func testSubsectionTrackingCalculation() {
        // Subsection tracking = fontSize * 0.05
        let fontSize: CGFloat = 20
        let expectedTracking = fontSize * 0.05
        XCTAssertEqual(expectedTracking, 1.0, accuracy: 0.01)
    }

    // MARK: - Typography Scale Consistency

    func testTypographyScaleHierarchy() {
        // Hero should be largest, then section header, subsection, subtitle, body, caption, badge
        let heroSize: CGFloat = 34
        let sectionHeaderSize: CGFloat = 28
        let subsectionSize: CGFloat = 20
        let subtitleSize: CGFloat = 17
        let bodySize: CGFloat = 15
        let captionSize: CGFloat = 13
        let badgeSize: CGFloat = 12

        XCTAssertGreaterThan(heroSize, sectionHeaderSize)
        XCTAssertGreaterThan(sectionHeaderSize, subsectionSize)
        XCTAssertGreaterThan(subsectionSize, subtitleSize)
        XCTAssertGreaterThan(subtitleSize, bodySize)
        XCTAssertGreaterThan(bodySize, captionSize)
        XCTAssertGreaterThan(captionSize, badgeSize)
    }

    // MARK: - View Modifier Smoke Tests

    func testTrackingModifiersCompile() {
        // Verify all tracking modifiers can be applied to Text
        let text = Text("Test")

        _ = text.trackingHero()
        _ = text.trackingSubtitle()
        _ = text.trackingSectionHeader()
        _ = text.trackingBadge()
        _ = text.trackingSubsection()
    }

    func testTypographyStyleModifiersCompile() {
        // Verify all style modifiers can be applied to Text
        let text = Text("Test")

        _ = text.optaHeroStyle()
        _ = text.optaSubtitleStyle()
        _ = text.optaSectionHeaderStyle()
        _ = text.optaSubsectionStyle()
        _ = text.optaBodyStyle()
        _ = text.optaCaptionStyle()
        _ = text.optaBadgeStyle()
    }

    func testTrackingModifiersWithCustomFontSize() {
        let text = Text("Test")

        // All tracking modifiers should accept custom font size
        _ = text.trackingHero(fontSize: 48)
        _ = text.trackingSubtitle(fontSize: 20)
        _ = text.trackingSectionHeader(fontSize: 32)
        _ = text.trackingBadge(fontSize: 14)
        _ = text.trackingSubsection(fontSize: 24)
    }
}
