import SwiftUI

struct NotificationTypeRow: View {
    let type: OptaNotificationType
    let settings: NotificationTypeSettings
    let onToggle: () -> Void
    let onToggleSound: () -> Void
    let onDebounceChange: (TimeInterval) -> Void

    @State private var showDetails = false

    var body: some View {
        VStack(spacing: 0) {
            // Main toggle row
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    showDetails.toggle()
                }
                HapticManager.shared.selection()
            } label: {
                HStack(spacing: 16) {
                    // Icon
                    Image(systemName: type.icon)
                        .font(.system(size: 20))
                        .foregroundStyle(settings.isEnabled ? Color.optaPrimary : Color.optaTextMuted)
                        .frame(width: 28)

                    // Title & description
                    VStack(alignment: .leading, spacing: 2) {
                        Text(type.displayName)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Color.optaTextPrimary)

                        Text(type.description)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.optaTextSecondary)
                    }

                    Spacer()

                    // Chevron
                    Image(systemName: showDetails ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.optaTextMuted)
                        .rotationEffect(.degrees(showDetails ? 180 : 0))

                    // Toggle
                    Toggle("", isOn: Binding(
                        get: { settings.isEnabled },
                        set: { _ in
                            onToggle()
                            HapticManager.shared.impact(.light)
                        }
                    ))
                    .labelsHidden()
                    .tint(Color.optaPrimary)
                }
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // Expanded details
            if showDetails && settings.isEnabled {
                VStack(spacing: 16) {
                    Divider()
                        .background(Color.optaGlassBorder)

                    // Sound toggle
                    Toggle(isOn: Binding(
                        get: { settings.soundEnabled },
                        set: { _ in
                            onToggleSound()
                            HapticManager.shared.impact(.light)
                        }
                    )) {
                        HStack(spacing: 12) {
                            Image(systemName: "speaker.wave.2.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(Color.optaTextSecondary)
                                .frame(width: 24)

                            Text("Sound")
                                .font(.system(size: 15))
                                .foregroundStyle(Color.optaTextPrimary)
                        }
                    }
                    .tint(Color.optaPrimary)

                    // Debounce slider (if applicable)
                    if settings.debounceInterval > 0 {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "timer")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.optaTextSecondary)
                                    .frame(width: 24)

                                Text("Debounce: \(Int(settings.debounceInterval / 60)) min")
                                    .font(.system(size: 15))
                                    .foregroundStyle(Color.optaTextPrimary)

                                Spacer()

                                Text("\(Int(settings.debounceInterval / 60))m")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color.optaTextMuted)
                            }

                            Slider(
                                value: Binding(
                                    get: { settings.debounceInterval },
                                    set: { newValue in
                                        onDebounceChange(newValue)
                                        HapticManager.shared.selection()
                                    }
                                ),
                                in: 60...600,
                                step: 60
                            )
                            .tint(Color.optaPrimary)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .listRowBackground(Color.optaGlassBackground)
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
    }
}
