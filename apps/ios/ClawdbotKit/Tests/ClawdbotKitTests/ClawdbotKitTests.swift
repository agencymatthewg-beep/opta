//
//  ClawdbotKitTests.swift
//  ClawdbotKit
//
//  Tests for ClawdbotKit shared package
//

import XCTest
@testable import ClawdbotKit

final class ClawdbotKitTests: XCTestCase {
    func testVersion() {
        XCTAssertEqual(ClawdbotKit.version, "0.1.0")
    }

    func testPackageName() {
        XCTAssertEqual(ClawdbotKit.name, "ClawdbotKit")
    }

    func testPlatformsDescription() {
        XCTAssertEqual(ClawdbotKit.platforms, "iOS 17+, macOS 14+")
    }
}
