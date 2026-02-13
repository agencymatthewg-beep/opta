//
//  LoadingSplash.swift
//  OptaPlusMacOS
//
//  Cinematic Void loading/splash screen. Full-screen void background with
//  a centered Opta "O" brand mark surrounded by a rotating glow ring,
//  followed by a delayed "OptaPlus" text fade-in. Auto-dismisses after
//  2 seconds or when content signals it's ready.
//
//  Usage:
//  ```swift
//  @State private var isLoading = true
//
//  ZStack {
//      MainContentView()
//      LoadingSplash(isLoading: $isLoading)
//  }
//  ```
//

import SwiftUI
import OptaMolt

// MARK: - Loading Splash

/// Full-screen loading splash with animated Opta brand mark.
///
/// Displays the Opta "O" in Sora Bold 60pt with a rotating gradient
/// glow ring, followed by "OptaPlus" fading in after 0.5s. Dismisses
/// with a smooth fade-out after 2 seconds or when `isLoading` becomes `false`.
public struct LoadingSplash: View {
    @Binding var isLoading: Bool

    @State private var showSubtitle = false
    @State private var ringRotation: Double = 0
    @State private var dismissed = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(isLoading: Binding<Bool>) {
        self._isLoading = isLoading
    }

    public var body: some View {
        if !dismissed {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                VStack(spacing: 24) {
                    // Brand mark with glow ring
                    ZStack {
                        // Rotating glow ring
                        if !reduceMotion {
                            Circle()
                                .stroke(
                                    AngularGradient(
                                        gradient: Gradient(colors: [
                                            Color.optaPrimary.opacity(0.8),
                                            Color.optaPrimaryGlow.opacity(0.4),
                                            Color.optaIndigo.opacity(0.2),
                                            Color.clear,
                                            Color.clear,
                                            Color.optaPrimary.opacity(0.8),
                                        ]),
                                        center: .center
                                    ),
                                    lineWidth: 3
                                )
                                .frame(width: 100, height: 100)
                                .blur(radius: 6)
                                .rotationEffect(.degrees(ringRotation))

                            // Sharper inner ring
                            Circle()
                                .stroke(
                                    AngularGradient(
                                        gradient: Gradient(colors: [
                                            Color.optaPrimary.opacity(0.6),
                                            Color.clear,
                                            Color.clear,
                                            Color.optaPrimary.opacity(0.6),
                                        ]),
                                        center: .center
                                    ),
                                    lineWidth: 1.5
                                )
                                .frame(width: 100, height: 100)
                                .rotationEffect(.degrees(ringRotation))
                        }

                        // "O" brand mark
                        Text("O")
                            .font(.sora(60, weight: .bold))
                            .foregroundStyle(Color.optaPrimary)
                            .shadow(color: Color.optaPrimary.opacity(0.5), radius: 20)
                    }

                    // "OptaPlus" subtitle with delayed fade-in
                    Text("OptaPlus")
                        .font(.sora(20, weight: .medium))
                        .foregroundStyle(Color.optaTextSecondary)
                        .opacity(showSubtitle ? 1 : 0)
                }
            }
            .opacity(dismissed ? 0 : 1)
            .onAppear {
                // Start ring rotation
                if !reduceMotion {
                    withAnimation(.linear(duration: 3).repeatForever(autoreverses: false)) {
                        ringRotation = 360
                    }
                }

                // Delayed subtitle
                withAnimation(.optaGentle.delay(0.5)) {
                    showSubtitle = true
                }

                // Auto-dismiss timer
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    dismiss()
                }
            }
            .onChange(of: isLoading) { _, loading in
                if !loading {
                    dismiss()
                }
            }
        }
    }

    private func dismiss() {
        guard !dismissed else { return }
        withAnimation(.optaGentle) {
            dismissed = true
        }
        // Update binding after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isLoading = false
        }
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Loading Splash") {
    LoadingSplash(isLoading: .constant(true))
        .frame(width: 600, height: 400)
}
#endif
