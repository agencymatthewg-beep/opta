//
//  OnboardingView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @State private var currentPage = 0
    @State private var botName = ""
    @State private var botHost = ""
    @State private var botPort = "18793"
    @State private var botToken = ""
    @State private var animateIn = false

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            TabView(selection: $currentPage) {
                // Page 1: Welcome
                welcomePage.tag(0)
                // Page 2: How it works
                connectPage.tag(1)
                // Page 3: Add first bot
                addBotPage.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .animation(.spring(response: 0.5, dampingFraction: 0.8), value: currentPage)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) { animateIn = true }
        }
    }

    // MARK: - Page 1

    private var welcomePage: some View {
        VStack(spacing: 24) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.optaPrimary.opacity(0.15))
                    .frame(width: 140, height: 140)
                    .blur(radius: 20)

                Text("O+")
                    .font(.system(size: 64, weight: .black, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(colors: [.optaPrimary, .optaCyan], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
            }
            .scaleEffect(animateIn ? 1 : 0.5)
            .opacity(animateIn ? 1 : 0)

            VStack(spacing: 8) {
                Text("Your AI Command Center")
                    .font(.title.bold())
                    .foregroundColor(.optaTextPrimary)

                Text("Chat with any OpenClaw bot.\nPremium experience, zero compromise.")
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }

            Spacer()

            nextButton("Get Started")
        }
        .padding(32)
    }

    // MARK: - Page 2

    private var connectPage: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "network")
                .font(.system(size: 56))
                .foregroundStyle(
                    LinearGradient(colors: [.optaPrimary, .optaCyan], startPoint: .top, endPoint: .bottom)
                )
                .symbolEffect(.pulse, options: .repeating)

            VStack(spacing: 8) {
                Text("Connect to Any Bot")
                    .font(.title2.bold())
                    .foregroundColor(.optaTextPrimary)

                Text("Point OptaPlus at any OpenClaw gateway.\nJust provide a host, port, and optional token.")
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }

            // Visual illustration
            HStack(spacing: 16) {
                connectionCard(icon: "iphone", label: "OptaPlus")
                Image(systemName: "arrow.right")
                    .foregroundColor(.optaPrimary)
                connectionCard(icon: "server.rack", label: "host:port")
                Image(systemName: "arrow.right")
                    .foregroundColor(.optaPrimary)
                connectionCard(icon: "cpu", label: "Bot")
            }
            .padding(.top, 8)

            Spacer()

            nextButton("Next")
        }
        .padding(32)
    }

    private func connectionCard(icon: String, label: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.optaPrimary)
            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
        }
        .frame(width: 70, height: 60)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaSurface)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.optaBorder, lineWidth: 1))
        )
    }

    // MARK: - Page 3

    private var addBotPage: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("🚀")
                .font(.system(size: 48))

            Text("Add Your First Bot")
                .font(.title2.bold())
                .foregroundColor(.optaTextPrimary)

            VStack(spacing: 12) {
                onboardingField("Bot Name", text: $botName, icon: "person.fill")
                onboardingField("Host", text: $botHost, icon: "globe")
                onboardingField("Port", text: $botPort, icon: "number")
                    .keyboardType(.numberPad)
                onboardingField("Token (optional)", text: $botToken, icon: "key.fill")
            }
            .padding(.horizontal, 4)

            Spacer()

            Button {
                addBotAndFinish()
            } label: {
                Text("Launch OptaPlus")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(canAdd
                                ? LinearGradient(colors: [.optaPrimary, .optaPrimary.opacity(0.7)], startPoint: .leading, endPoint: .trailing)
                                : LinearGradient(colors: [Color.gray.opacity(0.3), Color.gray.opacity(0.3)], startPoint: .leading, endPoint: .trailing)
                            )
                    )
            }
            .disabled(!canAdd)

            Button("Skip for now") {
                UserDefaults.standard.set(true, forKey: "optaplus.onboardingDone")
            }
            .font(.subheadline)
            .foregroundColor(.optaTextMuted)
            .padding(.bottom, 8)
        }
        .padding(32)
    }

    private func onboardingField(_ placeholder: String, text: Binding<String>, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.optaPrimary)
                .frame(width: 20)
            TextField(placeholder, text: text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundColor(.optaTextPrimary)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.optaElevated)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.optaBorder, lineWidth: 1))
        )
    }

    private var canAdd: Bool {
        !botName.isEmpty && !botHost.isEmpty && (Int(botPort) ?? 0) > 0
    }

    private func nextButton(_ label: String) -> some View {
        Button {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentPage += 1
            }
        } label: {
            Text(label)
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(LinearGradient(colors: [.optaPrimary, .optaPrimary.opacity(0.7)], startPoint: .leading, endPoint: .trailing))
                )
        }
    }

    private func addBotAndFinish() {
        let port = Int(botPort) ?? 18793
        let bot = BotConfig(name: botName, host: botHost, port: port, token: botToken, emoji: "🤖")
        appState.addBot(bot)
        appState.selectBot(bot)
        UserDefaults.standard.set(true, forKey: "optaplus.onboardingDone")
    }
}
