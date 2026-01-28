//
//  OnboardingView.swift
//  Opta Scan
//
//  First-time user onboarding experience with animated page transitions
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Onboarding View

/// First-time user onboarding with three-step introduction to Opta
struct OnboardingView: View {

    // MARK: - Properties

    @Binding var hasCompletedOnboarding: Bool
    @State private var currentPage = 0

    // MARK: - Constants

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

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip Button
                HStack {
                    Spacer()
                    Button("Skip") {
                        completeOnboarding()
                    }
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextMuted)
                    .padding(OptaDesign.Spacing.lg)
                    .accessibilityLabel("Skip onboarding")
                    .accessibilityHint("Skips the introduction and goes directly to the app")
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

                // Page Indicators
                HStack(spacing: OptaDesign.Spacing.xs) {
                    ForEach(pages.indices, id: \.self) { index in
                        let isCurrentPage = index == currentPage
                        Circle()
                            .fill(isCurrentPage ? Color.optaPurple : Color.optaSurface)
                            .frame(width: isCurrentPage ? 10 : 8, height: isCurrentPage ? 10 : 8)
                            .animation(.optaSpring, value: currentPage)
                    }
                }
                .padding(.bottom, OptaDesign.Spacing.xl)
                .accessibilityLabel("Page \(currentPage + 1) of \(pages.count)")

                // Continue / Get Started Button
                Button {
                    advanceOrComplete()
                } label: {
                    let isLastPage = currentPage >= pages.count - 1
                    Text(isLastPage ? "Get Started" : "Continue")
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
                .accessibilityLabel(currentPage >= pages.count - 1 ? "Get started with Opta" : "Continue to next page")
                .padding(.horizontal, OptaDesign.Spacing.xl)
                .padding(.bottom, OptaDesign.Spacing.xxl)
            }
        }
    }

    // MARK: - Private Methods

    /// Advance to the next page or complete onboarding if on last page
    private func advanceOrComplete() {
        if currentPage < pages.count - 1 {
            withAnimation(.optaSpring) {
                currentPage += 1
            }
            OptaHaptics.shared.tap()
        } else {
            completeOnboarding()
        }
    }

    /// Mark onboarding as complete and transition to main app
    private func completeOnboarding() {
        OptaHaptics.shared.success()
        withAnimation(.optaSpringGentle) {
            hasCompletedOnboarding = true
        }
    }
}

// MARK: - Onboarding Page Model

/// Data model for a single onboarding page
private struct OnboardingPage {
    /// SF Symbol name for the page icon
    let icon: String
    /// Page headline text
    let title: String
    /// Page description text
    let description: String
    /// Accent color for the icon
    let color: Color
}

// MARK: - Onboarding Page View

/// Individual onboarding page with animated icon and text content
private struct OnboardingPageView: View {

    // MARK: - Properties

    let page: OnboardingPage
    @State private var isVisible = false

    // MARK: - Constants

    private enum Layout {
        static let outerCircleSize: CGFloat = 120
        static let innerCircleSize: CGFloat = 80
        static let iconSize: CGFloat = 36
        static let animationDelay: Double = 0.1
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.xl) {
            // Animated Icon
            iconView
                .scaleEffect(isVisible ? 1 : 0.8)
                .opacity(isVisible ? 1 : 0)

            // Text Content
            textContent
                .padding(.horizontal, OptaDesign.Spacing.xl)
                .opacity(isVisible ? 1 : 0)
                .offset(y: isVisible ? 0 : 20)
        }
        .onAppear {
            withAnimation(.optaSpringGentle.delay(Layout.animationDelay)) {
                isVisible = true
            }
        }
        .onDisappear {
            isVisible = false
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(page.title). \(page.description)")
    }

    // MARK: - Subviews

    private var iconView: some View {
        ZStack {
            Circle()
                .fill(page.color.opacity(0.15))
                .frame(width: Layout.outerCircleSize, height: Layout.outerCircleSize)

            Circle()
                .fill(
                    LinearGradient(
                        colors: [page.color, page.color.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: Layout.innerCircleSize, height: Layout.innerCircleSize)

            Image(systemName: page.icon)
                .font(.system(size: Layout.iconSize, weight: .medium))
                .foregroundStyle(.white)
        }
    }

    private var textContent: some View {
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
    }
}

#Preview {
    OnboardingView(hasCompletedOnboarding: .constant(false))
}
