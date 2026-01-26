import SwiftUI

struct ContentView: View {
    @ObservedObject var processMonitor: ProcessMonitor

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Opta Mini")
                    .font(OptaFonts.title)

                Text("\(processMonitor.runningCount) of \(OptaApp.allApps.count) apps running")
                    .font(OptaFonts.caption)
                    .foregroundColor(OptaColors.textSecondary)
                    .accessibilityLabel("\(processMonitor.runningCount) of \(OptaApp.allApps.count) Opta apps running")
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
    @State private var isPressed = false

    var body: some View {
        HStack(spacing: 12) {
            // Status indicator with animation
            Circle()
                .fill(isRunning ? OptaColors.success : OptaColors.inactive)
                .frame(width: 8, height: 8)
                .animation(.easeInOut(duration: OptaAnimations.standard), value: isRunning)

            // App icon
            Image(systemName: app.icon)
                .font(.system(size: 18))
                .foregroundColor(isRunning ? OptaColors.textPrimary : OptaColors.textSecondary)
                .frame(width: 24)
                .animation(.easeInOut(duration: OptaAnimations.standard), value: isRunning)

            // App name
            Text(app.name)
                .font(OptaFonts.body)
                .foregroundColor(isRunning ? OptaColors.textPrimary : OptaColors.textSecondary)
                .animation(.easeInOut(duration: OptaAnimations.standard), value: isRunning)

            Spacer()

            // Action button (shown on hover) or status text
            Group {
                if isHovered {
                    Button(action: isRunning ? onStop : onLaunch) {
                        Image(systemName: isRunning ? "stop.fill" : "play.fill")
                            .font(OptaFonts.small)
                            .foregroundColor(isRunning ? OptaColors.danger : OptaColors.success)
                    }
                    .buttonStyle(.plain)
                    .scaleEffect(isPressed ? 0.9 : 1.0)
                    .animation(.easeOut(duration: OptaAnimations.quick), value: isPressed)
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { _ in isPressed = true }
                            .onEnded { _ in isPressed = false }
                    )
                    .help(isRunning ? "Stop \(app.name)" : "Launch \(app.name)")
                    .accessibilityLabel(isRunning ? "Stop \(app.name)" : "Launch \(app.name)")
                } else {
                    Text(isRunning ? "Running" : "Stopped")
                        .font(OptaFonts.caption)
                        .foregroundColor(OptaColors.textSecondary)
                }
            }
            .frame(width: 50, alignment: .trailing)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(isHovered ? OptaColors.hover : Color.clear)
                .animation(.easeOut(duration: OptaAnimations.quick), value: isHovered)
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
        // Accessibility
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(app.name), \(isRunning ? "running" : "stopped")")
        .accessibilityHint(isRunning ? "Double tap to stop" : "Double tap to launch")
        .accessibilityAddTraits(isRunning ? .isSelected : [])
    }
}

struct FooterView: View {
    let runningCount: Int
    let onQuitAll: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            if runningCount > 0 {
                Button("Quit All") {
                    onQuitAll()
                }
                .buttonStyle(.plain)
                .font(OptaFonts.button)
                .foregroundColor(OptaColors.danger.opacity(0.9))
                .keyboardShortcut("q", modifiers: [.command, .shift])
                .help("Quit all running Opta apps (⇧⌘Q)")
                .accessibilityLabel("Quit all Opta apps")
                .accessibilityHint("Stops all \(runningCount) running apps")
            }

            Spacer()

            Button {
                NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
            } label: {
                Image(systemName: "gear")
                    .font(OptaFonts.button)
            }
            .buttonStyle(.plain)
            .foregroundColor(OptaColors.textSecondary)
            .keyboardShortcut(",", modifiers: .command)
            .help("Preferences (⌘,)")
            .accessibilityLabel("Open Preferences")

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.plain)
            .font(OptaFonts.button)
            .foregroundColor(OptaColors.textSecondary)
            .keyboardShortcut("q", modifiers: .command)
            .help("Quit Opta Mini (⌘Q)")
            .accessibilityLabel("Quit Opta Mini")
        }
    }
}

#Preview {
    ContentView(processMonitor: ProcessMonitor())
}
