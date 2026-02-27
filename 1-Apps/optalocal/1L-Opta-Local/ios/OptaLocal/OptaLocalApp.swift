import SwiftUI

@main
struct OptaLocalApp: App {
    @State private var connectionManager = ConnectionManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(connectionManager)
                .preferredColorScheme(.dark)
        }
    }
}

struct ContentView: View {
    @Environment(ConnectionManager.self) private var connectionManager

    var body: some View {
        TabView {
            Tab("Dashboard", systemImage: "gauge.open.with.lines.needle.33percent") {
                DashboardView()
            }
            Tab("Chat", systemImage: "bubble.left.and.bubble.right") {
                ChatView()
            }
            Tab("Sessions", systemImage: "clock.arrow.circlepath") {
                SessionListView()
            }
            Tab("Settings", systemImage: "gear") {
                SettingsView()
            }
        }
        .tint(OptaColors.primary)
    }
}
