//
//  ScanFlowView.swift
//  Opta Scan
//
//  Main container for the scan-to-optimization flow
//  Manages state machine transitions between capture, processing, questions, and results
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Scan Flow View

/// Main container view that orchestrates the full scan-to-optimization flow
struct ScanFlowView: View {

    // MARK: - State

    @StateObject private var flowState = ScanFlowState()

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            // Step-Based Content
            stepContent
        }
        .animation(.optaSpringGentle, value: flowState.currentStep)
        .alert("Error", isPresented: errorAlertBinding) {
            Button("OK", role: .cancel) {
                flowState.error = nil
            }
        } message: {
            if let error = flowState.error {
                Text(error.localizedDescription)
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var stepContent: some View {
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
                    onSubmit: flowState.submitAnswers,
                    onBack: flowState.goBack
                )
                .transition(.move(edge: .trailing))
            }

        case .result:
            if let result = flowState.optimizationResult {
                ResultView(
                    result: result,
                    prompt: flowState.prompt,
                    onNewScan: flowState.reset,
                    onShare: { shareResult(result) }
                )
                .transition(.move(edge: .trailing))
            }
        }
    }

    /// Binding for error alert presentation
    private var errorAlertBinding: Binding<Bool> {
        Binding(
            get: { flowState.error != nil },
            set: { if !$0 { flowState.error = nil } }
        )
    }

    // MARK: - Private Methods

    /// Share optimization result via system share sheet
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

// MARK: - Capture Flow View

/// Camera capture view integrated with the scan flow state machine
struct CaptureFlowView: View {

    // MARK: - Properties

    @ObservedObject var flowState: ScanFlowState

    // MARK: - State

    @StateObject private var cameraService = CameraService()
    @State private var captureMode: CaptureMode = .camera

    // MARK: - Computed Properties

    /// Whether an image has been captured (from either flow state or camera service)
    private var hasCapturedImage: Bool {
        flowState.capturedImage != nil || cameraService.capturedImage != nil
    }

    /// The current captured image from any source
    private var capturedImage: UIImage? {
        flowState.capturedImage ?? cameraService.capturedImage
    }

    /// Whether the optimize button should be shown
    private var shouldShowOptimizeButton: Bool {
        hasCapturedImage || !flowState.prompt.isEmpty
    }

    /// Whether the capture button should be shown
    private var shouldShowCaptureButton: Bool {
        captureMode == .camera && !hasCapturedImage
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Camera Preview or Selected Image
            previewArea
                .frame(maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.extraLarge, style: .continuous))
                .padding(.horizontal, OptaDesign.Spacing.md)
                .padding(.top, OptaDesign.Spacing.md)

            // Bottom Controls
            controlsArea
                .padding(.top, OptaDesign.Spacing.lg)
                .padding(.bottom, OptaDesign.Spacing.xl)
        }
        .task {
            await initializeCamera()
        }
        .onDisappear {
            cameraService.stop()
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var previewArea: some View {
        ZStack {
            if let image = capturedImage {
                ImagePreviewFlowView(image: image, onClear: clearImage)
            } else if captureMode == .camera && cameraService.isAuthorized {
                CameraPreviewView(session: cameraService.session)
                    .ignoresSafeArea(edges: .top)
            } else {
                CaptureModePlaceholderView(mode: captureMode)
            }
        }
    }

    private var controlsArea: some View {
        VStack(spacing: OptaDesign.Spacing.lg) {
            // Mode Toggle and Library Button
            HStack {
                CaptureModeToggleView(selectedMode: $captureMode)
                Spacer()
                PhotoPickerButton(selectedImage: $flowState.capturedImage)
            }
            .padding(.horizontal, OptaDesign.Spacing.md)

            // Optamize Depth Slider
            OptamizeSlider(depth: $flowState.depth)
                .padding(.horizontal, OptaDesign.Spacing.md)

            // Prompt Input
            PromptInputView(prompt: $flowState.prompt) {
                flowState.startOptimization()
            }
            .padding(.horizontal, OptaDesign.Spacing.md)

            // Action Button (Capture or Optimize)
            actionButton
                .padding(.bottom, OptaDesign.Spacing.md)
        }
    }

    @ViewBuilder
    private var actionButton: some View {
        if shouldShowCaptureButton {
            CaptureButton {
                cameraService.capturePhoto()
            }
            .onChange(of: cameraService.capturedImage) { _, newImage in
                if let image = newImage {
                    flowState.capturedImage = image
                }
            }
        } else if shouldShowOptimizeButton {
            optimizeButton
        }
    }

    private var optimizeButton: some View {
        Button {
            OptaHaptics.shared.buttonPress()
            flowState.startOptimization()
        } label: {
            HStack(spacing: OptaDesign.Spacing.sm) {
                Image(systemName: "sparkles")
                    .font(.system(size: 18, weight: .semibold))
                    .symbolEffect(.bounce, value: !flowState.prompt.isEmpty)
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
        .accessibilityLabel("Optamize")
        .accessibilityHint("Start the optimization process for your image and prompt")
        .disabled(flowState.prompt.isEmpty)
    }

    // MARK: - Private Methods

    private func initializeCamera() async {
        await cameraService.checkAuthorization()
        guard cameraService.isAuthorized else { return }
        await cameraService.configure()
        cameraService.start()
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

/// Preview of captured image with clear button overlay
private struct ImagePreviewFlowView: View {

    let image: UIImage
    let onClear: () -> Void

    private enum Layout {
        static let clearButtonSize: CGFloat = 28
        static let shadowOpacity: Double = 0.3
        static let shadowRadius: CGFloat = 4
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .accessibilityLabel("Captured image")

            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: Layout.clearButtonSize))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(Layout.shadowOpacity), radius: Layout.shadowRadius)
            }
            .padding(OptaDesign.Spacing.md)
            .accessibilityLabel("Clear image")
            .accessibilityHint("Removes the captured image and returns to camera")
        }
    }
}

// MARK: - Capture Mode Placeholder

/// Placeholder view shown when camera is not active
private struct CaptureModePlaceholderView: View {

    let mode: CaptureMode

    private enum Layout {
        static let iconSize: CGFloat = 64
    }

    /// SF Symbol name based on current mode
    private var iconName: String {
        mode == .camera ? "camera.fill" : "text.cursor"
    }

    /// Help text based on current mode
    private var helpText: String {
        mode == .camera ? "Tap to enable camera access" : "Enter a prompt below"
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.xl) {
            Image(systemName: iconName)
                .font(.system(size: Layout.iconSize, weight: .light))
                .foregroundStyle(Color.optaPurple)
                .accessibilityHidden(true)

            VStack(spacing: OptaDesign.Spacing.xs) {
                Text("Capture anything,")
                    .optaTitleStyle()

                GradientText(text: "optimize everything")
                    .font(.optaTitle)
            }

            Text(helpText)
                .optaCaptionStyle()
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.optaBackground)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Capture anything, optimize everything. \(helpText)")
    }
}

// MARK: - Capture Mode Toggle

/// Segmented control for switching between camera and text modes
private struct CaptureModeToggleView: View {

    @Binding var selectedMode: CaptureMode

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.xxs) {
            ForEach(CaptureMode.allCases, id: \.self) { mode in
                let isSelected = selectedMode == mode

                Button {
                    withAnimation(.optaSpring) {
                        selectedMode = mode
                    }
                    OptaHaptics.shared.selectionChanged()
                } label: {
                    Text(mode.rawValue)
                        .font(.optaCaption)
                        .fontWeight(isSelected ? .semibold : .regular)
                        .foregroundStyle(isSelected ? Color.optaTextPrimary : Color.optaTextSecondary)
                        .padding(.horizontal, OptaDesign.Spacing.md)
                        .padding(.vertical, OptaDesign.Spacing.sm)
                        .background {
                            if isSelected {
                                Capsule()
                                    .fill(Color.optaSurface)
                            }
                        }
                }
                .accessibilityLabel("\(mode.rawValue) mode")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .glassSubtle()
        .accessibilityElement(children: .contain)
    }
}

#Preview {
    ScanFlowView()
}
