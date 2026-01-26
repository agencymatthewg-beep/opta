import SwiftUI

struct ContentView: View {
    @ObservedObject var processMonitor: ProcessMonitor

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Opta Mini")
                    .font(.system(size: 14, weight: .semibold))

                Text("\(processMonitor.runningCount) of \(OptaApp.allApps.count) apps running")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            Divider()
                .padding(.horizontal, 8)

            // App list
            VStack(spacing: 2) {
                ForEach(OptaApp.allApps) { app in
                    AppRowView(
                        app: app,
                        isRunning: processMonitor.isRunning(app),
                        onLaunch: { processMonitor.launch(app) },
                        onStop: { processMonitor.stop(app) }
                    )
                }
            }
            .padding(.vertical, 8)

            Spacer()

            // Footer
            Divider()
                .padding(.horizontal, 8)

            FooterView(
                runningCount: processMonitor.runningCount,
                onQuitAll: { processMonitor.stopAll() }
            )
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .frame(width: 280, height: 300)
    }
}

struct AppRowView: View {
    let app: OptaApp
    let isRunning: Bool
    let onLaunch: () -> Void
    let onStop: () -> Void
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 12) {
            // Status indicator
            Circle()
                .fill(isRunning ? Color.green : Color.gray.opacity(0.3))
                .frame(width: 8, height: 8)

            // App icon
            Image(systemName: app.icon)
                .font(.system(size: 18))
                .foregroundColor(isRunning ? .primary : .secondary)
                .frame(width: 24)

            // App name
            Text(app.name)
                .font(.system(size: 13))
                .foregroundColor(isRunning ? .primary : .secondary)

            Spacer()

            // Action button (shown on hover) or status text
            if isHovered {
                Button(action: isRunning ? onStop : onLaunch) {
                    Image(systemName: isRunning ? "stop.fill" : "play.fill")
                        .font(.system(size: 10))
                        .foregroundColor(isRunning ? .red : .green)
                }
                .buttonStyle(.plain)
                .help(isRunning ? "Stop" : "Launch")
            } else {
                Text(isRunning ? "Running" : "Stopped")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(isHovered ? Color.primary.opacity(0.1) : Color.clear)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if !isRunning {
                onLaunch()
            }
        }
        .onHover { hovering in
            isHovered = hovering
        }
        .padding(.horizontal, 4)
    }
}

struct FooterView: View {
    let runningCount: Int
    let onQuitAll: () -> Void

    var body: some View {
        HStack {
            if runningCount > 0 {
                Button("Quit All") {
                    onQuitAll()
                }
                .buttonStyle(.plain)
                .font(.system(size: 12))
                .foregroundColor(.red.opacity(0.8))
            }

            Spacer()

            Button {
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            } label: {
                Image(systemName: "gear")
                    .font(.system(size: 12))
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
            .help("Preferences")

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.plain)
            .font(.system(size: 12))
            .foregroundColor(.secondary)
        }
    }
}

#Preview {
    ContentView(processMonitor: ProcessMonitor())
}
