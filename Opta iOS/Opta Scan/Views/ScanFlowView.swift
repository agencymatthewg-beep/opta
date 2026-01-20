//
//  ScanFlowView.swift
//  Opta Scan
//
//  Main container for the scan-to-optimization flow
//  Created by Matthew Byrden
//

import SwiftUI

struct ScanFlowView: View {

    @StateObject private var flowState = ScanFlowState()

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            switch flowState.currentStep {
            case .capture:
                CaptureFlowView(flowState: flowState)
                    .transition(.opacity)

            case .processing:
                ProcessingView(prompt: flowState.prompt)
                    .transition(.opacity)

            case .questions:
                if let result = flowState.analysisResult {
                    QuestionsView(
                        analysisResult: result,
                        answers: $flowState.questionAnswers,
                        onSubmit: { flowState.submitAnswers() },
                        onBack: { flowState.goBack() }
                    )
                    .transition(.move(edge: .trailing))
                }

            case .result:
                if let result = flowState.optimizationResult {
                    ResultView(
                        result: result,
                        prompt: flowState.prompt,
                        onNewScan: { flowState.reset() },
                        onShare: { shareResult(result) }
                    )
                    .transition(.move(edge: .trailing))
                }
            }
        }
        .animation(.optaSpringGentle, value: flowState.currentStep)
        .alert("Error", isPresented: .constant(flowState.error != nil)) {
            Button("OK") {
                flowState.error = nil
            }
        } message: {
            if let error = flowState.error {
                Text(error.localizedDescription)
            }
        }
    }

    private func shareResult(_ result: OptimizationResult) {
        let text = """
        🎯 Opta Optimization Result

        \(flowState.prompt)

        Key Takeaways:
        \(result.highlights.map { "• \($0)" }.joined(separator: "\n"))

        \(result.markdown)

        Optimized with Opta Scan
        """

        let activityVC = UIActivityViewController(
            activityItems: [text],
            applicationActivities: nil
        )

        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootViewController = windowScene.windows.first?.rootViewController {
            rootViewController.present(activityVC, animated: true)
        }
    }
}

// MARK: - Capture Flow View (Modified CaptureView for flow)

struct CaptureFlowView: View {

    @ObservedObject var flowState: ScanFlowState
    @StateObject private var cameraService = CameraService()
    @State private var captureMode: CaptureMode = .camera

    var body: some View {
        VStack(spacing: 0) {
            // Camera preview or selected image
            ZStack {
                if let image = flowState.capturedImage ?? cameraService.capturedImage {
                    ImagePreviewFlowView(image: image) {
                        clearImage()
                    }
                } else if captureMode == .camera && cameraService.isAuthorized {
                    CameraPreviewView(session: cameraService.session)
                        .ignoresSafeArea(edges: .top)
                } else {
                    CaptureModePlaceholderView(mode: captureMode)
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
                    CaptureModeToggleView(selectedMode: $captureMode)
                    Spacer()
                    PhotoPickerButton(selectedImage: $flowState.capturedImage)
                }
                .padding(.horizontal, OptaDesign.Spacing.md)

                // Optamize slider
                OptamizeSlider(depth: $flowState.depth)
                    .padding(.horizontal, OptaDesign.Spacing.md)

                // Prompt input
                PromptInputView(prompt: $flowState.prompt) {
                    flowState.startOptimization()
                }
                .padding(.horizontal, OptaDesign.Spacing.md)

                // Capture or Optimize button
                if captureMode == .camera && flowState.capturedImage == nil && cameraService.capturedImage == nil {
                    CaptureButton {
                        cameraService.capturePhoto()
                    }
                    .padding(.bottom, OptaDesign.Spacing.md)
                    .onChange(of: cameraService.capturedImage) { _, newImage in
                        if let image = newImage {
                            flowState.capturedImage = image
                        }
                    }
                } else if flowState.capturedImage != nil || cameraService.capturedImage != nil || !flowState.prompt.isEmpty {
                    Button {
                        flowState.startOptimization()
                    } label: {
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
                        .opacity(flowState.prompt.isEmpty ? 0.5 : 1.0)
                    }
                    .disabled(flowState.prompt.isEmpty)
                    .padding(.bottom, OptaDesign.Spacing.md)
                }
            }
            .padding(.top, OptaDesign.Spacing.lg)
            .padding(.bottom, OptaDesign.Spacing.xl)
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

    private func clearImage() {
        withAnimation(.optaSpring) {
            flowState.capturedImage = nil
            cameraService.capturedImage = nil
        }
        OptaHaptics.shared.tap()
    }
}

// MARK: - Image Preview for Flow

private struct ImagePreviewFlowView: View {
    let image: UIImage
    let onClear: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)

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

// MARK: - Capture Mode Placeholder

private struct CaptureModePlaceholderView: View {
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

// MARK: - Capture Mode Toggle

private struct CaptureModeToggleView: View {
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

#Preview {
    ScanFlowView()
}
