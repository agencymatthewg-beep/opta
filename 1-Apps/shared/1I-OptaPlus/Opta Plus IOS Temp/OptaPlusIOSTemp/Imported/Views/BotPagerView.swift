//
//  BotPagerView.swift
//  OptaPlusIOS
//
//  Horizontal pager that displays one page per bot with native swipe gestures.
//  Uses ScrollView + .scrollTargetBehavior(.paging) for proper disambiguation
//  with nested vertical scroll views (chat messages).
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Bot Pager View

struct BotPagerView<Content: View>: View {
    @EnvironmentObject var appState: AppState
    @State private var currentBotId: String?
    let content: (BotConfig) -> Content

    init(@ViewBuilder content: @escaping (BotConfig) -> Content) {
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            botIndicatorStrip
                .padding(.bottom, 4)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(appState.bots) { bot in
                        content(bot)
                            .containerRelativeFrame(.horizontal)
                            .id(bot.id)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $currentBotId)
            // Prevent edge swipe gesture conflicts on iPhone 15 / Dynamic Island devices.
            // The system back-swipe gesture zone (~20pt from edges) can intercept horizontal paging.
            .contentMargins(.horizontal, 0, for: .scrollIndicators)
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        }
        .background(Color.optaVoid)
        .onAppear {
            currentBotId = appState.selectedBotId ?? appState.bots.first?.id
        }
        .onChange(of: currentBotId) { _, newId in
            guard let newId, newId != appState.selectedBotId else { return }
            if let bot = appState.bots.first(where: { $0.id == newId }) {
                HapticManager.shared.selection()
                appState.selectBot(bot)
            }
        }
        .onChange(of: appState.selectedBotId) { _, newId in
            guard let newId, newId != currentBotId else { return }
            withAnimation(.optaSnap) {
                currentBotId = newId
            }
        }
    }

    // MARK: - Bot Indicator Strip

    private var botIndicatorStrip: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(appState.bots) { bot in
                        let isActive = bot.id == currentBotId
                        BotIndicatorCapsule(bot: bot, isActive: isActive)
                            .id("indicator-\(bot.id)")
                            .onTapGesture {
                                HapticManager.shared.selection()
                                withAnimation(.optaSpring) {
                                    currentBotId = bot.id
                                }
                            }
                            .accessibilityLabel("\(bot.emoji) \(bot.name)")
                            .accessibilityValue(isActive ? "Selected" : "Not selected")
                            .accessibilityHint("Double-tap to switch to \(bot.name)")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
            }
            .onChange(of: currentBotId) { _, newId in
                guard let newId else { return }
                withAnimation(.optaSnap) {
                    scrollProxy.scrollTo("indicator-\(newId)", anchor: .center)
                }
            }
        }
    }
}

// MARK: - Bot Indicator Capsule

private struct BotIndicatorCapsule: View {
    let bot: BotConfig
    let isActive: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 6) {
            Text(bot.emoji)
                .font(.system(size: isActive ? 16 : 14))

            if isActive {
                Text(bot.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, isActive ? 14 : 10)
        .padding(.vertical, 7)
        .background {
            if isActive {
                Capsule()
                    .fill(.thinMaterial)
                    .overlay(
                        Capsule()
                            .stroke(Color.optaPrimary.opacity(0.4), lineWidth: 1)
                    )
            } else {
                Capsule()
                    .fill(.ultraThinMaterial)
                    .overlay(
                        Capsule()
                            .stroke(Color.optaGlassBorder.opacity(0.15), lineWidth: 0.5)
                    )
            }
        }
        .opacity(isActive ? 1.0 : 0.5)
        .animation(reduceMotion ? .none : .optaSnap, value: isActive)
    }
}
