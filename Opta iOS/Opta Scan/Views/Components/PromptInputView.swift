//
//  PromptInputView.swift
//  Opta Scan
//
//  Text prompt input with smart suggestions
//  Created by Matthew Byrden
//

import SwiftUI

struct PromptInputView: View {

    @Binding var prompt: String
    @FocusState private var isFocused: Bool
    var onSubmit: () -> Void

    // Smart suggestions based on context
    private let suggestions = [
        "best value for money",
        "healthiest option",
        "most popular choice",
        "cheapest option",
        "highest rated"
    ]

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            // Input field
            HStack(spacing: OptaDesign.Spacing.sm) {
                Image(systemName: "text.cursor")
                    .foregroundStyle(Color.optaTextSecondary)
                    .font(.system(size: 16))

                TextField("What do you want to optimize?", text: $prompt)
                    .font(.optaBody)
                    .foregroundStyle(Color.optaTextPrimary)
                    .focused($isFocused)
                    .submitLabel(.go)
                    .onSubmit {
                        if !prompt.isEmpty {
                            onSubmit()
                        }
                    }

                if !prompt.isEmpty {
                    Button {
                        withAnimation(.optaSpring) {
                            prompt = ""
                        }
                        OptaHaptics.shared.tap()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.optaTextSecondary)
                            .font(.system(size: 18))
                    }
                }
            }
            .padding(.horizontal, OptaDesign.Spacing.md)
            .padding(.vertical, OptaDesign.Spacing.md)
            .glassContent()

            // Smart suggestions
            if prompt.isEmpty && isFocused {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: OptaDesign.Spacing.sm) {
                        ForEach(suggestions, id: \.self) { suggestion in
                            SuggestionChip(text: suggestion) {
                                withAnimation(.optaSpring) {
                                    prompt = suggestion
                                }
                                OptaHaptics.shared.selectionChanged()
                            }
                        }
                    }
                    .padding(.horizontal, OptaDesign.Spacing.xs)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}

// MARK: - Suggestion Chip

private struct SuggestionChip: View {
    let text: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .padding(.horizontal, OptaDesign.Spacing.md)
                .padding(.vertical, OptaDesign.Spacing.sm)
                .glassSubtle()
        }
    }
}

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()
        VStack {
            Spacer()
            PromptInputView(prompt: .constant("")) {
                print("Submitted")
            }
            .padding()
        }
    }
}
