//
//  ShaderDemoView.swift
//  Opta Scan
//
//  Development view for testing Metal shader effects
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

import SwiftUI

#if DEBUG
@available(iOS 17.0, *)
struct ShaderDemoView: View {
    @State private var tintIntensity: Double = 0.3
    @State private var brightness: Double = 0.0
    @State private var saturation: Double = 1.0
    @State private var glassDepth: Double = 0.5
    @State private var glassGlowIntensity: Double = 0.3

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Sample content to apply shaders to
                    sampleCard
                        .shaderTint(.optaPurple, intensity: tintIntensity)
                        .shaderBrightness(brightness)
                        .shaderSaturation(saturation)

                    // Controls
                    controlsSection

                    // Glass shader section
                    glassSection
                }
                .padding(OptaDesign.Spacing.lg)
            }
            .background(Color.optaBackground)
            .navigationTitle("Shader Demo")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var sampleCard: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.optaPurple)

            Text("Metal Shader Test")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            Text("Adjust sliders to see shader effects")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(OptaDesign.Spacing.xl)
        .glassContent()
    }

    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            Text("Shader Parameters")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Tint Intensity: \(tintIntensity, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $tintIntensity, in: 0...1)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Brightness: \(brightness, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $brightness, in: -0.5...0.5)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Saturation: \(saturation, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $saturation, in: 0...2)
                    .tint(.optaPurple)
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }

    // MARK: - Obsidian Glass Section

    private var glassSection: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            Text("Obsidian Glass")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            // Sample cards with different glass levels
            HStack(spacing: OptaDesign.Spacing.md) {
                glassLevelCard("Subtle", level: .subtle)
                glassLevelCard("Content", level: .content)
                glassLevelCard("Overlay", level: .overlay)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Custom Glass")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                Text("Depth: \(glassDepth, specifier: "%.2f")")
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
                Slider(value: $glassDepth, in: 0...1)
                    .tint(.optaPurple)

                Text("Glow: \(glassGlowIntensity, specifier: "%.2f")")
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
                Slider(value: $glassGlowIntensity, in: 0...1)
                    .tint(.optaPurple)
            }

            // Custom glass preview
            VStack {
                Image(systemName: "diamond.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.optaPurple)
                Text("Custom")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextPrimary)
            }
            .frame(maxWidth: .infinity)
            .padding(OptaDesign.Spacing.lg)
            .background(.thinMaterial)
            .obsidianGlass(
                depth: glassDepth,
                glowColor: .optaPurple,
                glowIntensity: glassGlowIntensity
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }

    private func glassLevelCard(_ title: String, level: ObsidianGlassLevel) -> some View {
        VStack {
            Image(systemName: "cube.fill")
                .font(.system(size: 24))
                .foregroundStyle(Color.optaPurple)
            Text(title)
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(OptaDesign.Spacing.md)
        .obsidianGlassStyle(level)
    }
}

#Preview {
    if #available(iOS 17.0, *) {
        ShaderDemoView()
    }
}
#endif
