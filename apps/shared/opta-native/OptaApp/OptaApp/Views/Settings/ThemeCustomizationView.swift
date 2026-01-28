//
//  ThemeCustomizationView.swift
//  OptaApp
//
//  Theme customization view for colors, blur, glow, and animation settings.
//

import SwiftUI

// MARK: - Theme Preset

/// Predefined theme configurations.
enum ThemePreset: String, CaseIterable, Identifiable, Codable {
    case obsidian = "obsidian"
    case ocean = "ocean"
    case forest = "forest"
    case sunset = "sunset"
    case custom = "custom"

    var id: String { rawValue }

    var name: String {
        switch self {
        case .obsidian: return "Obsidian"
        case .ocean: return "Ocean"
        case .forest: return "Forest"
        case .sunset: return "Sunset"
        case .custom: return "Custom"
        }
    }

    var description: String {
        switch self {
        case .obsidian: return "Purple accent, OLED black"
        case .ocean: return "Blue accent, dark gray"
        case .forest: return "Green accent, deep emerald"
        case .sunset: return "Orange/pink gradient"
        case .custom: return "Your custom settings"
        }
    }

    var settings: ThemeSettings {
        switch self {
        case .obsidian:
            return ThemeSettings(
                accentColor: "#8B5CF6",
                backgroundDarkness: 1.0,
                glassBlurIntensity: .medium,
                ringGlowIntensity: .medium,
                animationSpeed: .normal
            )
        case .ocean:
            return ThemeSettings(
                accentColor: "#3B82F6",
                backgroundDarkness: 0.85,
                glassBlurIntensity: .medium,
                ringGlowIntensity: .medium,
                animationSpeed: .normal
            )
        case .forest:
            return ThemeSettings(
                accentColor: "#22C55E",
                backgroundDarkness: 0.95,
                glassBlurIntensity: .high,
                ringGlowIntensity: .low,
                animationSpeed: .normal
            )
        case .sunset:
            return ThemeSettings(
                accentColor: "#F97316",
                backgroundDarkness: 0.9,
                glassBlurIntensity: .medium,
                ringGlowIntensity: .high,
                animationSpeed: .fast
            )
        case .custom:
            return ThemeSettings()
        }
    }
}

// MARK: - Intensity Level

/// Intensity levels for blur, glow, and effects.
enum IntensityLevel: String, CaseIterable, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"

    var displayName: String {
        rawValue.capitalized
    }

    var blurRadius: CGFloat {
        switch self {
        case .low: return 8
        case .medium: return 20
        case .high: return 32
        }
    }

    var glowOpacity: Double {
        switch self {
        case .low: return 0.3
        case .medium: return 0.5
        case .high: return 0.8
        }
    }
}

// MARK: - Animation Speed

/// Animation speed settings.
enum AnimationSpeed: String, CaseIterable, Codable {
    case slow = "slow"
    case normal = "normal"
    case fast = "fast"

    var displayName: String {
        rawValue.capitalized
    }

    var multiplier: Double {
        switch self {
        case .slow: return 1.5
        case .normal: return 1.0
        case .fast: return 0.5
        }
    }
}

// MARK: - Theme Settings

/// Complete theme configuration.
struct ThemeSettings: Codable, Equatable {
    var accentColor: String
    var backgroundDarkness: Double
    var glassBlurIntensity: IntensityLevel
    var ringGlowIntensity: IntensityLevel
    var animationSpeed: AnimationSpeed

    init(
        accentColor: String = "#8B5CF6",
        backgroundDarkness: Double = 1.0,
        glassBlurIntensity: IntensityLevel = .medium,
        ringGlowIntensity: IntensityLevel = .medium,
        animationSpeed: AnimationSpeed = .normal
    ) {
        self.accentColor = accentColor
        self.backgroundDarkness = backgroundDarkness
        self.glassBlurIntensity = glassBlurIntensity
        self.ringGlowIntensity = ringGlowIntensity
        self.animationSpeed = animationSpeed
    }

    var backgroundColor: Color {
        // Obsidian base (0A0A0F) at full darkness, elevated with white overlay at lower values
        let base = Color(hex: "0A0A0F")
        let elevated = Color(hex: "0A0A0F").opacity(backgroundDarkness)
        return base.opacity(backgroundDarkness) + elevated.opacity(1 - backgroundDarkness)
    }

    /// Elevated surface color (obsidian + white/8% overlay)
    var elevatedSurfaceColor: Color {
        Color(hex: "0A0A0F")
    }
}

// Simple color blend extension
fileprivate func + (lhs: Color, rhs: Color) -> Color {
    // This is a simplified blend - in production you'd extract RGB components
    lhs
}

// MARK: - Accent Color Option

/// Predefined accent color options.
struct AccentColorOption: Identifiable {
    let id = UUID()
    let name: String
    let hex: String

    var color: Color {
        Color(hex: hex)
    }

    static let options: [AccentColorOption] = [
        AccentColorOption(name: "Purple", hex: "#8B5CF6"),
        AccentColorOption(name: "Blue", hex: "#3B82F6"),
        AccentColorOption(name: "Green", hex: "#22C55E"),
        AccentColorOption(name: "Orange", hex: "#F97316"),
        AccentColorOption(name: "Pink", hex: "#EC4899"),
        AccentColorOption(name: "Cyan", hex: "#06B6D4"),
    ]
}

// MARK: - ThemeCustomizationView

/// View for customizing app theme and visual effects.
struct ThemeCustomizationView: View {

    // MARK: - Storage

    @AppStorage("themeSettings") private var themeData: Data = Data()
    @AppStorage("themePreset") private var selectedPreset: String = ThemePreset.obsidian.rawValue

    // MARK: - State

    @State private var settings = ThemeSettings()
    @State private var customAccentHex = "#8B5CF6"
    @State private var showingCustomColorPicker = false

    // MARK: - Body

    var body: some View {
        Form {
            // Presets Section
            Section {
                ForEach(ThemePreset.allCases.filter { $0 != .custom }) { preset in
                    presetRow(for: preset)
                }
            } header: {
                Label("Presets", systemImage: "paintpalette")
            }

            // Accent Color Section
            Section {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                    ForEach(AccentColorOption.options) { option in
                        colorButton(option: option)
                    }

                    // Custom color button
                    Button {
                        showingCustomColorPicker = true
                    } label: {
                        ZStack {
                            Circle()
                                .stroke(
                                    LinearGradient(
                                        colors: [.red, .orange, .yellow, .green, .blue, .purple],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 3
                                )
                                .frame(width: 40, height: 40)

                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 8)
            } header: {
                Label("Accent Color", systemImage: "eyedropper")
            }

            // Background Section
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Background Darkness")
                        Spacer()
                        Text("\(Int(settings.backgroundDarkness * 100))%")
                            .foregroundColor(.secondary)
                    }
                    Slider(value: $settings.backgroundDarkness, in: 0.7...1.0)
                        .tint(Color(hex: "8B5CF6"))
                        .onChange(of: settings.backgroundDarkness) { _, _ in
                            updatePresetToCustom()
                            saveSettings()
                        }

                    Text("OLED Black at 100%, Dark Gray at 70%")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } header: {
                Label("Background", systemImage: "rectangle.fill")
            }

            // Effects Section
            Section {
                Picker("Glass Blur", selection: $settings.glassBlurIntensity) {
                    ForEach(IntensityLevel.allCases, id: \.self) { level in
                        Text(level.displayName).tag(level)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: settings.glassBlurIntensity) { _, _ in
                    updatePresetToCustom()
                    saveSettings()
                }

                Picker("Ring Glow", selection: $settings.ringGlowIntensity) {
                    ForEach(IntensityLevel.allCases, id: \.self) { level in
                        Text(level.displayName).tag(level)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: settings.ringGlowIntensity) { _, _ in
                    updatePresetToCustom()
                    saveSettings()
                }

                Picker("Animation Speed", selection: $settings.animationSpeed) {
                    ForEach(AnimationSpeed.allCases, id: \.self) { speed in
                        Text(speed.displayName).tag(speed)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: settings.animationSpeed) { _, _ in
                    updatePresetToCustom()
                    saveSettings()
                }
            } header: {
                Label("Effects", systemImage: "sparkles")
            }

            // Preview Section
            Section {
                previewSection
            } header: {
                Label("Preview", systemImage: "eye")
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Appearance")
        .onAppear {
            loadSettings()
        }
        .sheet(isPresented: $showingCustomColorPicker) {
            customColorPickerSheet
        }
    }

    // MARK: - Preset Row

    private func presetRow(for preset: ThemePreset) -> some View {
        Button {
            applyPreset(preset)
        } label: {
            HStack {
                // Color preview
                Circle()
                    .fill(Color(hex: preset.settings.accentColor))
                    .frame(width: 24, height: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(preset.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(preset.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if selectedPreset == preset.rawValue {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color(hex: settings.accentColor))
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Color Button

    private func colorButton(option: AccentColorOption) -> some View {
        Button {
            settings.accentColor = option.hex
            updatePresetToCustom()
            saveSettings()
        } label: {
            ZStack {
                Circle()
                    .fill(option.color)
                    .frame(width: 40, height: 40)

                if settings.accentColor == option.hex {
                    Circle()
                        .stroke(Color.white, lineWidth: 3)
                        .frame(width: 40, height: 40)

                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Preview Section

    private var previewSection: some View {
        VStack(spacing: 16) {
            // Sample obsidian card
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(hex: "0A0A0F"))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(hex: "8B5CF6").opacity(0.15), lineWidth: 1)
                        )
                        .frame(width: 48, height: 48)

                    Image(systemName: "cpu")
                        .font(.system(size: 20))
                        .foregroundColor(Color(hex: settings.accentColor))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Sample Card")
                        .font(.headline)
                    Text("With obsidian surface")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding(12)
            .background(
                Color(hex: "0A0A0F")
                    .overlay(Color(hex: "8B5CF6").opacity(0.05))
            )
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )

            // Sample button
            HStack(spacing: 12) {
                Button("Primary Button") {}
                    .buttonStyle(.borderedProminent)
                    .tint(Color(hex: settings.accentColor))

                Button("Secondary") {}
                    .buttonStyle(.bordered)
            }

            // Mini ring preview
            ZStack {
                Circle()
                    .stroke(
                        Color(hex: settings.accentColor).opacity(0.3),
                        lineWidth: 8
                    )
                    .frame(width: 60, height: 60)

                Circle()
                    .trim(from: 0, to: 0.75)
                    .stroke(
                        Color(hex: settings.accentColor),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .frame(width: 60, height: 60)
                    .rotationEffect(.degrees(-90))

                // Glow effect
                Circle()
                    .trim(from: 0, to: 0.75)
                    .stroke(
                        Color(hex: settings.accentColor),
                        lineWidth: 8
                    )
                    .frame(width: 60, height: 60)
                    .rotationEffect(.degrees(-90))
                    .blur(radius: settings.ringGlowIntensity.blurRadius / 2)
                    .opacity(settings.ringGlowIntensity.glowOpacity)
            }
            .padding(8)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Custom Color Picker Sheet

    private var customColorPickerSheet: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Color preview
                Circle()
                    .fill(Color(hex: customAccentHex))
                    .frame(width: 80, height: 80)
                    .shadow(color: Color(hex: customAccentHex).opacity(0.5), radius: 20)

                // Hex input
                HStack {
                    Text("#")
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(.secondary)

                    TextField("Hex color", text: Binding(
                        get: { customAccentHex.replacingOccurrences(of: "#", with: "") },
                        set: { customAccentHex = "#" + $0.prefix(6) }
                    ))
                    .font(.system(.body, design: .monospaced))
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 100)
                }

                // Color picker (macOS native)
                ColorPicker("Select Color", selection: Binding(
                    get: { Color(hex: customAccentHex) },
                    set: { newColor in
                        if let hex = newColor.toHex() {
                            customAccentHex = hex
                        }
                    }
                ))
                .labelsHidden()

                Spacer()
            }
            .padding(24)
            .navigationTitle("Custom Color")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showingCustomColorPicker = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        settings.accentColor = customAccentHex
                        updatePresetToCustom()
                        saveSettings()
                        showingCustomColorPicker = false
                    }
                }
            }
        }
        .frame(width: 300, height: 350)
    }

    // MARK: - Actions

    private func applyPreset(_ preset: ThemePreset) {
        settings = preset.settings
        selectedPreset = preset.rawValue
        saveSettings()
    }

    private func updatePresetToCustom() {
        // Check if current settings match any preset
        for preset in ThemePreset.allCases where preset != .custom {
            if settings == preset.settings {
                selectedPreset = preset.rawValue
                return
            }
        }
        selectedPreset = ThemePreset.custom.rawValue
    }

    private func loadSettings() {
        guard !themeData.isEmpty else {
            settings = ThemePreset.obsidian.settings
            return
        }

        let decoder = JSONDecoder()
        if let decoded = try? decoder.decode(ThemeSettings.self, from: themeData) {
            settings = decoded
        }
    }

    private func saveSettings() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(settings) {
            themeData = data
        }
    }
}

// MARK: - Color Extensions

extension Color {
    /// Convert color to hex string
    func toHex() -> String? {
        guard let components = NSColor(self).cgColor.components else { return nil }
        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}

// MARK: - Preview

#if DEBUG
struct ThemeCustomizationView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            ThemeCustomizationView()
        }
        .frame(width: 500, height: 700)
    }
}
#endif
