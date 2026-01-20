//
//  CaptureView.swift
//  Opta Scan
//
//  Primary capture screen - camera, photo library, and prompt input
//  Created by Matthew Byrden
//

import SwiftUI

struct CaptureView: View {

    // MARK: - State

    @StateObject private var cameraService = CameraService()
    @State private var selectedImage: UIImage?
    @State private var prompt: String = ""
    @State private var captureMode: CaptureMode = .camera
    @State private var showingImagePreview = false

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Camera preview or selected image
                ZStack {
                    if let image = selectedImage ?? cameraService.capturedImage {
                        // Show captured/selected image
                        ImagePreviewView(image: image) {
                            clearImage()
                        }
                    } else if captureMode == .camera && cameraService.isAuthorized {
                        // Live camera preview
                        CameraPreviewView(session: cameraService.session)
                            .ignoresSafeArea(edges: .top)
                    } else {
                        // Placeholder
                        CaptureModePlaceholder(mode: captureMode)
                    }
                }
                .frame(maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.extraLarge, style: .continuous))
                .padding(.horizontal, OptaDesign.Spacing.md)
                .padding(.top, OptaDesign.Spacing.md)

                // Bottom controls
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Mode toggle and library button
                    HStack {
                        CaptureModeToggle(selectedMode: $captureMode)

                        Spacer()

                        PhotoPickerButton(selectedImage: $selectedImage)
                    }
                    .padding(.horizontal, OptaDesign.Spacing.md)

                    // Prompt input
                    PromptInputView(prompt: $prompt) {
                        startOptimization()
                    }
                    .padding(.horizontal, OptaDesign.Spacing.md)

                    // Capture button (only show in camera mode without image)
                    if captureMode == .camera && selectedImage == nil && cameraService.capturedImage == nil {
                        CaptureButton {
                            cameraService.capturePhoto()
                        }
                        .padding(.bottom, OptaDesign.Spacing.md)
                    } else if selectedImage != nil || cameraService.capturedImage != nil {
                        // Optimize button when image is selected
                        OptimizeButton(prompt: prompt, isEnabled: !prompt.isEmpty) {
                            startOptimization()
                        }
                        .padding(.bottom, OptaDesign.Spacing.md)
                    }
                }
                .padding(.top, OptaDesign.Spacing.lg)
                .padding(.bottom, OptaDesign.Spacing.xl)
            }
        }
        .task {
            await cameraService.checkAuthorization()
            if cameraService.isAuthorized {
                await cameraService.configure()
                cameraService.start()
            }
        }
        .onDisappear {
            cameraService.stop()
        }
    }

    // MARK: - Actions

    private func clearImage() {
        withAnimation(.optaSpring) {
            selectedImage = nil
            cameraService.capturedImage = nil
        }
        OptaHaptics.shared.tap()
    }

    private func startOptimization() {
        guard !prompt.isEmpty else { return }
        // TODO: Phase 3 - Navigate to Claude processing
        OptaHaptics.shared.success()
        print("Starting optimization with prompt: \(prompt)")
    }
}

// MARK: - Capture Mode

enum CaptureMode: String, CaseIterable {
    case camera = "Camera"
    case text = "Text"
}

// MARK: - Capture Mode Toggle

private struct CaptureModeToggle: View {
    @Binding var selectedMode: CaptureMode

    var body: some View {
        HStack(spacing: 2) {
            ForEach(CaptureMode.allCases, id: \.self) { mode in
                Button {
                    withAnimation(.optaSpring) {
                        selectedMode = mode
                    }
                    OptaHaptics.shared.selectionChanged()
                } label: {
                    Text(mode.rawValue)
                        .font(.optaCaption)
                        .fontWeight(selectedMode == mode ? .semibold : .regular)
                        .foregroundStyle(selectedMode == mode ? Color.optaTextPrimary : Color.optaTextSecondary)
                        .padding(.horizontal, OptaDesign.Spacing.md)
                        .padding(.vertical, OptaDesign.Spacing.sm)
                        .background {
                            if selectedMode == mode {
                                Capsule()
                                    .fill(Color.optaSurface)
                            }
                        }
                }
            }
        }
        .glassSubtle()
    }
}

// MARK: - Capture Mode Placeholder

private struct CaptureModePlaceholder: View {
    let mode: CaptureMode

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.xl) {
            Image(systemName: mode == .camera ? "camera.fill" : "text.cursor")
                .font(.system(size: 64, weight: .light))
                .foregroundStyle(Color.optaPurple)

            VStack(spacing: OptaDesign.Spacing.xs) {
                Text("Capture anything,")
                    .optaTitleStyle()

                GradientText(text: "optimize everything")
                    .font(.optaTitle)
            }

            Text(mode == .camera ? "Tap to enable camera access" : "Enter a prompt below")
                .optaCaptionStyle()
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.optaBackground)
    }
}

// MARK: - Image Preview View

private struct ImagePreviewView: View {
    let image: UIImage
    let onClear: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)

            // Clear button
            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.3), radius: 4)
            }
            .padding(OptaDesign.Spacing.md)
        }
    }
}

// MARK: - Optimize Button

private struct OptimizeButton: View {
    let prompt: String
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: OptaDesign.Spacing.sm) {
                Image(systemName: "sparkles")
                    .font(.system(size: 18, weight: .semibold))
                Text("Optamize")
                    .font(.optaBody)
                    .fontWeight(.semibold)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, OptaDesign.Spacing.xl)
            .padding(.vertical, OptaDesign.Spacing.md)
            .background(
                LinearGradient(
                    colors: [Color.optaPurple, Color.optaBlue],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .clipShape(Capsule())
            .opacity(isEnabled ? 1.0 : 0.5)
        }
        .disabled(!isEnabled)
    }
}

#Preview {
    CaptureView()
}
