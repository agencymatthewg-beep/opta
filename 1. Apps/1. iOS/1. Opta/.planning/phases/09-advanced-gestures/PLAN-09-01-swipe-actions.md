# Plan 09-01: Swipe Actions on History Cards

## Overview

Add swipe gesture actions to HistoryCard components for delete, favorite, and share functionality.

## Scope

- **Files to modify:** `Views/HistoryView.swift`
- **Files to create:** `Design/GestureModifiers.swift`
- **Complexity:** Medium
- **Dependencies:** None (standalone)

## Tasks

### Task 1: Create Gesture Modifiers Foundation

Create `Opta Scan/Design/GestureModifiers.swift`:

```swift
import SwiftUI

// MARK: - Swipe Action Configuration

struct SwipeAction: Identifiable {
    let id = UUID()
    let icon: String
    let color: Color
    let isDestructive: Bool
    let action: () -> Void
}

// MARK: - Swipe Actions View Modifier

struct SwipeActionsModifier: ViewModifier {
    let leadingActions: [SwipeAction]
    let trailingActions: [SwipeAction]

    @State private var offset: CGFloat = 0
    @State private var isSwiping = false

    private let actionWidth: CGFloat = 80
    private let triggerThreshold: CGFloat = 0.6

    func body(content: Content) -> some View {
        // Implementation with DragGesture
        // Leading swipe reveals trailing actions (standard iOS pattern)
        // Trailing swipe reveals leading actions
    }
}

extension View {
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
```

**Acceptance Criteria:**
- [ ] GestureModifiers.swift created in Design folder
- [ ] SwipeAction struct defined with icon, color, destructive flag
- [ ] SwipeActionsModifier handles left/right swipe gestures
- [ ] Smooth spring animation on release
- [ ] Haptic feedback on action trigger

### Task 2: Implement Swipe-to-Delete

Modify `HistoryCard` in `Views/HistoryView.swift`:

```swift
// Replace simple Button wrapper with swipe-enabled card

HistoryCard(scan: scan, selectedScan: $selectedScan)
    .swipeActions(
        trailing: [
            SwipeAction(
                icon: "trash.fill",
                color: .optaRed,
                isDestructive: true,
                action: { deleteItem(scan) }
            )
        ]
    )
```

**Acceptance Criteria:**
- [ ] Swipe left reveals red delete action
- [ ] Full swipe triggers delete with haptic
- [ ] Partial swipe shows action button
- [ ] Delete confirmation matches existing contextMenu behavior
- [ ] Animation matches OptaAnimations.optaSpring

### Task 3: Add Favorite/Star Action

Add leading swipe action for favoriting:

```swift
.swipeActions(
    leading: [
        SwipeAction(
            icon: scan.isFavorite ? "star.fill" : "star",
            color: .optaAmber,
            isDestructive: false,
            action: { toggleFavorite(scan) }
        )
    ],
    trailing: [/* delete */]
)
```

**Requires Core Data update:**
- Add `isFavorite: Bool` attribute to ScanEntity (if not exists)
- Add `toggleFavorite(_:)` function

**Acceptance Criteria:**
- [ ] Swipe right reveals amber star action
- [ ] Star toggles between filled/outline based on state
- [ ] Favorite state persists to Core Data
- [ ] Success haptic on favorite toggle

### Task 4: Visual Polish & Edge Cases

**Visual enhancements:**
- Action icons use SF Symbols with `.symbolRenderingMode(.hierarchical)`
- Background color animates with swipe progress
- Card corner radius maintained during swipe
- Shadow adjusts during drag

**Edge cases:**
- Prevent simultaneous swipes on multiple cards
- Handle interrupted gestures gracefully
- Reset offset when card leaves view
- Accessibility: maintain VoiceOver support for actions

**Acceptance Criteria:**
- [ ] Only one card can be swiped at a time
- [ ] VoiceOver announces available actions
- [ ] Swipe gesture cancels cleanly on scroll
- [ ] Works correctly in both light/dark mode (glass effects)

## Verification

```bash
# Build succeeds
xcodebuild -scheme "Opta Scan" -destination "platform=iOS Simulator,name=iPhone 15 Pro" build

# Manual testing checklist:
# 1. Swipe left on history card - delete action appears
# 2. Full swipe left - triggers delete with warning haptic
# 3. Swipe right on history card - favorite action appears
# 4. Tap favorite - toggles star, success haptic
# 5. Try swiping two cards simultaneously - only one responds
# 6. Scroll while swiping - gesture cancels cleanly
```

## Checkpoint

After completing all tasks:
- [ ] GestureModifiers.swift exists with SwipeActionsModifier
- [ ] HistoryCard has working swipe-to-delete
- [ ] HistoryCard has working swipe-to-favorite
- [ ] All haptics coordinated (warning for delete, success for favorite)
- [ ] Build succeeds, no warnings
- [ ] Commit: "feat(phase-9): add swipe actions to history cards"
