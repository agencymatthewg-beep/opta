# Plan 09-02: Pinch-to-Zoom on Images

## Overview

Add pinch-to-zoom and double-tap-to-zoom gestures on result images and history detail images.

## Scope

- **Files to modify:** `Views/HistoryView.swift`, `Views/ResultView.swift`
- **Files to create:** `Views/Components/ZoomableImageView.swift`
- **Complexity:** Medium
- **Dependencies:** Plan 09-01 (GestureModifiers.swift exists)

## Tasks

### Task 1: Create ZoomableImageView Component

Create `Opta Scan/Views/Components/ZoomableImageView.swift`:

```swift
import SwiftUI

struct ZoomableImageView: View {
    let image: UIImage

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private let minScale: CGFloat = 1.0
    private let maxScale: CGFloat = 4.0

    var body: some View {
        GeometryReader { geometry in
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .scaleEffect(scale)
                .offset(offset)
                .gesture(pinchGesture)
                .gesture(doubleTapGesture(in: geometry))
                .gesture(dragGesture)
        }
    }

    private var pinchGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let delta = value / lastScale
                lastScale = value
                scale = min(max(scale * delta, minScale), maxScale)
            }
            .onEnded { _ in
                lastScale = 1.0
                withAnimation(.optaSpring) {
                    if scale < minScale { scale = minScale }
                    if scale > maxScale { scale = maxScale }
                }
            }
    }

    private func doubleTapGesture(in geometry: GeometryProxy) -> some Gesture {
        TapGesture(count: 2)
            .onEnded {
                OptaHaptics.shared.doubleTap()
                withAnimation(.optaSpring) {
                    if scale > 1.0 {
                        scale = 1.0
                        offset = .zero
                    } else {
                        scale = 2.5
                    }
                }
            }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard scale > 1.0 else { return }
                offset = CGSize(
                    width: lastOffset.width + value.translation.width,
                    height: lastOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                lastOffset = offset
                // Clamp offset to image bounds
            }
    }
}
```

**Acceptance Criteria:**
- [ ] ZoomableImageView component created
- [ ] Pinch gesture zooms smoothly between 1x-4x
- [ ] Double-tap toggles between 1x and 2.5x
- [ ] Pan gesture works when zoomed in
- [ ] Rubber-band effect at min/max zoom
- [ ] Haptic on double-tap zoom

### Task 2: Integrate in HistoryDetailView

Modify `HistoryDetailView` in `Views/HistoryView.swift` (around line 233-239):

**Current:**
```swift
if let imageData = scan.imageData,
   let uiImage = UIImage(data: imageData) {
    Image(uiImage: uiImage)
        .resizable()
        .scaledToFit()
        .cornerRadius(OptaDesign.Radius.lg)
}
```

**Updated:**
```swift
if let imageData = scan.imageData,
   let uiImage = UIImage(data: imageData) {
    ZoomableImageView(image: uiImage)
        .cornerRadius(OptaDesign.Radius.lg)
        .frame(maxHeight: 300)
}
```

**Acceptance Criteria:**
- [ ] History detail images support pinch-to-zoom
- [ ] Corner radius maintained during zoom
- [ ] Frame constraints respected
- [ ] Smooth reset when sheet dismisses

### Task 3: Integrate in ResultView

Modify `ResultView` image displays (around lines 44-56):

Add zoom capability to result images where applicable. Since ResultView shows multiple images/cards, may need conditional application:

```swift
// For primary result image (if exists)
ZoomableImageView(image: resultImage)
    .glassContent()
    .frame(height: 200)
```

**Acceptance Criteria:**
- [ ] Result view images support pinch-to-zoom where appropriate
- [ ] Glass effects maintained
- [ ] Doesn't interfere with scroll behavior

### Task 4: Gesture Conflict Resolution

Handle gesture conflicts:

```swift
// In ZoomableImageView
.simultaneousGesture(pinchGesture)
.highPriorityGesture(dragGesture.map { _ in }.exclusively(before: /* scroll */))
```

**Key considerations:**
- Pinch should take priority over scroll
- Pan should only work when zoomed (scale > 1)
- Single tap should still work for dismissing
- Scroll container should still work at 1x zoom

**Acceptance Criteria:**
- [ ] Scrollview scrolls normally at 1x zoom
- [ ] Pinch takes priority and begins zoom
- [ ] Pan only active when zoomed
- [ ] No accidental zoom during normal scrolling

## Verification

```bash
# Build succeeds
xcodebuild -scheme "Opta Scan" -destination "platform=iOS Simulator,name=iPhone 15 Pro" build

# Manual testing checklist:
# 1. Open history detail with image
# 2. Pinch to zoom - smooth 1x to 4x
# 3. Double-tap - toggles zoom with haptic
# 4. Pan while zoomed - image moves
# 5. Release at >4x - rubber bands back to 4x
# 6. Double-tap again - resets to 1x
# 7. Scroll works normally at 1x
```

## Checkpoint

After completing all tasks:
- [ ] ZoomableImageView.swift exists in Components
- [ ] HistoryDetailView uses ZoomableImageView
- [ ] ResultView uses ZoomableImageView where appropriate
- [ ] Gesture conflicts resolved (scroll vs zoom)
- [ ] Haptics integrated (double-tap)
- [ ] Build succeeds, no warnings
- [ ] Commit: "feat(phase-9): add pinch-to-zoom on images"
