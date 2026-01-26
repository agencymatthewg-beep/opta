import SwiftUI

struct ContentView: View {
    @ObservedObject var processMonitor: ProcessMonitor

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Opta Mini")
                    .font(.title2.bold())

                Text("\(processMonitor.runningCount) of \(OptaApp.allApps.count) apps running")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            // App list
            ForEach(OptaApp.allApps) { app in
                AppRowView(app: app, isRunning: processMonitor.isRunning(app))
            }

            Spacer()
        }
        .padding()
        .frame(width: 300, height: 400)
    }
}

struct AppRowView: View {
    let app: OptaApp
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 12) {
            // Status indicator
            Circle()
                .fill(isRunning ? Color.green : Color.gray.opacity(0.3))
                .frame(width: 8, height: 8)

            // App icon
            Image(systemName: app.icon)
                .font(.title3)
                .foregroundColor(isRunning ? .primary : .secondary)
                .frame(width: 24)

            // App name
            Text(app.name)
                .font(.body)
                .foregroundColor(isRunning ? .primary : .secondary)

            Spacer()

            // Status text
            Text(isRunning ? "Running" : "Stopped")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    ContentView(processMonitor: ProcessMonitor())
}
