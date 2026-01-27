//
//  OptaRingView.swift
//  OptaNative
//
//  Opta Ring v3.0 - Generative Asset Implementation
//  Replaces programmatic drawing with high-fidelity generated 3D assets.
//  Falls back to LegacyOptaRingView (v2.1) if assets are missing.
//

import SwiftUI
import AppKit

struct OptaRingView: View {
    // MARK: - Configuration
    
    /// Energy level (0.0 = dormant, 0.5 = active, 1.0 = exploding)
    var energy: Double = 0.5
    
    // MARK: - Integration State
    
    // Asset Name
    private let assetName = "opta_ring_v3"
    
    // Check if asset exists
    private var hasAsset: Bool {
        NSImage(named: assetName) != nil
    }
    
    // MARK: - Animation State
    @State private var energyRotation: Double = 0
    @State private var energyRotation2: Double = 0
    @State private var pulseScale: Double = 1.0
    @State private var glowOpacity: Double = 0.3
    @State private var aberrationOffset: Double = 0.0
    @State private var isAnimating = false
    
    var body: some View {
        Group {
            if hasAsset {
                assetBasedView
            } else {
                // Fallback to simple programmatic version
                fallbackRingView
            }
        }
    }
    
    // MARK: - Fallback Programmatic Ring

    private var fallbackRingView: some View {
        ZStack {
            // Ambient glow
            Circle()
                .fill(Color.optaNeonPurple)
                .blur(radius: 40)
                .opacity(0.3 * energy)
                .scaleEffect(1.1)

            // Outer ring
            Circle()
                .strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.optaNeonPurple,
                            Color.optaElectricBlue,
                            Color.optaNeonPurple
                        ],
                        center: .center
                    ),
                    lineWidth: 20
                )
                .frame(width: 280, height: 280)
                .rotationEffect(.degrees(energyRotation))

            // Inner ring
            Circle()
                .strokeBorder(
                    Color.optaNeonPurple.opacity(0.5),
                    lineWidth: 8
                )
                .frame(width: 240, height: 240)
        }
        .frame(width: 320, height: 320)
        .rotation3DEffect(
            .degrees(25),
            axis: (x: 1.0, y: 0.0, z: 0.0)
        )
        .onAppear {
            startAnimations()
        }
    }
    
    // MARK: - Asset Based Implementation
    
    private var assetBasedView: some View {
        ZStack {
            // 1. Dynamic Ambient Glow (Breathing)
            Circle()
                .fill(Color.optaNeonPurple)
                .blur(radius: 60 + (10 * energy))
                .opacity(glowOpacity * energy)
                .scaleEffect(1.2 + (0.1 * pulseScale))
            
            // 2. Chromatic Aberration Layers (High Energy Only)
            // Simulates lens distortion at high power levels
            if energy > 0.6 {
                // Red Channel Shift
                Image(assetName)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 320, height: 320)
                    .colorMultiply(.red)
                    .offset(x: aberrationOffset, y: 0)
                    .blendMode(.screen)
                    .opacity(0.5)
                
                // Blue Channel Shift
                Image(assetName)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 320, height: 320)
                    .colorMultiply(.blue)
                    .offset(x: -aberrationOffset, y: 0)
                    .blendMode(.screen)
                    .opacity(0.5)
            }
            
            // 3. Main High-Fidelity 3D Asset
            Image(assetName)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 320, height: 320)
                .shadow(color: .black.opacity(0.5), radius: 20, x: 0, y: 10)
                
            // 4. Multi-Layer Energy Turbulence
            // Internal movement simulation
            Group {
                // Layer A: Clockwise Slow
                energyGradient(opacity: 0.3 * energy)
                    .rotationEffect(.degrees(energyRotation))
                
                // Layer B: Counter-Clockwise Fast (Turbulence)
                energyGradient(opacity: 0.2 * energy)
                    .rotationEffect(.degrees(energyRotation2))
                    .scaleEffect(0.9)
            }
            .scaleEffect(pulseScale)
            .blendMode(.overlay)
            .mask {
                // Mask roughly to the ring shape
                 Circle()
                    .strokeBorder(Color.white, lineWidth: 60)
            }
            
            // 5. Specular Glint Rotation
            Circle()
                .strokeBorder(
                    AngularGradient(
                        colors: [.clear, .white.opacity(0.4), .clear],
                        center: .center
                    ),
                    lineWidth: 4
                )
                .rotationEffect(.degrees(-energyRotation * 0.5))
                .blur(radius: 5)
                .blendMode(.overlay)
                .scaleEffect(0.9)
                
        }
        .frame(width: 320, height: 320)
        // Apply the same 3D tilt as the spec requires
        .rotation3DEffect(
            .degrees(25),
            axis: (x: 1.0, y: 0.0, z: 0.0)
        )
        .onAppear {
            startAnimations()
        }
    }
    
    private func energyGradient(opacity: Double) -> some View {
        Circle()
            .strokeBorder(
                AngularGradient(
                    colors: [
                        .clear,
                        .optaNeonPurple.opacity(opacity),
                        .clear,
                        .optaElectricBlue.opacity(opacity * 0.7),
                        .clear
                    ],
                    center: .center,
                    startAngle: .degrees(0),
                    endAngle: .degrees(360)
                ),
                lineWidth: 60
            )
    }
    
    private func startAnimations() {
        guard !isAnimating else { return }
        isAnimating = true
        
        // 1. Primary Rotation (Clockwise)
        withAnimation(.linear(duration: 12).repeatForever(autoreverses: false)) {
            energyRotation = 360
        }
        
        // 2. Secondary Rotation (Counter-Clockwise - Turbulence)
        withAnimation(.linear(duration: 7).repeatForever(autoreverses: false)) {
            energyRotation2 = -360
        }
        
        // 3. Organic Breathing (Pulse)
        withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) {
            pulseScale = 1.05
        }
        
        // 4. Ambient Glow Breath
        withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) {
            glowOpacity = 0.5
        }
        
        // 5. Chromatic Aberration Jitter (High Energy)
        // Adds a nervous, powerful vibration at high energy
        if energy > 0.6 {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.2, blendDuration: 0).repeatForever(autoreverses: true)) {
                aberrationOffset = 2.0
            }
        }
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        OptaRingView(energy: 0.8)
    }
}
