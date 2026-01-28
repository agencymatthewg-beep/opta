//
//  CardFlipView.swift
//  Opta Scan
//
//  Card flip animation with 3D perspective
//  Part of Phase 13: 3D Transforms
//

import SwiftUI

/// A view that flips between front and back content
struct CardFlipView<Front: View, Back: View>: View {
    @Binding var isFlipped: Bool
    let perspective: PerspectiveConfig
    let duration: Double
    let front: Front
    let back: Back

    @State private var rotation: Double = 0

    init(
        isFlipped: Binding<Bool>,
        perspective: PerspectiveConfig = .standard,
        duration: Double = 0.6,
        @ViewBuilder front: () -> Front,
        @ViewBuilder back: () -> Back
    ) {
        self._isFlipped = isFlipped
        self.perspective = perspective
        self.duration = duration
        self.front = front()
        self.back = back()
    }

    var body: some View {
        ZStack {
            front
                .opacity(rotation < 90 ? 1 : 0)
                .rotation3DEffect(
                    .degrees(rotation),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 1 / perspective.focalLength
                )

            back
                .opacity(rotation >= 90 ? 1 : 0)
                .rotation3DEffect(
                    .degrees(rotation - 180),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 1 / perspective.focalLength
                )
        }
        .onChange(of: isFlipped) { _, newValue in
            withAnimation(.optaSpring) {
                rotation = newValue ? 180 : 0
            }
        }
    }
}

// MARK: - Interactive 3D Card

/// Card that responds to drag with 3D rotation
struct Interactive3DCard<Content: View>: View {
    let maxRotation: Double
    let perspective: PerspectiveConfig
    let content: Content

    @State private var rotationState = Rotation3DState()
    @GestureState private var isDragging = false

    init(
        maxRotation: Double = 15,
        perspective: PerspectiveConfig = .standard,
        @ViewBuilder content: () -> Content
    ) {
        self.maxRotation = maxRotation
        self.perspective = perspective
        self.content = content()
    }

    var body: some View {
        content
            .rotation3D(rotationState, perspective: perspective)
            .gesture(
                DragGesture()
                    .updating($isDragging) { _, state, _ in
                        state = true
                    }
                    .onChanged { value in
                        let normalizedX = value.translation.width / 100
                        let normalizedY = value.translation.height / 100

                        rotationState.rotationY = min(max(normalizedX * maxRotation, -maxRotation), maxRotation)
                        rotationState.rotationX = min(max(-normalizedY * maxRotation, -maxRotation), maxRotation)
                    }
                    .onEnded { _ in
                        withAnimation(.optaSpring) {
                            rotationState.reset()
                        }
                    }
            )
            .animation(.optaSpring, value: isDragging)
    }
}

// MARK: - View Extension

extension View {
    /// Make view respond to drag with 3D tilt effect
    func interactive3DTilt(
        maxRotation: Double = 10,
        perspective: PerspectiveConfig = .standard
    ) -> some View {
        Interactive3DTiltModifier(
            maxRotation: maxRotation,
            perspective: perspective
        ) {
            self
        }
    }
}

/// Modifier for 3D tilt effect
struct Interactive3DTiltModifier<Content: View>: View {
    let maxRotation: Double
    let perspective: PerspectiveConfig
    let content: () -> Content

    @State private var rotationX: Double = 0
    @State private var rotationY: Double = 0

    var body: some View {
        content()
            .rotation3D(
                x: rotationX,
                y: rotationY,
                perspective: perspective
            )
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let normalizedX = value.translation.width / 100
                        let normalizedY = value.translation.height / 100

                        rotationY = min(max(normalizedX * maxRotation, -maxRotation), maxRotation)
                        rotationX = min(max(-normalizedY * maxRotation, -maxRotation), maxRotation)
                    }
                    .onEnded { _ in
                        withAnimation(.optaSpring) {
                            rotationX = 0
                            rotationY = 0
                        }
                    }
            )
    }
}
