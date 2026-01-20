//
//  QuestionsView.swift
//  Opta Scan
//
//  Dynamic question flow from Claude analysis with multiple input types
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Questions View

/// Dynamic question flow that guides users through clarifying questions
struct QuestionsView: View {

    // MARK: - Properties

    let analysisResult: AnalysisResult
    @Binding var answers: [String: String]
    let onSubmit: () -> Void
    let onBack: () -> Void

    // MARK: - State

    @State private var currentQuestionIndex = 0

    // MARK: - Computed Properties

    /// All questions from the analysis result
    private var questions: [OptimizationQuestion] {
        analysisResult.questions
    }

    /// The currently displayed question, if any
    private var currentQuestion: OptimizationQuestion? {
        guard currentQuestionIndex < questions.count else { return nil }
        return questions[currentQuestionIndex]
    }

    /// Whether we're on the final question
    private var isLastQuestion: Bool {
        currentQuestionIndex >= questions.count - 1
    }

    /// Whether the current question has a valid answer
    private var canContinue: Bool {
        guard let question = currentQuestion,
              let answer = answers[question.id] else { return false }
        return !answer.isEmpty
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                QuestionsHeader(
                    understanding: analysisResult.understanding,
                    currentIndex: currentQuestionIndex,
                    totalCount: questions.count,
                    onBack: onBack
                )

                // Question Card
                if let question = currentQuestion {
                    ScrollView {
                        QuestionCard(
                            question: question,
                            answer: answerBinding(for: question)
                        )
                        .padding(OptaDesign.Spacing.lg)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                        .id(question.id)
                    }
                } else if questions.isEmpty {
                    // No Questions - Direct to Result
                    noQuestionsView
                }

                Spacer()

                // Navigation Buttons
                navigationButtons
                    .padding(.horizontal, OptaDesign.Spacing.lg)
                    .padding(.bottom, OptaDesign.Spacing.xl)
            }
        }
    }

    // MARK: - Subviews

    private var noQuestionsView: some View {
        VStack(spacing: OptaDesign.Spacing.lg) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(Color.optaGreen)
                .accessibilityHidden(true)

            Text("Ready to optimize!")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            Text("Opta has enough information to provide your recommendation.")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(OptaDesign.Spacing.xl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Ready to optimize. Opta has enough information to provide your recommendation.")
    }

    private var navigationButtons: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            // Back Button
            if currentQuestionIndex > 0 {
                Button(action: goToPreviousQuestion) {
                    HStack(spacing: OptaDesign.Spacing.xs) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(.optaBody)
                    .foregroundStyle(Color.optaTextSecondary)
                    .padding(.horizontal, OptaDesign.Spacing.lg)
                    .padding(.vertical, OptaDesign.Spacing.md)
                    .glassSubtle()
                }
                .accessibilityLabel("Go to previous question")
            }

            Spacer()

            // Next/Submit Button
            if questions.isEmpty || isLastQuestion {
                submitButton
            } else {
                nextButton
            }
        }
    }

    private var submitButton: some View {
        Button(action: handleSubmit) {
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "sparkles")
                Text("Get Results")
            }
            .font(.optaBody)
            .fontWeight(.semibold)
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
        }
        .accessibilityLabel("Get optimization results")
        .accessibilityHint("Submit your answers and receive personalized recommendations")
        .disabled(!canContinue && !questions.isEmpty)
        .opacity(canContinue || questions.isEmpty ? 1.0 : 0.5)
    }

    private var nextButton: some View {
        Button(action: goToNextQuestion) {
            HStack(spacing: OptaDesign.Spacing.xs) {
                Text("Next")
                Image(systemName: "chevron.right")
            }
            .font(.optaBody)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, OptaDesign.Spacing.xl)
            .padding(.vertical, OptaDesign.Spacing.md)
            .background(Color.optaPurple)
            .clipShape(Capsule())
        }
        .accessibilityLabel("Go to next question")
        .disabled(!canContinue)
        .opacity(canContinue ? 1.0 : 0.5)
    }

    // MARK: - Helper Methods

    /// Creates a binding for the answer to a specific question
    private func answerBinding(for question: OptimizationQuestion) -> Binding<String> {
        Binding(
            get: { answers[question.id] ?? "" },
            set: { answers[question.id] = $0 }
        )
    }

    private func goToPreviousQuestion() {
        withAnimation(.optaSpring) {
            currentQuestionIndex -= 1
        }
        OptaHaptics.shared.tap()
    }

    private func goToNextQuestion() {
        withAnimation(.optaSpring) {
            currentQuestionIndex += 1
        }
        OptaHaptics.shared.tap()
    }

    private func handleSubmit() {
        OptaHaptics.shared.doubleTap()
        onSubmit()
    }
}

// MARK: - Questions Header

/// Header with close button, progress indicator, and understanding text
private struct QuestionsHeader: View {

    let understanding: String
    let currentIndex: Int
    let totalCount: Int
    let onBack: () -> Void

    private enum Layout {
        static let closeButtonSize: CGFloat = 32
        static let closeIconSize: CGFloat = 16
        static let progressBarHeight: CGFloat = 4
    }

    /// Progress percentage for the progress bar
    private var progressWidth: CGFloat {
        guard totalCount > 0 else { return 0 }
        return CGFloat(currentIndex + 1) / CGFloat(totalCount)
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            // Top Row: Close Button and Progress Text
            HStack {
                Button(action: onBack) {
                    Image(systemName: "xmark")
                        .font(.system(size: Layout.closeIconSize, weight: .medium))
                        .foregroundStyle(Color.optaTextSecondary)
                        .frame(width: Layout.closeButtonSize, height: Layout.closeButtonSize)
                        .glassSubtle()
                }
                .accessibilityLabel("Close questions")
                .accessibilityHint("Returns to the previous screen")

                Spacer()

                if totalCount > 0 {
                    Text("\(currentIndex + 1) of \(totalCount)")
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)
                        .accessibilityLabel("Question \(currentIndex + 1) of \(totalCount)")
                }
            }

            // Progress Bar
            if totalCount > 0 {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.optaSurface)
                            .frame(height: Layout.progressBarHeight)

                        Capsule()
                            .fill(Color.optaPurple)
                            .frame(width: geometry.size.width * progressWidth, height: Layout.progressBarHeight)
                            .animation(.optaSpring, value: currentIndex)
                    }
                }
                .frame(height: Layout.progressBarHeight)
                .accessibilityHidden(true)
            }

            // Understanding Text
            Text(understanding)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .padding(OptaDesign.Spacing.lg)
    }
}

// MARK: - Question Card

/// Card displaying a single question with appropriate input type
private struct QuestionCard: View {

    let question: OptimizationQuestion
    @Binding var answer: String

    private enum Defaults {
        static let minSliderValue: Double = 0
        static let maxSliderValue: Double = 100
        static let defaultSliderValue: Double = 50
        static let textPlaceholder = "Enter your answer..."
        static let multiChoiceSeparator = ","
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.lg) {
            // Question Text
            Text(question.text)
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)
                .accessibilityAddTraits(.isHeader)

            // Answer Input (based on type)
            answerInput
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }

    @ViewBuilder
    private var answerInput: some View {
        switch question.type {
        case .singleChoice:
            SingleChoiceInput(
                options: question.options ?? [],
                selection: $answer
            )

        case .multiChoice:
            MultiChoiceInput(
                options: question.options ?? [],
                selection: multiChoiceBinding
            )

        case .text:
            TextInput(
                placeholder: question.placeholder ?? Defaults.textPlaceholder,
                text: $answer
            )

        case .slider:
            SliderInput(
                min: question.min ?? Defaults.minSliderValue,
                max: question.max ?? Defaults.maxSliderValue,
                value: sliderBinding
            )
        }
    }

    /// Binding for multi-choice selection (converts between Set and comma-separated String)
    private var multiChoiceBinding: Binding<Set<String>> {
        Binding(
            get: {
                Set(answer
                    .components(separatedBy: Defaults.multiChoiceSeparator)
                    .filter { !$0.isEmpty })
            },
            set: { answer = $0.joined(separator: Defaults.multiChoiceSeparator) }
        )
    }

    /// Binding for slider value (converts between Double and String)
    private var sliderBinding: Binding<Double> {
        Binding(
            get: { Double(answer) ?? question.defaultValue ?? Defaults.defaultSliderValue },
            set: { answer = String(format: "%.0f", $0) }
        )
    }
}

// MARK: - Single Choice Input

/// Radio-button style single selection input
private struct SingleChoiceInput: View {

    let options: [String]
    @Binding var selection: String

    private enum Layout {
        static let checkmarkSize: CGFloat = 20
        static let selectedBackgroundOpacity: Double = 0.1
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            ForEach(options, id: \.self) { option in
                let isSelected = selection == option

                Button {
                    withAnimation(.optaSpring) {
                        selection = option
                    }
                    OptaHaptics.shared.selectionChanged()
                } label: {
                    HStack {
                        Text(option)
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)

                        Spacer()

                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: Layout.checkmarkSize))
                            .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextMuted)
                    }
                    .padding(OptaDesign.Spacing.md)
                    .background(isSelected ? Color.optaPurple.opacity(Layout.selectedBackgroundOpacity) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous)
                            .stroke(isSelected ? Color.optaPurple : Color.optaBorder, lineWidth: 1)
                    )
                }
                .accessibilityLabel(option)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Multi Choice Input

/// Checkbox-style multi-selection input
private struct MultiChoiceInput: View {

    let options: [String]
    @Binding var selection: Set<String>

    private enum Layout {
        static let checkboxSize: CGFloat = 20
        static let selectedBackgroundOpacity: Double = 0.1
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            ForEach(options, id: \.self) { option in
                let isSelected = selection.contains(option)

                Button {
                    withAnimation(.optaSpring) {
                        selection.formSymmetricDifference([option])
                    }
                    OptaHaptics.shared.selectionChanged()
                } label: {
                    HStack {
                        Text(option)
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)

                        Spacer()

                        Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                            .font(.system(size: Layout.checkboxSize))
                            .foregroundStyle(isSelected ? Color.optaPurple : Color.optaTextMuted)
                    }
                    .padding(OptaDesign.Spacing.md)
                    .background(isSelected ? Color.optaPurple.opacity(Layout.selectedBackgroundOpacity) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous)
                            .stroke(isSelected ? Color.optaPurple : Color.optaBorder, lineWidth: 1)
                    )
                }
                .accessibilityLabel(option)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Select multiple options")
    }
}

// MARK: - Text Input

/// Multi-line text input field
private struct TextInput: View {

    let placeholder: String
    @Binding var text: String

    private enum Layout {
        static let minLines = 3
        static let maxLines = 6
    }

    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .font(.optaBody)
            .foregroundStyle(Color.optaTextPrimary)
            .padding(OptaDesign.Spacing.md)
            .background(Color.optaSurface)
            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
            .lineLimit(Layout.minLines...Layout.maxLines)
            .textInputAutocapitalization(.sentences)
            .autocorrectionDisabled(false)
    }
}

// MARK: - Slider Input

/// Numeric slider input with min/max labels
private struct SliderInput: View {

    let min: Double
    let max: Double
    @Binding var value: Double

    private enum Layout {
        static let sliderStep: Double = 1
    }

    /// Formatted display value
    private var formattedValue: String {
        String(format: "%.0f", value)
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            // Value Labels
            HStack {
                Text(String(format: "%.0f", min))
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)

                Spacer()

                Text(formattedValue)
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaPurple)
                    .contentTransition(.numericText())

                Spacer()

                Text(String(format: "%.0f", max))
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
            }

            // Slider
            Slider(value: $value, in: min...max, step: Layout.sliderStep)
                .tint(Color.optaPurple)
                .onChange(of: value) { _, _ in
                    OptaHaptics.shared.selectionChanged()
                }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(formattedValue)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment:
                value = Swift.min(value + Layout.sliderStep, max)
            case .decrement:
                value = Swift.max(value - Layout.sliderStep, min)
            @unknown default:
                break
            }
        }
    }
}

#Preview {
    QuestionsView(
        analysisResult: AnalysisResult(
            understanding: "You want to find the best value option",
            questions: [
                OptimizationQuestion(
                    id: "q1",
                    text: "What's your budget range?",
                    type: .singleChoice,
                    options: ["Under $10", "$10-$20", "$20-$30", "Over $30"],
                    placeholder: nil,
                    min: nil,
                    max: nil,
                    defaultValue: nil
                )
            ],
            rawResponse: ""
        ),
        answers: .constant([:]),
        onSubmit: {},
        onBack: {}
    )
}
