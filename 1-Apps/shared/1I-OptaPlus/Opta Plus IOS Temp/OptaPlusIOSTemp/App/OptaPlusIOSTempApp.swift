import SwiftUI
import OptaPlus
import OptaMolt

@main
struct OptaPlusIOSTempApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var pairingCoordinator = PairingCoordinator()
    @ObservedObject private var themeManager = ThemeManager.shared

    var body: some Scene {
        WindowGroup {
            TempRootView()
                .environmentObject(appState)
                .environmentObject(pairingCoordinator)
                .environmentObject(themeManager)
                .environment(\.fontScaleOffset, themeManager.fontScale.offset)
                .environment(\.chatDensity, themeManager.chatDensity)
                .environment(\.backgroundMode, themeManager.backgroundMode)
                .preferredColorScheme(.dark)
                .onAppear {
                    AppState.shared = appState
                    if let bot = appState.selectedBot {
                        appState.selectBot(bot)
                    }
                    appState.syncWidgetData()
                }
                .onOpenURL { url in
                    if let info = PairingCoordinator.parseDeepLink(url) {
                        pairingCoordinator.pendingPairingInfo = info
                    }
                    if url.scheme == "optaplus" && url.host == "send",
                       let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                       let message = components.queryItems?.first(where: { $0.name == "message" })?.value {
                        let botId = components.queryItems?.first(where: { $0.name == "bot" })?.value
                        if let botId, !botId.isEmpty, let bot = appState.bots.first(where: { $0.id == botId }) {
                            appState.selectBot(bot)
                            let vm = appState.viewModel(for: bot)
                            Task { await vm.send(message) }
                        } else if let bot = appState.selectedBot {
                            let vm = appState.viewModel(for: bot)
                            Task { await vm.send(message) }
                        }
                    }
                }
        }
    }
}
