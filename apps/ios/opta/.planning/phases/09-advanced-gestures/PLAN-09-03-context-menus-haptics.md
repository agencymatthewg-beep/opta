# Plan 09-03: Long-Press Context Menus & Haptic Coordination

## Overview

Enhance long-press context menus across the app and establish gesture-haptic coordination patterns.

## Scope

- **Files to modify:** `Views/HistoryView.swift`, `Views/ResultView.swift`, `Design/OptaHaptics.swift`, `Design/GestureModifiers.swift`
- **Complexity:** Medium
- **Dependencies:** Plan 09-01 complete

## Tasks

### Task 1: Enhanced Context Menu on HistoryCard

Upgrade existing contextMenu in `HistoryView.swift` (line 62):

**Current:**
```swift
.contextMenu {
    Button(role: .destructive) {
        // delete
    } label: {
        Label("Delete", systemImage: "trash")
    }
}
```

**Enhanced:**
```swift
.contextMenu {
    // Primary actions
    Button {
        toggleFavorite(scan)
    } label: {
        Label(
            scan.isFavorite ? "Unfavorite" : "Favorite",
            systemImage: scan.isFavorite ? "star.slash" : "star"
        )
    }

    Button {
        shareScan(scan)
    } label: {
        Label("Share", systemImage: "square.and.arrow.up")
    }

    Button {
        duplicateScan(scan)
    } label: {
        Label("Duplicate", systemImage: "doc.on.doc")
    }

    Divider()

    // Destructive
    Button(role: .destructive) {
        deleteScan(scan)
    } label: {
        Label("Delete", systemImage: "trash")
    }
} preview: {
    // Rich preview of the scan
    HistoryCardPreview(scan: scan)
}
```

**Acceptance Criteria:**
- [ ] Context menu has favorite, share, duplicate, delete options
- [ ] Preview shows rich card content
- [ ] Proper SF Symbols for each action
- [ ] Delete is in destructive section below divider
- [ ] Haptic on menu appear (built-in iOS behavior)

### Task 2: Context Menu on Result Cards

Add context menus to ResultView cards (`HighlightsCard`, `RankingsCard`, `AnalysisCard`):

```swift
// HighlightsCard
.contextMenu {
    Button {
        copyToClipboard(highlightText)
        OptaHaptics.shared.success()
    } label: {
        Label("Copy", systemImage: "doc.on.doc")
    }

    Button {
        shareHighlight(highlightText)
    } label: {
        Label("Share", systemImage: "square.and.arrow.up")
    }
}

// RankingsCard - per row
RankingRow(item: item, rank: index + 1)
    .contextMenu {
        Button {
            copyToClipboard(item.name)
        } label: {
            Label("Copy Name", systemImage: "doc.on.doc")
        }

        if let url = item.url {
            Button {
                openURL(url)
            } label: {
                Label("Open Link", systemImage: "link")
            }
        }
    }
```

**Acceptance Criteria:**
- [ ] HighlightsCard has copy/share context menu
- [ ] RankingRow has copy/open-link context menu
- [ ] AnalysisCard has copy context menu
- [ ] All copy actions trigger success haptic
- [ ] Share opens system share sheet

### Task 3: Gesture-Haptic Timing Coordination

Add gesture phase haptics to `Design/GestureModifiers.swift`:

```swift
// Add to SwipeActionsModifier
private func handleSwipePhase(_ phase: DragGesture.Value) {
    let progress = abs(phase.translation.width) / (actionWidth * CGFloat(trailingActions.count))

    // Threshold crossed - trigger haptic
    if progress >= triggerThreshold && !hasTriggeredHaptic {
        OptaHaptics.shared.selectionChanged()
        hasTriggeredHaptic = true
    }

    // Reset if pulled back
    if progress < triggerThreshold && hasTriggeredHaptic {
        hasTriggeredHaptic = false
    }
}

// On gesture end - action haptic
private func handleSwipeEnd(_ value: DragGesture.Value) {
    let progress = abs(value.translation.width) / (actionWidth * CGFloat(trailingActions.count))

    if progress >= triggerThreshold {
        if let action = trailingActions.first {
            if action.isDestructive {
                OptaHaptics.shared.warning()
            } else {
                OptaHaptics.shared.success()
            }
            action.action()
        }
    }
}
```

**Add new haptic method to OptaHaptics.swift:**

```swift
/// Gesture threshold crossed - subtle tick
func gestureTick() {
    let generator = UIImpactFeedbackGenerator(style: .rigid)
    generator.impactOccurred(intensity: 0.5)
}

/// Gesture committed - action will execute
func gestureCommit() {
    let generator = UIImpactFeedbackGenerator(style: .medium)
    generator.impactOccurred()
}
```

**Acceptance Criteria:**
- [ ] Swipe crossing threshold triggers tick haptic
- [ ] Pulling back resets haptic state
- [ ] Action execution triggers appropriate haptic
- [ ] Destructive actions use warning haptic
- [ ] Non-destructive actions use success haptic

### Task 4: Long-Press Gesture Extension

Add long-press gesture modifier to `GestureModifiers.swift`:

```swift
// MARK: - Long Press with Haptic

struct LongPressHapticModifier: ViewModifier {
    let minimumDuration: Double
    let onPressed: () -> Void

    @State private var isPressing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressing ? 0.97 : 1.0)
            .animation(.optaSpring, value: isPressing)
            .onLongPressGesture(
                minimumDuration: minimumDuration,
                pressing: { pressing in
                    isPressing = pressing
                    if pressing {
                        OptaHaptics.shared.tap()
                    }
                },
                perform: {
                    OptaHaptics.shared.buttonPress()
                    onPressed()
                }
            )
    }
}

extension View {
    func longPressWithHaptic(
        duration: Double = 0.5,
        action: @escaping () -> Void
    ) -> some View {
        modifier(LongPressHapticModifier(
            minimumDuration: duration,
            onPressed: action
        ))
    }
}
```

**Acceptance Criteria:**
- [ ] Long press modifier with haptic feedback
- [ ] Subtle scale animation during press
- [ ] Initial tap haptic when press begins
- [ ] Button press haptic when action triggers
- [ ] Duration configurable (default 0.5s)

### Task 5: Accessibility Considerations

Ensure all gestures have accessibility alternatives:

```swift
// HistoryCard
.accessibilityAction(named: "Delete") {
    deleteScan(scan)
}
.accessibilityAction(named: "Favorite") {
    toggleFavorite(scan)
}
.accessibilityAction(named: "Share") {
    shareScan(scan)
}

// ZoomableImageView
.accessibilityZoomAction { action in
    switch action.direction {
    case .zoomIn:
        scale = min(scale * 1.5, maxScale)
    case .zoomOut:
        scale = max(scale / 1.5, minScale)
    @unknown default:
        break
    }
}
```

**Acceptance Criteria:**
- [ ] Swipe actions available via accessibility actions
- [ ] Zoom available via accessibility zoom
- [ ] Context menu items have accessibility labels
- [ ] VoiceOver announces available gestures

## Verification

```bash
# Build succeeds
xcodebuild -scheme "Opta Scan" -destination "platform=iOS Simulator,name=iPhone 15 Pro" build

# Manual testing checklist:
# 1. Long-press history card - full context menu appears
# 2. Context menu has favorite, share, duplicate, delete
# 3. Long-press result cards - copy/share options
# 4. Swipe gesture triggers tick at threshold
# 5. Complete swipe triggers action haptic
# 6. Enable VoiceOver - all actions accessible
```

## Checkpoint

After completing all tasks:
- [ ] Enhanced context menus on HistoryCard
- [ ] Context menus on ResultView cards
- [ ] Gesture-haptic timing coordinated
- [ ] Long-press modifier with haptic feedback
- [ ] Accessibility actions for all gestures
- [ ] Build succeeds, no warnings
- [ ] Commit: "feat(phase-9): enhance context menus and gesture haptics"
