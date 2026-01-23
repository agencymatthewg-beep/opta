//
//  CharacterAnimator.swift
//  OptaApp
//
//  Character-by-character text animation system for dramatic text reveals.
//  Provides staggered entrance animations with opacity, position, brightness, and blur effects.
//

import SwiftUI

// MARK: - AnimatableCharacter

/// Represents a single character with animatable properties.
///
/// Each character tracks its own animation state for:
/// - Opacity: 0.0 (invisible) to 1.0 (fully visible)
/// - OffsetY: Starting offset (negative) to 0 (final position)
/// - Brightness: Starting dim to 1.0 (full brightness)
/// - Blur: Starting blur to 0 (sharp)
struct AnimatableCharacter: Identifiable {
    /// Unique identifier for SwiftUI ForEach
    let id = UUID()

    /// The character being animated
    let character: Character

    /// Position in the string (0-indexed)
    let index: Int

    /// Current opacity (0.0-1.0)
    var opacity: Double

    /// Current vertical offset (starts negative, animates to 0)
    var offsetY: Double

    /// Current brightness multiplier (0.5-1.0)
    var brightness: Double

    /// Current blur radius (4.0-0.0)
    var blur: Double

    /// Creates a character in its initial hidden state
    /// - Parameters:
    ///   - character: The character to animate
    ///   - index: Position in the string
    init(character: Character, index: Int) {
        self.character = character
        self.index = index
        // Initial hidden state
        self.opacity = 0.0
        self.offsetY = -10.0
        self.brightness = 0.5
        self.blur = 4.0
    }

    /// Resets the character to its initial hidden state
    mutating func reset() {
        opacity = 0.0
        offsetY = -10.0
        brightness = 0.5
        blur = 4.0
    }

    /// Animates the character to its final visible state
    mutating func reveal() {
        opacity = 1.0
        offsetY = 0.0
        brightness = 1.0
        blur = 0.0
    }
}

// MARK: - SpringConfiguration

/// Preset spring configurations for character animations
enum SpringConfiguration {
    /// Smooth spring: balanced response with moderate damping
    case smooth
    /// Snappy spring: quick response with higher damping
    case snappy
    /// Gentle spring: slower response with lower damping
    case gentle

    /// SwiftUI Animation value for this configuration
    var animation: Animation {
        switch self {
        case .smooth:
            return .spring(response: 0.5, dampingFraction: 0.7)
        case .snappy:
            return .spring(response: 0.3, dampingFraction: 0.8)
        case .gentle:
            return .spring(response: 0.6, dampingFraction: 0.6)
        }
    }
}

// MARK: - CharacterAnimator

/// Observable object that manages character-by-character text animation.
///
/// Handles the timing and coordination of staggered character reveals.
/// Each character animates independently with a configurable delay between them.
///
/// # Usage
///
/// ```swift
/// @StateObject private var animator = CharacterAnimator(text: "OPTA")
///
/// // In body:
/// HStack(spacing: 0) {
///     ForEach(animator.characters) { char in
///         CharacterView(character: char)
///     }
/// }
/// .onAppear { animator.animate() }
/// ```
@Observable
final class CharacterAnimator {

    // MARK: - Properties

    /// The animatable characters
    private(set) var characters: [AnimatableCharacter]

    /// The original text string
    private let text: String

    /// Delay between character animations in seconds
    private let staggerDelay: Double

    /// Spring configuration for animations
    private let springConfig: SpringConfiguration

    /// Whether animation is currently in progress
    private(set) var isAnimating: Bool = false

    /// Work items for pending animations (for cancellation)
    private var pendingAnimations: [DispatchWorkItem] = []

    // MARK: - Initialization

    /// Creates a new character animator for the given text.
    /// - Parameters:
    ///   - text: The text to animate character-by-character
    ///   - staggerDelay: Delay between each character's animation (default: 40ms)
    ///   - springConfig: Spring configuration for the animation (default: smooth)
    init(
        text: String,
        staggerDelay: Double = OptaTextStyle.staggerDelay,
        springConfig: SpringConfiguration = .smooth
    ) {
        self.text = text
        self.staggerDelay = staggerDelay
        self.springConfig = springConfig

        // Create animatable characters for each character in the string
        self.characters = text.enumerated().map { index, char in
            AnimatableCharacter(character: char, index: index)
        }
    }

    // MARK: - Public Methods

    /// Triggers the staggered reveal animation for all characters.
    ///
    /// Each character will animate in sequence with the configured stagger delay.
    /// Calling animate() while already animating will be ignored.
    func animate() {
        guard !isAnimating, !characters.isEmpty else { return }

        isAnimating = true
        cancelPendingAnimations()

        // Schedule each character's animation with staggered delays
        for index in characters.indices {
            let delay = staggerDelay * Double(index)

            let workItem = DispatchWorkItem { [weak self] in
                guard let self = self else { return }

                withAnimation(self.springConfig.animation) {
                    self.characters[index].reveal()
                }

                // Check if this is the last character
                if index == self.characters.count - 1 {
                    // Allow a bit of time for the animation to complete
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                        self?.isAnimating = false
                    }
                }
            }

            pendingAnimations.append(workItem)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
        }
    }

    /// Resets all characters to their initial hidden state.
    ///
    /// This can be used to prepare for re-animation.
    func reset() {
        cancelPendingAnimations()
        isAnimating = false

        // Reset without animation for immediate effect
        for index in characters.indices {
            characters[index].reset()
        }
    }

    /// Updates the text and resets for new animation.
    /// - Parameter newText: The new text to animate
    func updateText(_ newText: String) {
        cancelPendingAnimations()
        isAnimating = false

        // Recreate characters for new text
        characters = newText.enumerated().map { index, char in
            AnimatableCharacter(character: char, index: index)
        }
    }

    // MARK: - Private Methods

    private func cancelPendingAnimations() {
        pendingAnimations.forEach { $0.cancel() }
        pendingAnimations.removeAll()
    }
}

// MARK: - AnimatedTextView

/// A SwiftUI view that displays text with character-by-character animation.
///
/// The view automatically triggers the animation when it appears.
/// Each character is rendered individually with its own transforms.
///
/// # Usage
///
/// ```swift
/// AnimatedTextView(text: "OPTA", style: OptaTextStyle.hero)
///     .foregroundStyle(OptaTextStyle.activeViolet)
///     .textGlow(color: OptaTextStyle.glowPurple, intensity: 0.8)
/// ```
struct AnimatedTextView: View {

    // MARK: - Properties

    /// The text to animate
    let text: String

    /// Font style for the text
    var style: Font = OptaTextStyle.hero

    /// Foreground color
    var color: Color = .white

    /// Glow color (optional)
    var glowColor: Color? = nil

    /// Glow intensity (0.0-1.0)
    var glowIntensity: Double = 0.5

    /// Spring configuration for animations
    var springConfig: SpringConfiguration = .smooth

    /// Whether to auto-animate on appear
    var autoAnimate: Bool = true

    /// The character animator (created internally)
    @State private var animator: CharacterAnimator?

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Body

    var body: some View {
        HStack(spacing: 0) {
            if let animator = animator {
                ForEach(animator.characters) { character in
                    characterView(for: character)
                }
            }
        }
        .onAppear {
            setupAnimator()
            if autoAnimate && !reduceMotion {
                // Small delay to ensure view is laid out
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    animator?.animate()
                }
            } else if reduceMotion {
                // Show text immediately without animation
                showImmediately()
            }
        }
        .onChange(of: text) { _, newText in
            animator?.updateText(newText)
            if autoAnimate && !reduceMotion {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    animator?.animate()
                }
            } else if reduceMotion {
                showImmediately()
            }
        }
    }

    // MARK: - Private Views

    @ViewBuilder
    private func characterView(for character: AnimatableCharacter) -> some View {
        let charText = Text(String(character.character))
            .font(style)
            .foregroundStyle(color)
            .opacity(character.opacity)
            .offset(y: character.offsetY)
            .brightness(character.brightness - 1.0) // brightness modifier is additive, so -1.0 to 0.0
            .blur(radius: character.blur)

        if let glow = glowColor {
            charText
                .textGlow(color: glow, intensity: glowIntensity * character.opacity)
        } else {
            charText
        }
    }

    // MARK: - Private Methods

    private func setupAnimator() {
        animator = CharacterAnimator(
            text: text,
            staggerDelay: OptaTextStyle.staggerDelay,
            springConfig: springConfig
        )
    }

    private func showImmediately() {
        guard let animator = animator else { return }
        for index in animator.characters.indices {
            animator.characters[index].reveal()
        }
    }
}

// MARK: - Convenience Initializers

extension AnimatedTextView {
    /// Creates an animated text view with glow effect.
    /// - Parameters:
    ///   - text: The text to animate
    ///   - style: Font style
    ///   - color: Text color
    ///   - glowColor: Glow color
    ///   - glowIntensity: Glow intensity (0.0-1.0)
    init(
        text: String,
        style: Font,
        color: Color,
        glowColor: Color,
        glowIntensity: Double = 0.5
    ) {
        self.text = text
        self.style = style
        self.color = color
        self.glowColor = glowColor
        self.glowIntensity = glowIntensity
    }
}

// MARK: - Preview

#if DEBUG
struct CharacterAnimator_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 48) {
            // Hero text with glow
            AnimatedTextView(
                text: "OPTA",
                style: OptaTextStyle.hero,
                color: OptaTextStyle.activeViolet,
                glowColor: OptaTextStyle.glowPurple,
                glowIntensity: 0.8
            )

            // Title text
            AnimatedTextView(
                text: "System Optimized",
                style: OptaTextStyle.title,
                color: .white
            )

            // Body text with state color
            AnimatedTextView(
                text: "All processes running smoothly",
                style: OptaTextStyle.body,
                color: OptaTextStyle.glowGreen,
                glowColor: OptaTextStyle.glowGreen,
                glowIntensity: 0.4
            )

            // Different spring configurations
            VStack(spacing: 16) {
                AnimatedTextView(text: "Smooth Spring", springConfig: .smooth)
                    .foregroundStyle(.white)

                AnimatedTextView(text: "Snappy Spring", springConfig: .snappy)
                    .foregroundStyle(.white)

                AnimatedTextView(text: "Gentle Spring", springConfig: .gentle)
                    .foregroundStyle(.white)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }
}
#endif
