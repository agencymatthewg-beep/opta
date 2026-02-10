import SwiftUI

struct QuietHoursSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var settingsManager = NotificationSettingsManager.shared

    @State private var enabled: Bool
    @State private var startHour: Int
    @State private var startMinute: Int
    @State private var endHour: Int
    @State private var endMinute: Int
    @State private var allowCritical: Bool

    init() {
        let config = NotificationSettingsManager.shared.settings.quietHours
        _enabled = State(initialValue: config.enabled)
        _startHour = State(initialValue: config.startHour)
        _startMinute = State(initialValue: config.startMinute)
        _endHour = State(initialValue: config.endHour)
        _endMinute = State(initialValue: config.endMinute)
        _allowCritical = State(initialValue: config.allowCritical)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                List {
                    Section {
                        Toggle(isOn: $enabled) {
                            HStack(spacing: 16) {
                                Image(systemName: "moon.fill")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color.optaPrimary)
                                    .frame(width: 28)

                                Text("Enable Quiet Hours")
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundStyle(Color.optaTextPrimary)
                            }
                        }
                        .tint(Color.optaPrimary)
                        .listRowBackground(Color.optaGlassBackground)
                        .onChange(of: enabled) { _, _ in
                            HapticManager.shared.impact(.light)
                        }
                    }

                    if enabled {
                        Section {
                            // Start time picker
                            HStack {
                                Text("Start Time")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.optaTextPrimary)

                                Spacer()

                                Picker("Hour", selection: $startHour) {
                                    ForEach(0..<24, id: \.self) { hour in
                                        Text(String(format: "%02d", hour))
                                            .tag(hour)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(Color.optaPrimary)

                                Text(":")
                                    .foregroundStyle(Color.optaTextSecondary)

                                Picker("Minute", selection: $startMinute) {
                                    ForEach([0, 15, 30, 45], id: \.self) { minute in
                                        Text(String(format: "%02d", minute))
                                            .tag(minute)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(Color.optaPrimary)
                            }
                            .listRowBackground(Color.optaGlassBackground)

                            // End time picker
                            HStack {
                                Text("End Time")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.optaTextPrimary)

                                Spacer()

                                Picker("Hour", selection: $endHour) {
                                    ForEach(0..<24, id: \.self) { hour in
                                        Text(String(format: "%02d", hour))
                                            .tag(hour)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(Color.optaPrimary)

                                Text(":")
                                    .foregroundStyle(Color.optaTextSecondary)

                                Picker("Minute", selection: $endMinute) {
                                    ForEach([0, 15, 30, 45], id: \.self) { minute in
                                        Text(String(format: "%02d", minute))
                                            .tag(minute)
                                    }
                                }
                                .pickerStyle(.menu)
                                .tint(Color.optaPrimary)
                            }
                            .listRowBackground(Color.optaGlassBackground)
                        } header: {
                            Text("Schedule")
                                .foregroundStyle(Color.optaTextSecondary)
                        }

                        Section {
                            Toggle(isOn: $allowCritical) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Allow Critical Alerts")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(Color.optaTextPrimary)

                                    Text("Tasks and events will still notify during quiet hours")
                                        .font(.system(size: 13))
                                        .foregroundStyle(Color.optaTextSecondary)
                                }
                            }
                            .tint(Color.optaPrimary)
                            .listRowBackground(Color.optaGlassBackground)
                            .onChange(of: allowCritical) { _, _ in
                                HapticManager.shared.impact(.light)
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Quiet Hours")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundStyle(Color.optaTextSecondary)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        saveAndDismiss()
                    }
                    .foregroundStyle(Color.optaPrimary)
                }
            }
            .toolbarBackground(Color.optaVoid, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private func saveAndDismiss() {
        let config = QuietHoursConfig(
            enabled: enabled,
            startHour: startHour,
            startMinute: startMinute,
            endHour: endHour,
            endMinute: endMinute,
            allowCritical: allowCritical
        )

        settingsManager.updateQuietHours(config)
        HapticManager.shared.notification(.success)
        dismiss()
    }
}
