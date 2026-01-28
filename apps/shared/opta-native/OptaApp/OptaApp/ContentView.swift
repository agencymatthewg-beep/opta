//
//  ContentView.swift
//  OptaApp
//
//  Main content view hosting the Metal render surface
//

import SwiftUI

struct ContentView: View {

    // MARK: - Properties

    /// The render coordinator
    @ObservedObject var coordinator: RenderCoordinator

    /// Whether to show the FPS overlay
    @State private var showFPSOverlay: Bool = true

    /// Whether the view is hovered (for overlay visibility)
    @State private var isHovered: Bool = false

    // MARK: - Body

    var body: some View {
        ZStack {
            // Main render view
            MetalRenderView(coordinator: coordinator)
                .ignoresSafeArea()

            // FPS Overlay
            if showFPSOverlay {
                fpsOverlay
            }

            // Paused indicator
            if coordinator.isPaused {
                pausedOverlay
            }
        }
        .background(Color.black)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleFPSOverlay)) { _ in
            withAnimation {
                showFPSOverlay.toggle()
            }
        }
        .onAppear {
            // Start rendering when view appears
            coordinator.isPaused = false
        }
        .onDisappear {
            // Pause rendering when view disappears
            coordinator.isPaused = true
        }
    }

    // MARK: - FPS Overlay

    private var fpsOverlay: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                // FPS indicator
                Text("\(Int(coordinator.currentFPS)) FPS")
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundColor(fpsColor)

                // Frame time
                Text(String(format: "%.2f ms", coordinator.frameTimeMs))
                    .font(.system(size: 10, weight: .regular, design: .monospaced))
                    .foregroundColor(.white.opacity(0.7))
            }

            // Additional stats when hovered
            if isHovered {
                VStack(alignment: .leading, spacing: 2) {
                    Text("GPU: \(coordinator.gpuName)")
                        .font(.system(size: 9, weight: .regular, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))

                    Text("Target: \(coordinator.targetRefreshRate) Hz")
                        .font(.system(size: 9, weight: .regular, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))

                    Text("Frames: \(coordinator.totalFrames)")
                        .font(.system(size: 9, weight: .regular, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))

                    if coordinator.droppedFrames > 0 {
                        Text("Dropped: \(coordinator.droppedFrames)")
                            .font(.system(size: 9, weight: .regular, design: .monospaced))
                            .foregroundColor(.orange.opacity(0.8))
                    }

                    Text("Quality: \(qualityLevelName)")
                        .font(.system(size: 9, weight: .regular, design: .monospaced))
                        .foregroundColor(.white.opacity(0.5))
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.black.opacity(0.6))
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(16)
    }

    // MARK: - Paused Overlay

    private var pausedOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "pause.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.white.opacity(0.8))

            Text("Rendering Paused")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white.opacity(0.8))

            Text("Click to resume")
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.5))
        }
        .padding(32)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.black.opacity(0.7))
        )
        .onTapGesture {
            coordinator.isPaused = false
        }
    }

    // MARK: - Helpers

    private var fpsColor: Color {
        let fps = coordinator.currentFPS
        let target = Float(coordinator.targetRefreshRate)

        if fps >= target * 0.95 {
            return .green
        } else if fps >= target * 0.8 {
            return .yellow
        } else if fps >= target * 0.5 {
            return .orange
        } else {
            return .red
        }
    }

    private var qualityLevelName: String {
        switch coordinator.qualityLevel {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .ultra: return "Ultra"
        case .adaptive: return "Adaptive"
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView(coordinator: RenderCoordinator())
            .frame(width: 800, height: 600)
            .preferredColorScheme(.dark)
    }
}
#endif
