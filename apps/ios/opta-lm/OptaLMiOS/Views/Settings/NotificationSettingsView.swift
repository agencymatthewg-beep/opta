import SwiftUI

struct NotificationSettingsView: View {
    @State private var settingsManager = NotificationSettingsManager.shared
    @State private var showQuietHoursSheet = false
    @State private var showTestSheet = false

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            List {
                // Master toggle
                Section {
                    Toggle(isOn: Binding(
                        get: { settingsManager.settings.masterEnabled },
                        set: { _ in
                            settingsManager.toggleMasterSwitch()
                            HapticManager.shared.impact(.medium)
                        }
                    )) {
                        HStack(spacing: 16) {
                            Image(systemName: "bell.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(Color.optaPrimary)
                                .frame(width: 28)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Notifications")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundStyle(Color.optaTextPrimary)

                                Text("Enable all notifications")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.optaTextSecondary)
                            }
                        }
                    }
                    .tint(Color.optaPrimary)
                    .listRowBackground(Color.optaGlassBackground)
                }

                // Per-type toggles
                if settingsManager.settings.masterEnabled {
                    Section {
                        ForEach(OptaNotificationType.allCases) { type in
                            NotificationTypeRow(
                                type: type,
                                settings: settingsManager.settings.settings(for: type),
                                onToggle: {
                                    settingsManager.toggleType(type)
                                },
                                onToggleSound: {
                                    settingsManager.toggleSound(for: type)
                                },
                                onDebounceChange: { interval in
                                    settingsManager.updateDebounce(for: type, interval: interval)
                                }
                            )
                        }
                    } header: {
                        Text("Alert Types")
                            .foregroundStyle(Color.optaTextSecondary)
                    } footer: {
                        Text("Customize which events trigger notifications")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }

                // Global settings
                if settingsManager.settings.masterEnabled {
                    Section {
                        Toggle(isOn: Binding(
                            get: { settingsManager.settings.badgeEnabled },
                            set: { _ in
                                settingsManager.toggleBadge()
                                HapticManager.shared.impact(.light)
                            }
                        )) {
                            HStack(spacing: 16) {
                                Image(systemName: "app.badge")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color.optaPrimary)
                                    .frame(width: 28)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Badge Count")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(Color.optaTextPrimary)

                                    Text("Show badge on app icon")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.optaTextSecondary)
                                }
                            }
                        }
                        .tint(Color.optaPrimary)
                        .listRowBackground(Color.optaGlassBackground)

                        Toggle(isOn: Binding(
                            get: { settingsManager.settings.foregroundNotifications },
                            set: { _ in
                                settingsManager.toggleForegroundNotifications()
                                HapticManager.shared.impact(.light)
                            }
                        )) {
                            HStack(spacing: 16) {
                                Image(systemName: "app.fill")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color.optaPrimary)
                                    .frame(width: 28)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("In-App Alerts")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(Color.optaTextPrimary)

                                    Text("Show when app is open")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.optaTextSecondary)
                                }
                            }
                        }
                        .tint(Color.optaPrimary)
                        .listRowBackground(Color.optaGlassBackground)

                        Button {
                            showQuietHoursSheet = true
                            HapticManager.shared.impact(.light)
                        } label: {
                            HStack(spacing: 16) {
                                Image(systemName: "moon.fill")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color.optaPrimary)
                                    .frame(width: 28)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Quiet Hours")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(Color.optaTextPrimary)

                                    Text(settingsManager.settings.quietHours.enabled
                                        ? "Enabled"
                                        : "Disabled")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.optaTextSecondary)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Color.optaTextMuted)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Behavior")
                            .foregroundStyle(Color.optaTextSecondary)
                    }
                }

                // History & Test
                Section {
                    NavigationLink {
                        NotificationHistoryView()
                    } label: {
                        HStack(spacing: 16) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(Color.optaNeonBlue)
                                .frame(width: 28)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Notification History")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundStyle(Color.optaTextPrimary)

                                Text("Past 7 days")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.optaTextSecondary)
                            }
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    Button {
                        showTestSheet = true
                        HapticManager.shared.impact(.light)
                    } label: {
                        HStack(spacing: 16) {
                            Image(systemName: "testtube.2")
                                .font(.system(size: 20))
                                .foregroundStyle(Color.optaPrimary)
                                .frame(width: 28)

                            Text("Test Notifications")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Color.optaTextPrimary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.optaTextMuted)
                        }
                    }
                    .listRowBackground(Color.optaGlassBackground)

                    Button(role: .destructive) {
                        settingsManager.resetToDefaults()
                        HapticManager.shared.notification(.success)
                    } label: {
                        HStack(spacing: 16) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 20))
                                .foregroundStyle(Color.optaNeonRed)
                                .frame(width: 28)

                            Text("Reset to Defaults")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Color.optaNeonRed)
                        }
                    }
                    .listRowBackground(Color.optaNeonRed.opacity(0.1))
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showQuietHoursSheet) {
            QuietHoursSheet()
        }
        .sheet(isPresented: $showTestSheet) {
            NotificationTestSheet()
        }
    }
}
