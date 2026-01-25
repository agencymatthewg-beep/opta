//
//  RootView.swift
//  OptaNative
//
//  Main navigation container for the Opta Native app.
//  Integrates the Radial Menu Layout for the home screen and handles transitions.
//  Created for Opta Native macOS - Plan 103-01 (v12.0)
//

import SwiftUI

/// Sidebar navigation item enum
enum NavigationItem: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case gameSession = "Game Booster"
    case gamification = "Achievements"
    case optimization = "Optimization"
    case conflicts = "Health"
    case chess = "Chess"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .dashboard: return "gauge.with.dots.needle.bottom.50percent"
        case .gameSession: return "gamecontroller.fill"
        case .gamification: return "trophy.fill"
        case .optimization: return "slider.horizontal.3"
        case .conflicts: return "stethoscope"
        case .chess: return "crown.fill"
        }
    }
}

struct RootView: View {
    @State private var selection: NavigationItem? = nil // Nil means Home/Radial Menu
    
    // Environment
    @Environment(TelemetryViewModel.self) private var telemetry
    
    var body: some View {
        ZStack {
            // Background Atmosphere (Global)
            Color.optaVoid.ignoresSafeArea()
            
            // Fog/Glow layers
            RadialGradient(
                colors: [Color.optaNeonPurple.opacity(0.15), .clear],
                center: .topLeading,
                startRadius: 0,
                endRadius: 800
            )
            .ignoresSafeArea()
            .blur(radius: 50)
            
            // Content Switcher
            if let activeSelection = selection {
                // Detail View
                ZStack(alignment: .topLeading) {
                    // Content
                    switch activeSelection {
                    case .dashboard:
                        MainWindowView()
                    case .gameSession:
                        GameSessionView()
                    case .gamification:
                        GamificationDashboard()
                    case .optimization:
                        OptimizationView()
                    case .conflicts:
                        ConflictView()
                    case .chess:
                        ChessBoardView()
                    }
                    
                    // Back Button
                    Button(action: {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            selection = nil
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "chevron.left")
                            Text("Back to Orbit")
                        }
                        .font(.opta(size: 14, weight: .medium))
                        .foregroundStyle(Color.optaTextSecondary)
                        .padding(12)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding()
                    .transition(.move(edge: .leading).combined(with: .opacity))
                }
                .transition(.opacity.animation(.easeInOut(duration: 0.3)))
                
            } else {
                // Radial Menu (Home)
                RadialMenuLayout(selectedItem: $selection)
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
            }
            
            // Global Overlays
            VisualEffectsOverlay()
        }
        .preferredColorScheme(.dark)
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: selection)
    }
}

#Preview {
    RootView()
        .environment(TelemetryViewModel.preview)
}
