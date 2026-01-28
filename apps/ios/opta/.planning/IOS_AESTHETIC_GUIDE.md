# Opta Scan iOS Aesthetic Guide

*SwiftUI implementation guide for premium aesthetics, synced with Opta MacOS design system*

---

## Design Philosophy

Opta Scan shares the same visual DNA as Opta MacOS: an **obsidian aesthetic** with intelligent energy states. The app feels like a polished artifact—dark, refined, and purposeful.

### Core Principles

1. **Obsidian Foundation** — Deep blacks with subtle warmth, never sterile
2. **Energy States** — UI responds to activity (0% dormant → 50% active → 100% processing)
3. **Glass Depth** — Layered transparency creates spatial hierarchy
4. **Spring Physics** — All motion uses spring dynamics, never duration-based
5. **Purposeful Neon** — Color accents only for active/important states

---

## Color System

### Base Colors (OLED Optimized)

```swift
extension Color {
    // CRITICAL: Use #09090b, NOT #000000
    // True black causes OLED smear on scroll
    static let optaBackground = Color(hex: "09090b")

    // Surface hierarchy (darkest to lightest)
    static let optaSurface = Color(hex: "18181b")       // Cards, containers
    static let optaSurfaceElevated = Color(hex: "27272a") // Elevated elements
    static let optaBorder = Color(hex: "3f3f46")        // Subtle borders

    // Text hierarchy
    static let optaTextPrimary = Color(hex: "fafafa")   // Primary content
    static let optaTextSecondary = Color(hex: "a1a1aa") // Secondary content
    static let optaTextMuted = Color(hex: "52525b")     // Disabled/hints
}
```

### Neon Accent Colors

```swift
extension Color {
    // Primary brand
    static let optaPurple = Color(hex: "8b5cf6")
    static let optaPurpleGlow = Color(hex: "a855f7")

    // Semantic accents
    static let optaBlue = Color(hex: "3b82f6")      // Information, links
    static let optaGreen = Color(hex: "22c55e")     // Success, positive
    static let optaAmber = Color(hex: "f59e0b")     // Warning, attention
    static let optaRed = Color(hex: "ef4444")       // Error, destructive

    // Gradients (use for text/icons, not backgrounds)
    static let optaMoonlight = LinearGradient(
        colors: [Color(hex: "a855f7"), Color(hex: "8b5cf6"), Color(hex: "6366f1")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
```

### Usage Rules

| Element | Color | Notes |
|---------|-------|-------|
| App background | `optaBackground` | Always #09090b |
| Cards/containers | `optaSurface` | With glass blur |
| Active states | `optaPurple` | Buttons, selections |
| Processing/loading | `optaPurpleGlow` | Animated glow |
| Success results | `optaGreen` | Completion states |
| Inactive | `optaTextMuted` | Never pure gray |

---

## Glass Depth System

Three distinct levels of glass create spatial hierarchy:

### Level 1: Subtle (Background Elements)

```swift
struct GlassSubtle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .background(Color.optaSurface.opacity(0.3))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
            .cornerRadius(12)
    }
}
```

### Level 2: Content (Cards, Sheets)

```swift
struct GlassContent: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.thinMaterial)
            .background(Color.optaSurface.opacity(0.5))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.1), Color.white.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.3), radius: 20, y: 10)
    }
}
```

### Level 3: Overlay (Modals, Popovers)

```swift
struct GlassOverlay: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.regularMaterial)
            .background(Color.optaSurface.opacity(0.7))
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(Color.optaPurple.opacity(0.15), lineWidth: 1)
            )
            .cornerRadius(24)
            .shadow(color: .black.opacity(0.5), radius: 40, y: 20)
    }
}

// View extension for easy use
extension View {
    func glassSubtle() -> some View { modifier(GlassSubtle()) }
    func glassContent() -> some View { modifier(GlassContent()) }
    func glassOverlay() -> some View { modifier(GlassOverlay()) }
}
```

---

## Animation System

### Spring Presets (Physics-Based)

**CRITICAL**: Never use duration-based animations. All motion uses spring physics for natural feel.

```swift
extension Animation {
    // Quick, responsive interactions (buttons, toggles)
    static let optaSpring = Animation.spring(
        response: 0.3,
        dampingFraction: 0.7,
        blendDuration: 0
    )

    // Gentle transitions (page changes, reveals)
    static let optaSpringGentle = Animation.spring(
        response: 0.5,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    // Large movements (sheets, full-screen transitions)
    static let optaSpringPage = Animation.spring(
        response: 0.6,
        dampingFraction: 0.85,
        blendDuration: 0
    )

    // Bouncy feedback (success states, celebrations)
    static let optaSpringBounce = Animation.spring(
        response: 0.4,
        dampingFraction: 0.5,
        blendDuration: 0
    )
}
```

### Usage Examples

```swift
// Button press
Button(action: capture) {
    CaptureButton(isActive: isCapturing)
}
.scaleEffect(isPressed ? 0.95 : 1.0)
.animation(.optaSpring, value: isPressed)

// Card appearance
ResultCard(result: result)
    .opacity(isVisible ? 1 : 0)
    .offset(y: isVisible ? 0 : 20)
    .animation(.optaSpringGentle.delay(Double(index) * 0.05), value: isVisible)

// Sheet presentation
.sheet(isPresented: $showResults) {
    ResultsView()
        .transition(.move(edge: .bottom).combined(with: .opacity))
}
.animation(.optaSpringPage, value: showResults)
```

### Staggered Animations

```swift
struct StaggeredAppear: ViewModifier {
    let index: Int
    let isVisible: Bool

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 16)
            .animation(
                .optaSpringGentle.delay(Double(index) * 0.04),
                value: isVisible
            )
    }
}
```

---

## Typography

### Font System

Use SF Pro (system font) with Dynamic Type support. Match macOS visual hierarchy:

```swift
extension Font {
    // Hero/Display
    static let optaDisplay = Font.system(size: 34, weight: .bold, design: .rounded)

    // Section headers
    static let optaTitle = Font.system(size: 22, weight: .semibold)

    // Card titles
    static let optaHeadline = Font.system(size: 17, weight: .semibold)

    // Body content
    static let optaBody = Font.system(size: 15, weight: .regular)

    // Secondary/captions
    static let optaCaption = Font.system(size: 13, weight: .medium)

    // Tiny labels
    static let optaLabel = Font.system(size: 11, weight: .medium)
}

// Dynamic Type support
extension View {
    func optaDisplayStyle() -> some View {
        self
            .font(.optaDisplay)
            .foregroundStyle(Color.optaTextPrimary)
    }

    func optaTitleStyle() -> some View {
        self
            .font(.optaTitle)
            .foregroundStyle(Color.optaTextPrimary)
    }

    func optaBodyStyle() -> some View {
        self
            .font(.optaBody)
            .foregroundStyle(Color.optaTextSecondary)
    }
}
```

### Gradient Text (For Emphasis)

```swift
struct GradientText: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.optaDisplay)
            .foregroundStyle(Color.optaMoonlight)
    }
}
```

---

## Haptics System

### CoreHaptics Integration

```swift
import CoreHaptics

class OptaHaptics {
    static let shared = OptaHaptics()
    private var engine: CHHapticEngine?

    init() {
        prepareHaptics()
    }

    private func prepareHaptics() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }

        do {
            engine = try CHHapticEngine()
            try engine?.start()
        } catch {
            print("Haptic engine failed: \(error)")
        }
    }

    // Quick tap feedback
    func tap() {
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()
    }

    // Button press
    func buttonPress() {
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
    }

    // Success completion
    func success() {
        let notification = UINotificationFeedbackGenerator()
        notification.notificationOccurred(.success)
    }

    // Processing start
    func processingStart() {
        let impact = UIImpactFeedbackGenerator(style: .heavy)
        impact.impactOccurred()
    }
}
```

### Custom AHAP Patterns

For premium feel, create AHAP files for complex haptic patterns:

```swift
// Load custom pattern
func playCustomHaptic(named: String) {
    guard let path = Bundle.main.path(forResource: named, ofType: "ahap") else { return }

    do {
        try engine?.playPattern(from: URL(fileURLWithPath: path))
    } catch {
        print("Failed to play haptic: \(error)")
    }
}
```

### Haptic Timing Rules

| Action | Timing | Style |
|--------|--------|-------|
| Button tap | Immediate | Light impact |
| Capture photo | On shutter | Medium impact |
| Processing start | At animation start | Heavy impact |
| Result reveal | 50ms before visual | Success notification |
| Slider tick | At each step | Selection changed |

---

## Components

### Capture Button

```swift
struct CaptureButton: View {
    let action: () -> Void
    @State private var isPressed = false

    var body: some View {
        Button(action: {
            OptaHaptics.shared.buttonPress()
            action()
        }) {
            ZStack {
                // Outer ring
                Circle()
                    .stroke(Color.optaPurple.opacity(0.3), lineWidth: 4)
                    .frame(width: 80, height: 80)

                // Inner fill
                Circle()
                    .fill(Color.optaPurple)
                    .frame(width: 64, height: 64)

                // Icon
                Image(systemName: "camera.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .scaleEffect(isPressed ? 0.92 : 1.0)
        .animation(.optaSpring, value: isPressed)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
    }
}
```

### Result Card

```swift
struct ResultCard: View {
    let title: String
    let subtitle: String
    let rank: Int?
    let isRecommended: Bool

    var body: some View {
        HStack(spacing: 16) {
            // Rank badge
            if let rank = rank {
                Text("\(rank)")
                    .font(.optaHeadline)
                    .foregroundStyle(isRecommended ? Color.optaPurple : Color.optaTextMuted)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(isRecommended ? Color.optaPurple.opacity(0.2) : Color.optaSurface)
                    )
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)

                Text(subtitle)
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
            }

            Spacer()

            // Recommended badge
            if isRecommended {
                Text("Best")
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaPurple)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.optaPurple.opacity(0.15))
                    )
            }
        }
        .padding(16)
        .glassContent()
    }
}
```

### Optamize Slider

```swift
struct OptamizeSlider: View {
    @Binding var value: Double // 0 = Quick, 1 = Thorough

    var body: some View {
        VStack(spacing: 12) {
            // Label
            HStack {
                Text("Quick")
                    .font(.optaCaption)
                    .foregroundStyle(value < 0.5 ? Color.optaPurple : Color.optaTextMuted)

                Spacer()

                Text("Optamize")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaPurple)

                Spacer()

                Text("Thorough")
                    .font(.optaCaption)
                    .foregroundStyle(value > 0.5 ? Color.optaPurple : Color.optaTextMuted)
            }

            // Slider track
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track background
                    Capsule()
                        .fill(Color.optaSurface)
                        .frame(height: 8)

                    // Fill
                    Capsule()
                        .fill(Color.optaMoonlight)
                        .frame(width: geo.size.width * value, height: 8)

                    // Thumb
                    Circle()
                        .fill(Color.optaPurple)
                        .frame(width: 24, height: 24)
                        .shadow(color: Color.optaPurple.opacity(0.5), radius: 8)
                        .offset(x: (geo.size.width - 24) * value)
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { gesture in
                            let newValue = gesture.location.x / geo.size.width
                            value = min(max(newValue, 0), 1)
                            OptaHaptics.shared.tap()
                        }
                )
            }
            .frame(height: 24)
        }
        .padding(16)
        .glassSubtle()
    }
}
```

---

## Icon System

### SF Symbols Only

Always use SF Symbols. Configure with hierarchical rendering for depth:

```swift
// Primary action icons
Image(systemName: "camera.fill")
    .symbolRenderingMode(.hierarchical)
    .foregroundStyle(Color.optaPurple)

// Secondary icons
Image(systemName: "clock")
    .symbolRenderingMode(.monochrome)
    .foregroundStyle(Color.optaTextSecondary)

// Status icons with semantic color
Image(systemName: "checkmark.circle.fill")
    .symbolRenderingMode(.palette)
    .foregroundStyle(.white, Color.optaGreen)
```

### Key Symbols for Opta Scan

| Purpose | Symbol | Notes |
|---------|--------|-------|
| Camera capture | `camera.fill` | Primary action |
| Photo library | `photo.on.rectangle` | Secondary capture |
| Text input | `text.cursor` | Prompt mode |
| Processing | `sparkle` | Optamize active |
| Results | `list.bullet.rectangle` | Result list |
| History | `clock.arrow.circlepath` | Past scans |
| Settings | `gearshape.fill` | Configuration |
| Share | `square.and.arrow.up` | Export results |
| Ranking | `trophy.fill` | Best option |
| Quick mode | `hare` | Fast processing |
| Thorough mode | `tortoise` | Deep analysis |

---

## Loading States

### Processing Indicator

```swift
struct OptaProcessingView: View {
    @State private var rotation: Double = 0
    @State private var scale: Double = 1

    var body: some View {
        ZStack {
            // Outer glow ring
            Circle()
                .stroke(Color.optaPurple.opacity(0.3), lineWidth: 2)
                .frame(width: 60, height: 60)
                .scaleEffect(scale)

            // Spinning arc
            Circle()
                .trim(from: 0, to: 0.3)
                .stroke(
                    Color.optaMoonlight,
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .frame(width: 48, height: 48)
                .rotationEffect(.degrees(rotation))

            // Center icon
            Image(systemName: "sparkle")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.optaPurple)
        }
        .onAppear {
            withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) {
                rotation = 360
            }
            withAnimation(.easeInOut(duration: 1.5).repeatForever()) {
                scale = 1.1
            }
        }
    }
}
```

---

## Navigation Structure

### Tab Bar

```swift
struct OptaTabBar: View {
    @Binding var selectedTab: Tab

    enum Tab: String, CaseIterable {
        case capture = "camera.fill"
        case history = "clock"
        case settings = "gearshape"
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    OptaHaptics.shared.tap()
                    withAnimation(.optaSpring) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.rawValue)
                            .font(.system(size: 22))
                            .symbolRenderingMode(.hierarchical)

                        Circle()
                            .fill(Color.optaPurple)
                            .frame(width: 4, height: 4)
                            .opacity(selectedTab == tab ? 1 : 0)
                    }
                    .foregroundStyle(selectedTab == tab ? Color.optaPurple : Color.optaTextMuted)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.vertical, 12)
        .glassSubtle()
    }
}
```

---

## Performance Guidelines

### 60fps Minimum, 120fps Target

1. **Avoid geometry readers in scroll views** — Pre-calculate sizes
2. **Use `drawingGroup()` for complex views** — Rasterizes to Metal
3. **Lazy load list content** — `LazyVStack`, `LazyHStack`
4. **Cache images** — Use `AsyncImage` with cache
5. **Profile with Instruments** — GPU frame rate, hangs

### Memory Management

```swift
// Use @StateObject for view-owned objects
@StateObject private var viewModel = CaptureViewModel()

// Use @ObservedObject for passed objects
@ObservedObject var resultStore: ResultStore

// Weak references in closures
Task { [weak self] in
    await self?.processImage()
}
```

---

## Accessibility

### VoiceOver Support

```swift
ResultCard(result: result)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(result.title), ranked \(result.rank)")
    .accessibilityHint("Double tap to see details")
    .accessibilityAddTraits(result.isRecommended ? .isSelected : [])
```

### Dynamic Type

All text scales automatically with system settings. Test at all sizes:

```swift
// Preview at accessibility sizes
#Preview {
    ResultCard(...)
        .environment(\.sizeCategory, .accessibilityExtraExtraLarge)
}
```

### Reduce Motion

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

.animation(reduceMotion ? .none : .optaSpring, value: isVisible)
```

---

## Sync with macOS

| Element | macOS (React) | iOS (SwiftUI) | Sync Status |
|---------|---------------|---------------|-------------|
| Background | `#09090b` | `optaBackground` | Synced |
| Purple accent | `#8b5cf6` | `optaPurple` | Synced |
| Glass blur | `backdrop-blur` | `.material` | Equivalent |
| Springs | Reanimated `withSpring` | `.spring()` | Matched values |
| Typography | Sora font | SF Pro (system) | Platform-appropriate |
| Haptics | N/A | CoreHaptics | iOS-only |

---

## Quick Reference

### Do's

- Use `#09090b` for backgrounds (OLED optimized)
- Use spring animations exclusively
- Use SF Symbols for all icons
- Use `.material` for glass effects
- Trigger haptics at animation start
- Support Dynamic Type
- Test on ProMotion displays

### Don'ts

- Don't use true black `#000000`
- Don't use duration-based animations
- Don't use custom icon images
- Don't hardcode font sizes
- Don't skip haptic feedback
- Don't ignore accessibility
- Don't block the main thread

---

*Last updated: 2026-01-20 — Opta Scan iOS Aesthetic Guide v1.0*
