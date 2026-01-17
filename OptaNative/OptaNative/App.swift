import SwiftUI

@main
struct OptaNativeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 400, height: 600)

        MenuBarExtra("Opta", systemImage: "bolt.fill") {
            MenuBarView()
        }
        .menuBarExtraStyle(.window)
    }
}

struct ContentView: View {
    var body: some View {
        Text("Opta Native")
            .font(.largeTitle)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MenuBarView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("Opta Native")
                .font(.headline)
            Text("Menu Bar View")
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(width: 200)
    }
}
