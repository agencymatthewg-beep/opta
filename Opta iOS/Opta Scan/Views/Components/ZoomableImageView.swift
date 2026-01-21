//
//  ZoomableImageView.swift
//  Opta Scan
//
//  Pinch-to-zoom and double-tap-to-zoom image component
//  Part of Phase 9: Advanced Gestures
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - ZoomableImageView

/// An image view with pinch-to-zoom, double-tap zoom toggle, and panning capabilities
/// Provides rubber-band effect at min/max zoom with haptic feedback
struct ZoomableImageView: View {

    // MARK: - Properties

    let image: UIImage
    let cornerRadius: CGFloat
    let maxHeight: CGFloat?

    // MARK: - State

    @State private var currentScale: CGFloat = 1.0
    @State private var finalScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var finalOffset: CGSize = .zero

    // MARK: - Constants

    private enum Layout {
        static let minScale: CGFloat = 1.0
        static let maxScale: CGFloat = 4.0
        static let doubleTapTargetScale: CGFloat = 2.5
        static let rubberBandResistance: CGFloat = 0.3
        static let resetThreshold: CGFloat = 1.05
    }

    // MARK: - Computed Properties

    /// Combined scale from gesture and final state
    private var combinedScale: CGFloat {
        let scale = finalScale * currentScale
        // Apply rubber band effect at boundaries
        if scale < Layout.minScale {
            let excess = Layout.minScale - scale
            return Layout.minScale - excess * Layout.rubberBandResistance
        } else if scale > Layout.maxScale {
            let excess = scale - Layout.maxScale
            return Layout.maxScale + excess * Layout.rubberBandResistance
        }
        return scale
    }

    /// Combined offset from gesture and final state
    private var combinedOffset: CGSize {
        CGSize(
            width: finalOffset.width + offset.width,
            height: finalOffset.height + offset.height
        )
    }

    /// Whether the image is currently zoomed in
    private var isZoomed: Bool {
        finalScale > Layout.resetThreshold
    }

    // MARK: - Initializer

    init(
        image: UIImage,
        cornerRadius: CGFloat = OptaDesign.CornerRadius.large,
        maxHeight: CGFloat? = nil
    ) {
        self.image = image
        self.cornerRadius = cornerRadius
        self.maxHeight = maxHeight
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: geometry.size.width, maxHeight: maxHeight ?? geometry.size.height)
                .scaleEffect(combinedScale)
                .offset(combinedOffset)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .gesture(zoomGestures)
                .onTapGesture(count: 2) {
                    handleDoubleTap()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxHeight: maxHeight)
        .accessibilityLabel("Zoomable image")
        .accessibilityHint("Double tap to zoom. Pinch to zoom in or out. Drag to pan when zoomed.")
        .accessibilityAddTraits(.isImage)
    }

    // MARK: - Gestures

    /// Combined pinch and drag gesture
    private var zoomGestures: some Gesture {
        SimultaneousGesture(pinchGesture, panGesture)
    }

    /// Pinch-to-zoom gesture
    private var pinchGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                currentScale = value
            }
            .onEnded { value in
                withAnimation(.optaSpring) {
                    // Clamp to valid range
                    finalScale = min(Layout.maxScale, max(Layout.minScale, finalScale * value))
                    currentScale = 1.0

                    // Reset offset if zoomed out
                    if finalScale <= Layout.minScale {
                        finalOffset = .zero
                        offset = .zero
                    }
                }
            }
    }

    /// Pan gesture (only active when zoomed)
    private var panGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                // Only allow panning when zoomed
                guard isZoomed else { return }
                offset = value.translation
            }
            .onEnded { value in
                guard isZoomed else { return }

                withAnimation(.optaSpring) {
                    finalOffset = CGSize(
                        width: finalOffset.width + value.translation.width,
                        height: finalOffset.height + value.translation.height
                    )
                    offset = .zero
                }
            }
    }

    // MARK: - Actions

    /// Handle double-tap to toggle zoom
    private func handleDoubleTap() {
        // Haptic feedback
        OptaHaptics.shared.doubleTap()

        withAnimation(.optaSpring) {
            if isZoomed {
                // Reset to normal
                finalScale = Layout.minScale
                finalOffset = .zero
                offset = .zero
            } else {
                // Zoom to target
                finalScale = Layout.doubleTapTargetScale
            }
        }
    }
}

// MARK: - View Extension

extension View {
    /// Reset zoom state for zoomable content
    /// Useful when dismissing sheets containing zoomable images
    func onDismissResetZoom(
        scale: Binding<CGFloat>,
        offset: Binding<CGSize>
    ) -> some View {
        self.onDisappear {
            withAnimation(.optaSpring) {
                scale.wrappedValue = 1.0
                offset.wrappedValue = .zero
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()

        if let sampleImage = UIImage(systemName: "photo.fill")?
            .withTintColor(.white, renderingMode: .alwaysOriginal) {
            ZoomableImageView(
                image: sampleImage,
                cornerRadius: OptaDesign.CornerRadius.large,
                maxHeight: 300
            )
            .padding()
        }
    }
    .preferredColorScheme(.dark)
}
