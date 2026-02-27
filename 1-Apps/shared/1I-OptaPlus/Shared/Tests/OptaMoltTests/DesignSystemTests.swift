//
//  DesignSystemTests.swift
//  OptaMoltTests
//
//  Verifies design system tokens: colors, typography, glass modifiers, motion.
//

import XCTest
import SwiftUI
@testable import OptaMolt

final class DesignSystemTests: XCTestCase {

    // MARK: - Color Tokens

    func testCoreColorTokensExist() {
        // Base palette
        let _ = Color.optaVoid
        let _ = Color.optaSurface
        let _ = Color.optaElevated
        let _ = Color.optaBackground
        let _ = Color.optaSurfaceElevated
        let _ = Color.optaBorder
        // Primary
        let _ = Color.optaPrimary
        let _ = Color.optaPrimaryGlow
        let _ = Color.optaPrimaryDim
        // Neon accents
        let _ = Color.optaGreen
        let _ = Color.optaBlue
        let _ = Color.optaAmber
        let _ = Color.optaRed
        let _ = Color.optaCyan
        let _ = Color.optaNeonPurple
        let _ = Color.optaPink
        let _ = Color.optaCoral
        let _ = Color.optaIndigo
        // Text
        let _ = Color.optaTextPrimary
        let _ = Color.optaTextSecondary
        let _ = Color.optaTextMuted
        // Glass
        let _ = Color.optaGlassBackground
        let _ = Color.optaGlassBorder
        let _ = Color.optaGlassHighlight
        // Code / Syntax
        let _ = Color.optaCodeBackground
        let _ = Color.optaSyntaxKeyword
        let _ = Color.optaSyntaxString
        let _ = Color.optaSyntaxNumber
        let _ = Color.optaSyntaxType
        let _ = Color.optaSyntaxComment
        let _ = Color.optaSyntaxDecorator
        let _ = Color.optaSyntaxVariable
        let _ = Color.optaSyntaxOperator
    }

    func testHexColorInitializer() {
        let color = Color(hex: "#FF5733")
        let _ = color // Should not crash
        let color2 = Color(hex: "3B82F6")
        let _ = color2
        let short = Color(hex: "#F00")
        let _ = short
    }

    // MARK: - Typography

    func testTypographyScaleExists() {
        let _ = Font.soraCaption      // 10pt
        let _ = Font.soraFootnote     // 11pt
        let _ = Font.soraBody         // 13pt
        let _ = Font.soraCallout      // 14pt
        let _ = Font.soraSubhead      // 15pt
        let _ = Font.soraHeadline     // 16pt
        let _ = Font.soraTitle3       // 18pt
        let _ = Font.soraTitle2       // 22pt
        let _ = Font.soraTitle1       // 28pt
        let _ = Font.soraLargeTitle   // 34pt
    }

    func testSoraFontWeightVariants() {
        let _ = Font.sora(16, weight: .regular)
        let _ = Font.sora(16, weight: .medium)
        let _ = Font.sora(16, weight: .semibold)
        let _ = Font.sora(16, weight: .bold)
    }

    // MARK: - Animations

    func testAnimationTokensExist() {
        let _ = Animation.optaSpring
        let _ = Animation.optaSnap
        let _ = Animation.optaGentle
        let _ = Animation.optaPulse
    }

    // MARK: - Motion Config

    func testMotionConfigFull() {
        let config = MotionConfig.full
        XCTAssertTrue(config.animationsEnabled)
        XCTAssertTrue(config.ambientEnabled)
        XCTAssertTrue(config.repeatingEnabled)
    }

    func testMotionConfigReduced() {
        let config = MotionConfig.reduced
        XCTAssertFalse(config.animationsEnabled)
        XCTAssertFalse(config.ambientEnabled)
        XCTAssertFalse(config.repeatingEnabled)
    }

    func testMotionConfigFromReduceMotion() {
        let full = MotionConfig.from(reduceMotion: false)
        XCTAssertTrue(full.animationsEnabled)
        let reduced = MotionConfig.from(reduceMotion: true)
        XCTAssertFalse(reduced.animationsEnabled)
    }

    // MARK: - FadeEdge

    func testFadeEdgeOptionSet() {
        let vertical: FadeEdge = .vertical
        XCTAssertTrue(vertical.contains(.top))
        XCTAssertTrue(vertical.contains(.bottom))
        XCTAssertFalse(vertical.contains(.leading))

        let all: FadeEdge = .all
        XCTAssertTrue(all.contains(.top))
        XCTAssertTrue(all.contains(.trailing))
    }
}
