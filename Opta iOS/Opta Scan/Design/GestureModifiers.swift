//
//  GestureModifiers.swift
//  Opta Scan
//
//  Swipe gesture actions for list cards with haptic feedback
//  Part of Phase 9: Advanced Gestures
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Swipe Action Configuration

/// Represents a single action triggered by swiping
struct SwipeAction: Identifiable {
    let id = UUID()
    let icon: String
    let color: Color
    let isDestructive: Bool
    let action: () -> Void

    init(icon: String, color: Color, isDestructive: Bool = false, action: @escaping () -> Void) {
        self.icon = icon
        self.color = color
        self.isDestructive = isDestructive
        self.action = action
    }
}

// MARK: - Swipe State Manager

/// Manages global swipe state to ensure only one card can be swiped at a time
final class SwipeStateManager: ObservableObject {
    static let shared = SwipeStateManager()

    @Published var activeSwipeID: UUID?

    private init() {}

    func beginSwipe(id: UUID) {
        if activeSwipeID != id {
            activeSwipeID = id
        }
    }

    func endSwipe(id: UUID) {
        if activeSwipeID == id {
            activeSwipeID = nil
        }
    }

    func canSwipe(id: UUID) -> Bool {
        activeSwipeID == nil || activeSwipeID == id
    }
}

// MARK: - Swipe Actions View Modifier

/// ViewModifier that adds swipe gesture actions to any view
struct SwipeActionsModifier: ViewModifier {

    // MARK: - Properties

    let leadingActions: [SwipeAction]
    let trailingActions: [SwipeAction]

    // MARK: - State

    @State private var offset: CGFloat = 0
    @State private var isDragging = false
    @State private var cardID = UUID()
    @State private var hasTriggeredThresholdHaptic = false

    @ObservedObject private var swipeState = SwipeStateManager.shared

    // MARK: - Constants

    private enum Layout {
        static let actionWidth: CGFloat = 72
        static let triggerThreshold: CGFloat = 0.6
        static let revealThreshold: CGFloat = 0.4
        static let iconSize: CGFloat = 22
        static let cornerRadius: CGFloat = 16
    }

    // MARK: - Computed Properties

    /// Maximum offset for leading actions (swipe right reveals leading)
    private var maxLeadingOffset: CGFloat {
        CGFloat(leadingActions.count) * Layout.actionWidth
    }

    /// Maximum offset for trailing actions (swipe left reveals trailing)
    private var maxTrailingOffset: CGFloat {
        -CGFloat(trailingActions.count) * Layout.actionWidth
    }

    /// Whether full swipe triggers action automatically
    private var shouldTriggerLeadingAction: Bool {
        offset > maxLeadingOffset * Layout.triggerThreshold && !leadingActions.isEmpty
    }

    private var shouldTriggerTrailingAction: Bool {
        offset < maxTrailingOffset * Layout.triggerThreshold && !trailingActions.isEmpty
    }

    /// Progress of the swipe from 0 to 1
    private var swipeProgress: CGFloat {
        if offset > 0 {
            return min(1, offset / maxLeadingOffset)
        } else if offset < 0 {
            return min(1, abs(offset) / abs(maxTrailingOffset))
        }
        return 0
    }

    /// Shadow opacity based on swipe state
    private var shadowOpacity: Double {
        isDragging ? 0.4 : 0.3
    }

    // MARK: - Body

    func body(content: Content) -> some View {
        GeometryReader { geometry in
            ZStack {
                // Action backgrounds
                HStack(spacing: 0) {
                    // Leading actions (revealed on swipe right)
                    if !leadingActions.isEmpty {
                        leadingActionsView
                    }

                    Spacer()

                    // Trailing actions (revealed on swipe left)
                    if !trailingActions.isEmpty {
                        trailingActionsView
                    }
                }

                // Main content
                content
                    .offset(x: offset)
                    .gesture(swipeGesture)
                    .onTapGesture {
                        // If swiped open, tap resets; otherwise let tap pass through
                        if offset != 0 {
                            withAnimation(.optaSpring) {
                                offset = 0
                                swipeState.endSwipe(id: cardID)
                            }
                        }
                    }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityActions {
            // Add accessibility actions for VoiceOver
            ForEach(leadingActions) { action in
                Button(action.icon) {
                    action.action()
                }
            }
            ForEach(trailingActions) { action in
                Button(action.icon) {
                    action.action()
                }
            }
        }
        .onDisappear {
            // Reset offset when card leaves view
            resetSwipeState()
        }
        .onChange(of: swipeState.activeSwipeID) { _, newValue in
            // Reset if another card became active
            if newValue != nil && newValue != cardID && offset != 0 {
                withAnimation(.optaSpring) {
                    offset = 0
                }
            }
        }
    }

    // MARK: - Helper Methods

    /// Reset the swipe state to initial values
    private func resetSwipeState() {
        if offset != 0 {
            withAnimation(.optaSpring) {
                offset = 0
            }
            swipeState.endSwipe(id: cardID)
        }
        isDragging = false
    }

    // MARK: - Action Views

    private var leadingActionsView: some View {
        HStack(spacing: 0) {
            ForEach(leadingActions) { action in
                actionButton(action: action, isLeading: true)
            }
        }
        .frame(width: maxLeadingOffset)
        .clipShape(
            RoundedRectangle(cornerRadius: Layout.cornerRadius, style: .continuous)
        )
        .opacity(offset > 0 ? min(1.0, offset / 20.0) : 0)
    }

    private var trailingActionsView: some View {
        HStack(spacing: 0) {
            ForEach(trailingActions) { action in
                actionButton(action: action, isLeading: false)
            }
        }
        .frame(width: -maxTrailingOffset)
        .clipShape(
            RoundedRectangle(cornerRadius: Layout.cornerRadius, style: .continuous)
        )
        .opacity(offset < 0 ? min(1.0, abs(offset) / 20.0) : 0)
    }

    private func actionButton(action: SwipeAction, isLeading: Bool) -> some View {
        Button {
            triggerAction(action)
        } label: {
            ZStack {
                // Background with animated opacity based on swipe progress
                action.color
                    .opacity(0.9 + swipeProgress * 0.1)

                // Icon with scale animation
                Image(systemName: action.icon)
                    .font(.system(size: Layout.iconSize, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
                    .scaleEffect(0.8 + swipeProgress * 0.2)
                    .animation(.optaSpring, value: swipeProgress)
            }
        }
        .frame(width: Layout.actionWidth)
        .accessibilityLabel(action.isDestructive ? "Delete" : "Toggle favorite")
        .accessibilityHint(action.isDestructive ? "Double tap to delete this scan" : "Double tap to toggle favorite")
    }

    // MARK: - Gesture

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                guard swipeState.canSwipe(id: cardID) else { return }

                if !isDragging {
                    isDragging = true
                    swipeState.beginSwipe(id: cardID)
                    hasTriggeredThresholdHaptic = false
                }

                let translation = value.translation.width

                // Apply resistance at edges
                if leadingActions.isEmpty && translation > 0 {
                    offset = translation * 0.2
                } else if trailingActions.isEmpty && translation < 0 {
                    offset = translation * 0.2
                } else if translation > maxLeadingOffset {
                    // Rubber band effect past max
                    let excess = translation - maxLeadingOffset
                    offset = maxLeadingOffset + excess * 0.3
                } else if translation < maxTrailingOffset {
                    let excess = translation - maxTrailingOffset
                    offset = maxTrailingOffset + excess * 0.3
                } else {
                    offset = translation
                }

                // Check threshold crossing for haptic feedback
                handleSwipeThresholdHaptic()
            }
            .onEnded { value in
                isDragging = false
                hasTriggeredThresholdHaptic = false

                // Check for full swipe trigger
                if shouldTriggerLeadingAction, let action = leadingActions.first {
                    triggerAction(action)
                    return
                }

                if shouldTriggerTrailingAction, let action = trailingActions.first {
                    triggerAction(action)
                    return
                }

                // Snap to reveal position or reset
                let shouldRevealLeading = offset > maxLeadingOffset * Layout.revealThreshold
                let shouldRevealTrailing = offset < maxTrailingOffset * Layout.revealThreshold

                withAnimation(.optaSpring) {
                    if shouldRevealLeading && !leadingActions.isEmpty {
                        offset = maxLeadingOffset
                    } else if shouldRevealTrailing && !trailingActions.isEmpty {
                        offset = maxTrailingOffset
                    } else {
                        offset = 0
                        swipeState.endSwipe(id: cardID)
                    }
                }
            }
    }

    /// Handle haptic feedback when swipe crosses trigger threshold
    private func handleSwipeThresholdHaptic() {
        let isPastLeadingThreshold = offset > maxLeadingOffset * Layout.triggerThreshold && !leadingActions.isEmpty
        let isPastTrailingThreshold = offset < maxTrailingOffset * Layout.triggerThreshold && !trailingActions.isEmpty

        // Trigger haptic when crossing threshold
        if (isPastLeadingThreshold || isPastTrailingThreshold) && !hasTriggeredThresholdHaptic {
            OptaHaptics.shared.gestureTick()
            hasTriggeredThresholdHaptic = true
        }

        // Reset if user pulls back below threshold
        if !isPastLeadingThreshold && !isPastTrailingThreshold && hasTriggeredThresholdHaptic {
            hasTriggeredThresholdHaptic = false
        }
    }

    // MARK: - Actions

    private func triggerAction(_ action: SwipeAction) {
        // Commit haptic followed by outcome haptic
        OptaHaptics.shared.gestureCommit()

        // Additional semantic haptic based on action type
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            if action.isDestructive {
                OptaHaptics.shared.warning()
            } else {
                OptaHaptics.shared.success()
            }
        }

        // Reset offset with animation
        withAnimation(.optaSpring) {
            offset = 0
        }

        swipeState.endSwipe(id: cardID)
        hasTriggeredThresholdHaptic = false

        // Execute action
        action.action()
    }
}

// MARK: - View Extension

extension View {
    /// Add swipe actions to a view
    /// - Parameters:
    ///   - leading: Actions revealed when swiping right (e.g., favorite)
    ///   - trailing: Actions revealed when swiping left (e.g., delete)
    func swipeActions(
        leading: [SwipeAction] = [],
        trailing: [SwipeAction] = []
    ) -> some View {
        modifier(SwipeActionsModifier(
            leadingActions: leading,
            trailingActions: trailing
        ))
    }
}

// MARK: - Usage Reference
/*
 HistoryCard(scan: scan)
     .swipeActions(
         leading: [
             SwipeAction(
                 icon: "star.fill",
                 color: .optaAmber,
                 action: { toggleFavorite(scan) }
             )
         ],
         trailing: [
             SwipeAction(
                 icon: "trash.fill",
                 color: .optaRed,
                 isDestructive: true,
                 action: { deleteScan(scan) }
             )
         ]
     )
 */
