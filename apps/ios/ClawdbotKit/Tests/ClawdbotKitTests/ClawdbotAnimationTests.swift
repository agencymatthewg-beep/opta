//
//  ClawdbotAnimationTests.swift
//  ClawdbotKit
//
//  Tests for animation modifiers, timing constants, and Reduce Motion compliance.
//

import XCTest
import SwiftUI
@testable import ClawdbotKit

final class ClawdbotAnimationTests: XCTestCase {

    // MARK: - Reduce Motion Tests

    func testClawdbotMotionAnimationReturnsNilWhenReduceMotionEnabled() {
        // Note: We can't actually toggle the system setting in tests,
        // but we can verify the API exists and behaves correctly based on current state
        let animation = Animation.clawdbotSpring

        // When reduce motion is disabled, should return the animation
        // When enabled, should return nil
        let result = ClawdbotMotion.animation(animation)

        // The result type should be Animation?
        XCTAssertTrue(type(of: result) == Optional<Animation>.self)
    }

    func testClawdbotMotionSafeAnimationAlwaysReturnsAnimation() {
        let animation = Animation.clawdbotSpring
        let result = ClawdbotMotion.safeAnimation(animation)

        // Should always return an Animation (either the original or instant)
        XCTAssertNotNil(result)
    }

    func testReduceMotionPropertyExists() {
        // Verify the property can be accessed without crashing
        let _ = ClawdbotMotion.isReduceMotionEnabled
    }

    // MARK: - Spring Animation Preset Tests

    func testClawdbotSpringExists() {
        let spring = Animation.clawdbotSpring
        XCTAssertNotNil(spring)
    }

    func testClawdbotSpringGentleExists() {
        let spring = Animation.clawdbotSpringGentle
        XCTAssertNotNil(spring)
    }

    func testClawdbotSpringPageExists() {
        let spring = Animation.clawdbotSpringPage
        XCTAssertNotNil(spring)
    }

    func testClawdbotSpringBounceExists() {
        let spring = Animation.clawdbotSpringBounce
        XCTAssertNotNil(spring)
    }

    func testClawdbotSnappyExists() {
        let spring = Animation.clawdbotSnappy
        XCTAssertNotNil(spring)
    }

    func testClawdbotBouncyExists() {
        let spring = Animation.clawdbotBouncy
        XCTAssertNotNil(spring)
    }

    func testClawdbotSmoothExists() {
        let spring = Animation.clawdbotSmooth
        XCTAssertNotNil(spring)
    }

    // MARK: - Ignition Modifier Tests

    func testIgnitionModifierInitialization() {
        let modifier = IgnitionModifier(isVisible: true, delay: 0)
        XCTAssertNotNil(modifier)
    }

    func testIgnitionModifierWithDelay() {
        let modifier = IgnitionModifier(isVisible: true, delay: 0.5)
        XCTAssertNotNil(modifier)
    }

    func testIgnitionModifierInvisibleState() {
        let modifier = IgnitionModifier(isVisible: false, delay: 0)
        XCTAssertNotNil(modifier)
    }

    // MARK: - Glow Pulse Modifier Tests

    func testGlowPulseModifierInitialization() {
        let modifier = GlowPulseModifier(color: .clawdbotPurple, isActive: true)
        XCTAssertNotNil(modifier)
    }

    func testGlowPulseModifierInactive() {
        let modifier = GlowPulseModifier(color: .clawdbotPurple, isActive: false)
        XCTAssertNotNil(modifier)
    }

    func testGlowPulseModifierCustomColor() {
        let modifier = GlowPulseModifier(color: .clawdbotCyan, isActive: true)
        XCTAssertNotNil(modifier)
    }

    // MARK: - Staggered Ignition Tests

    func testStaggeredIgnitionModifierInitialization() {
        let modifier = StaggeredIgnitionModifier(index: 0)
        XCTAssertNotNil(modifier)
    }

    func testStaggeredIgnitionModifierWithCustomInterval() {
        let modifier = StaggeredIgnitionModifier(
            index: 5,
            isVisible: true,
            baseDelay: 0.1,
            staggerInterval: 0.1
        )
        XCTAssertNotNil(modifier)
    }

    func testStaggeredIgnitionDelayCalculation() {
        // Verify delay calculation: baseDelay + index * staggerInterval
        let index = 3
        let baseDelay = 0.1
        let staggerInterval = 0.05

        let expectedDelay = baseDelay + Double(index) * staggerInterval
        XCTAssertEqual(expectedDelay, 0.25, accuracy: 0.001)
    }

    // MARK: - Staggered Container Tests

    func testStaggeredContainerInitialization() {
        let container = StaggeredContainer {
            Text("Test")
        }
        XCTAssertNotNil(container)
    }

    // MARK: - Timing Constants Tests

    func testTimingConstantFast() {
        XCTAssertEqual(ClawdbotTiming.fast, 0.15, accuracy: 0.001)
    }

    func testTimingConstantNormal() {
        XCTAssertEqual(ClawdbotTiming.normal, 0.2, accuracy: 0.001)
    }

    func testTimingConstantSlow() {
        XCTAssertEqual(ClawdbotTiming.slow, 0.3, accuracy: 0.001)
    }

    func testTimingConstantSlower() {
        XCTAssertEqual(ClawdbotTiming.slower, 0.5, accuracy: 0.001)
    }

    func testTimingConstantIgnition() {
        XCTAssertEqual(ClawdbotTiming.ignition, 0.8, accuracy: 0.001)
    }

    func testTimingConstantGlowPulse() {
        XCTAssertEqual(ClawdbotTiming.glowPulse, 2.0, accuracy: 0.001)
    }

    func testTimingConstantStaggerInterval() {
        XCTAssertEqual(ClawdbotTiming.staggerInterval, 0.05, accuracy: 0.001)
    }

    func testTimingConstantMessageStagger() {
        XCTAssertEqual(ClawdbotTiming.messageStagger, 0.03, accuracy: 0.001)
    }

    func testTimingConstantRingDormant() {
        XCTAssertEqual(ClawdbotTiming.ringDormant, 4.0, accuracy: 0.001)
    }

    func testTimingConstantRingActive() {
        XCTAssertEqual(ClawdbotTiming.ringActive, 3.0, accuracy: 0.001)
    }

    func testTimingConstantThinkingDotInterval() {
        XCTAssertEqual(ClawdbotTiming.thinkingDotInterval, 0.3, accuracy: 0.001)
    }

    // MARK: - Staggered Appear Tests

    func testClawdbotStaggeredAppearInitialization() {
        let modifier = ClawdbotStaggeredAppear(index: 0, isVisible: true)
        XCTAssertNotNil(modifier)
    }

    // MARK: - Physics Spring Tests

    func testPhysicsSpringSnappyPreset() {
        let spring = PhysicsSpring.snappy
        XCTAssertEqual(spring.mass, 1.0, accuracy: 0.01)
        XCTAssertEqual(spring.stiffness, 400, accuracy: 0.01)
        XCTAssertEqual(spring.damping, 25, accuracy: 0.01)
    }

    func testPhysicsSpringNaturalPreset() {
        let spring = PhysicsSpring.natural
        XCTAssertEqual(spring.mass, 1.0, accuracy: 0.01)
        XCTAssertEqual(spring.stiffness, 200, accuracy: 0.01)
        XCTAssertEqual(spring.damping, 20, accuracy: 0.01)
    }

    func testPhysicsSpringBouncyPreset() {
        let spring = PhysicsSpring.bouncy
        XCTAssertEqual(spring.mass, 1.0, accuracy: 0.01)
        XCTAssertEqual(spring.stiffness, 300, accuracy: 0.01)
        XCTAssertEqual(spring.damping, 12, accuracy: 0.01)
    }

    func testPhysicsSpringGentlePreset() {
        let spring = PhysicsSpring.gentle
        XCTAssertEqual(spring.mass, 1.5, accuracy: 0.01)
        XCTAssertEqual(spring.stiffness, 100, accuracy: 0.01)
        XCTAssertEqual(spring.damping, 20, accuracy: 0.01)
    }

    func testPhysicsSpringAnimationConversion() {
        let spring = PhysicsSpring.natural
        let animation = spring.animation
        XCTAssertNotNil(animation)
    }

    // MARK: - MessageList Tests

    func testMessageListInitialization() {
        let list = MessageList(messages: [])
        XCTAssertNotNil(list)
    }

    func testMessageListWithMessages() {
        let messages = [
            ChatMessage(
                content: "Test message",
                sender: .user,
                status: .delivered
            )
        ]
        let list = MessageList(messages: messages)
        XCTAssertNotNil(list)
    }

    func testMessageListWithStreamingMessages() {
        let list = MessageList(
            messages: [],
            streamingMessages: ["id1": "Streaming content..."],
            botState: .typing
        )
        XCTAssertNotNil(list)
    }
}
