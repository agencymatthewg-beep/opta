//
//  CaptureButton.swift
//  Opta Scan
//
//  Primary capture button with animated states
//  Created by Matthew Byrden
//

import SwiftUI

struct CaptureButton: View {

    var isLoading: Bool = false
    var action: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button {
            OptaHaptics.shared.buttonPress()
            action()
        } label: {
            ZStack {
                // Outer ring
                Circle()
                    .stroke(Color.optaPurple.opacity(0.5), lineWidth: 4)
                    .frame(width: 72, height: 72)

                // Inner fill
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.optaPurple, Color.optaBlue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                    .scaleEffect(isPressed ? 0.9 : 1.0)

                // Loading indicator
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(1.2)
                } else {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    withAnimation(.optaSpring) {
                        isPressed = true
                    }
                }
                .onEnded { _ in
                    withAnimation(.optaSpring) {
                        isPressed = false
                    }
                }
        )
        .disabled(isLoading)
    }
}

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()
        VStack(spacing: 40) {
            CaptureButton(isLoading: false) {
                print("Capture!")
            }
            CaptureButton(isLoading: true) {
                print("Loading...")
            }
        }
    }
}
