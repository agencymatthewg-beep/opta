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
}

#Preview {
    if #available(iOS 17.0, *) {
        ShaderDemoView()
    }
}
#endif
