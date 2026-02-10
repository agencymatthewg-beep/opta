//
//  OptamizeSlider.swift
//  Opta Scan
//
//  "Optamize" depth slider - controls analysis thoroughness
//  Created by Matthew Byrden
//

import SwiftUI

struct OptamizeSlider: View {

    @Binding var depth: OptimizationDepth

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            // Header
            HStack {
                Text("Optamize")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                Spacer()

                Text(depth.rawValue)
                    .font(.optaCaption)
                    .fontWeight(.semibold)
                    .foregroundStyle(depth == .thorough ? Color.optaPurple : Color.optaTextPrimary)
            }

            // Slider
            HStack(spacing: OptaDesign.Spacing.md) {
                Image(systemName: "hare")
                    .font(.system(size: 14))
                    .foregroundStyle(depth == .quick ? Color.optaTextPrimary : Color.optaTextMuted)

                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Track background
                        Capsule()
                            .fill(Color.optaSurface)
                            .frame(height: 6)

                        // Active track
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [Color.optaPurple, Color.optaBlue],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: depth == .thorough ? geometry.size.width : geometry.size.width * 0.5, height: 6)

                        // Thumb
                        Circle()
                            .fill(Color.white)
                            .frame(width: 20, height: 20)
                            .shadow(color: Color.optaPurple.opacity(0.3), radius: 4)
                            .offset(x: depth == .thorough ? geometry.size.width - 20 : 0)
                    }
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let newDepth: OptimizationDepth = value.location.x > geometry.size.width / 2 ? .thorough : .quick
                                if newDepth != depth {
                                    withAnimation(.optaSpring) {
                                        depth = newDepth
                                    }
                                    OptaHaptics.shared.selectionChanged()
                                }
                            }
                    )
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            depth = depth == .quick ? .thorough : .quick
                        }
                        OptaHaptics.shared.selectionChanged()
                    }
                }
                .frame(height: 20)

                Image(systemName: "tortoise")
                    .font(.system(size: 14))
                    .foregroundStyle(depth == .thorough ? Color.optaTextPrimary : Color.optaTextMuted)
            }

            // Description
            Text(depth.description)
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextMuted)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(OptaDesign.Spacing.md)
        .glassSubtle()
    }
}

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()
        OptamizeSlider(depth: .constant(.quick))
            .padding()
    }
}
