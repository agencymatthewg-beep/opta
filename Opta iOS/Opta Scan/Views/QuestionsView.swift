//
//  QuestionsView.swift
//  Opta Scan
//
//  Dynamic question flow from Claude analysis
//  Created by Matthew Byrden
//

import SwiftUI

struct QuestionsView: View {

    let analysisResult: AnalysisResult
    @Binding var answers: [String: String]
    var onSubmit: () -> Void
    var onBack: () -> Void

    @State private var currentQuestionIndex = 0

    private var questions: [OptimizationQuestion] {
        analysisResult.questions
    }

    private var currentQuestion: OptimizationQuestion? {
        guard currentQuestionIndex < questions.count else { return nil }
        return questions[currentQuestionIndex]
    }

    private var isLastQuestion: Bool {
        currentQuestionIndex >= questions.count - 1
    }

    private var canContinue: Bool {
        guard let question = currentQuestion else { return false }
        return answers[question.id] != nil && !answers[question.id]!.isEmpty
    }

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

                // Question card
                if let question = currentQuestion {
                    ScrollView {
                        QuestionCard(
                            question: question,
                            answer: Binding(
                                get: { answers[question.id] ?? "" },
                                set: { answers[question.id] = $0 }
                            )
                        )
                        .padding(OptaDesign.Spacing.lg)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                        .id(question.id)
                    }
                } else if questions.isEmpty {
                    // No questions - direct to result
                    VStack(spacing: OptaDesign.Spacing.lg) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(Color.optaGreen)

                        Text("Ready to optimize!")
                            .font(.optaHeadline)
                            .foregroundStyle(Color.optaTextPrimary)

                        Text("Opta has enough information to provide your recommendation.")
                            .font(.optaCaption)
                            .foregroundStyle(Color.optaTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(OptaDesign.Spacing.xl)
                }

                Spacer()

                // Navigation buttons
                HStack(spacing: OptaDesign.Spacing.md) {
                    if currentQuestionIndex > 0 {
                        Button {
                            withAnimation(.optaSpring) {
                                currentQuestionIndex -= 1
                            }
                            OptaHaptics.shared.tap()
                        } label: {
                            HStack {
                                Image(systemName: "chevron.left")
                                Text("Back")
                            }
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextSecondary)
                            .padding(.horizontal, OptaDesign.Spacing.lg)
                            .padding(.vertical, OptaDesign.Spacing.md)
                            .glassSubtle()
                        }
                    }

                    Spacer()

                    if questions.isEmpty || isLastQuestion {
                        Button {
                            onSubmit()
                        } label: {
                            HStack {
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
                        .disabled(!canContinue && !questions.isEmpty)
                        .opacity(canContinue || questions.isEmpty ? 1.0 : 0.5)
                    } else {
                        Button {
                            withAnimation(.optaSpring) {
                                currentQuestionIndex += 1
                            }
                            OptaHaptics.shared.tap()
                        } label: {
                            HStack {
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
                        .disabled(!canContinue)
                        .opacity(canContinue ? 1.0 : 0.5)
                    }
                }
                .padding(.horizontal, OptaDesign.Spacing.lg)
                .padding(.bottom, OptaDesign.Spacing.xl)
            }
        }
    }
}

// MARK: - Questions Header

private struct QuestionsHeader: View {
    let understanding: String
    let currentIndex: Int
    let totalCount: Int
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            HStack {
                Button(action: onBack) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color.optaTextSecondary)
                        .frame(width: 32, height: 32)
                        .glassSubtle()
                }

                Spacer()

                if totalCount > 0 {
                    Text("\(currentIndex + 1) of \(totalCount)")
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)
                }
            }

            if totalCount > 0 {
                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.optaSurface)
                            .frame(height: 4)

                        Capsule()
                            .fill(Color.optaPurple)
                            .frame(width: geometry.size.width * CGFloat(currentIndex + 1) / CGFloat(totalCount), height: 4)
                            .animation(.optaSpring, value: currentIndex)
                    }
                }
                .frame(height: 4)
            }

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

private struct QuestionCard: View {
    let question: OptimizationQuestion
    @Binding var answer: String

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.lg) {
            // Question text
            Text(question.text)
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            // Answer input based on type
            switch question.type {
            case .singleChoice:
                SingleChoiceInput(
                    options: question.options ?? [],
                    selection: $answer
                )

            case .multiChoice:
                MultiChoiceInput(
                    options: question.options ?? [],
                    selection: Binding(
                        get: { Set(answer.components(separatedBy: ",").filter { !$0.isEmpty }) },
                        set: { answer = $0.joined(separator: ",") }
                    )
                )

            case .text:
                TextInput(
                    placeholder: question.placeholder ?? "Enter your answer...",
                    text: $answer
                )

            case .slider:
                SliderInput(
                    min: question.min ?? 0,
                    max: question.max ?? 100,
                    value: Binding(
                        get: { Double(answer) ?? question.defaultValue ?? 50 },
                        set: { answer = String(format: "%.0f", $0) }
                    )
                )
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }
}

// MARK: - Single Choice Input

private struct SingleChoiceInput: View {
    let options: [String]
    @Binding var selection: String

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            ForEach(options, id: \.self) { option in
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

                        Image(systemName: selection == option ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 20))
                            .foregroundStyle(selection == option ? Color.optaPurple : Color.optaTextMuted)
                    }
                    .padding(OptaDesign.Spacing.md)
                    .background(selection == option ? Color.optaPurple.opacity(0.1) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous)
                            .stroke(selection == option ? Color.optaPurple : Color.optaBorder, lineWidth: 1)
                    )
                }
            }
        }
    }
}

// MARK: - Multi Choice Input

private struct MultiChoiceInput: View {
    let options: [String]
    @Binding var selection: Set<String>

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            ForEach(options, id: \.self) { option in
                Button {
                    withAnimation(.optaSpring) {
                        if selection.contains(option) {
                            selection.remove(option)
                        } else {
                            selection.insert(option)
                        }
                    }
                    OptaHaptics.shared.selectionChanged()
                } label: {
                    HStack {
                        Text(option)
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)

                        Spacer()

                        Image(systemName: selection.contains(option) ? "checkmark.square.fill" : "square")
                            .font(.system(size: 20))
                            .foregroundStyle(selection.contains(option) ? Color.optaPurple : Color.optaTextMuted)
                    }
                    .padding(OptaDesign.Spacing.md)
                    .background(selection.contains(option) ? Color.optaPurple.opacity(0.1) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous)
                            .stroke(selection.contains(option) ? Color.optaPurple : Color.optaBorder, lineWidth: 1)
                    )
                }
            }
        }
    }
}

// MARK: - Text Input

private struct TextInput: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .font(.optaBody)
            .foregroundStyle(Color.optaTextPrimary)
            .padding(OptaDesign.Spacing.md)
            .background(Color.optaSurface)
            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
            .lineLimit(3...6)
    }
}

// MARK: - Slider Input

private struct SliderInput: View {
    let min: Double
    let max: Double
    @Binding var value: Double

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            HStack {
                Text(String(format: "%.0f", min))
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)

                Spacer()

                Text(String(format: "%.0f", value))
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaPurple)

                Spacer()

                Text(String(format: "%.0f", max))
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
            }

            Slider(value: $value, in: min...max, step: 1)
                .tint(Color.optaPurple)
                .onChange(of: value) { _, _ in
                    OptaHaptics.shared.selectionChanged()
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
