//
//  OnboardingView.swift
//  Opta Scan
//
//  First-time user onboarding experience
//  Created by Matthew Byrden
//

import SwiftUI

struct OnboardingView: View {

    @Binding var hasCompletedOnboarding: Bool
    @State private var currentPage = 0

    private let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "camera.fill",
            title: "Capture Anything",
            description: "Point your camera at any product, menu, document, or screenshot to begin optimizing.",
            color: .optaPurple
        ),
        OnboardingPage(
            icon: "questionmark.bubble.fill",
            title: "Answer Quick Questions",
            description: "Opta asks smart follow-up questions to understand exactly what matters to you.",
            color: .optaBlue
        ),
        OnboardingPage(
            icon: "sparkles",
            title: "Get Optimized Results",
            description: "Receive personalized recommendations ranked by your preferences.",
            color: .optaGreen
        )
    ]

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button
                HStack {
                    Spacer()
                    Button("Skip") {
                        completeOnboarding()
                    }
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextMuted)
                    .padding(OptaDesign.Spacing.lg)
                }

                Spacer()

                // Page content
                TabView(selection: $currentPage) {
                    ForEach(pages.indices, id: \.self) { index in
                        OnboardingPageView(page: pages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.optaSpringGentle, value: currentPage)

                // Page indicators
                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { index in
                        Circle()
                            .fill(index == currentPage ? Color.optaPurple : Color.optaSurface)
                            .frame(width: index == currentPage ? 10 : 8, height: index == currentPage ? 10 : 8)
                            .animation(.optaSpring, value: currentPage)
                    }
                }
                .padding(.bottom, OptaDesign.Spacing.xl)

                // Continue / Get Started button
                Button {
                    if currentPage < pages.count - 1 {
                        withAnimation(.optaSpring) {
                            currentPage += 1
                        }
                        OptaHaptics.shared.tap()
                    } else {
                        completeOnboarding()
                    }
                } label: {
                    Text(currentPage < pages.count - 1 ? "Continue" : "Get Started")
                        .font(.optaBody)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, OptaDesign.Spacing.md)
                        .background(
                            LinearGradient(
                                colors: [Color.optaPurple, Color.optaBlue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                }
                .padding(.horizontal, OptaDesign.Spacing.xl)
                .padding(.bottom, OptaDesign.Spacing.xxl)
            }
        }
    }

    private func completeOnboarding() {
        OptaHaptics.shared.success()
        withAnimation(.optaSpringGentle) {
            hasCompletedOnboarding = true
        }
    }
}

// MARK: - Onboarding Page Model

private struct OnboardingPage {
    let icon: String
    let title: String
    let description: String
    let color: Color
}

// MARK: - Onboarding Page View

private struct OnboardingPageView: View {
    let page: OnboardingPage

    @State private var isVisible = false

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.xl) {
            // Icon
            ZStack {
                Circle()
                    .fill(page.color.opacity(0.15))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [page.color, page.color.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)

                Image(systemName: page.icon)
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(.white)
            }
            .scaleEffect(isVisible ? 1 : 0.8)
            .opacity(isVisible ? 1 : 0)

            VStack(spacing: OptaDesign.Spacing.md) {
                Text(page.title)
                    .font(.optaTitle)
                    .foregroundStyle(Color.optaTextPrimary)
                    .multilineTextAlignment(.center)

                Text(page.description)
                    .font(.optaBody)
                    .foregroundStyle(Color.optaTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            .padding(.horizontal, OptaDesign.Spacing.xl)
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 20)
        }
        .onAppear {
            withAnimation(.optaSpringGentle.delay(0.1)) {
                isVisible = true
            }
        }
        .onDisappear {
            isVisible = false
        }
    }
}

#Preview {
    OnboardingView(hasCompletedOnboarding: .constant(false))
}
