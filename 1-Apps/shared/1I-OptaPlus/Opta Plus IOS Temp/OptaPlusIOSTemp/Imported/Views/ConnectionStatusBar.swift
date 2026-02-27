//
//  ConnectionStatusBar.swift
//  OptaPlusIOS
//
//  Persistent status bar showing connection state.
//  Shows at top of chat view. Animated transitions between states.
//  Cinematic Void design tokens.
//

import SwiftUI
import OptaMolt

// MARK: - Connection Status Bar

struct ConnectionStatusBar: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var isVisible = false
    @State private var pulseOpacity: Double = 1.0
    
    private var shouldShow: Bool {
        viewModel.connectionState != .connected
    }
    
    var body: some View {
        if shouldShow {
            HStack(spacing: 8) {
                // Animated indicator
                statusIcon
                
                // Status text
                VStack(alignment: .leading, spacing: 1) {
                    Text(statusTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                    if let subtitle = statusSubtitle {
                        Text(subtitle)
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.6))
                    }
                }
                
                Spacer()
                
                // Action button
                if viewModel.connectionState == .disconnected {
                    Button("Retry") {
                        HapticManager.shared.light()
                        viewModel.connect()
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.white.opacity(0.15)))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(statusBackground)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    isVisible = true
                }
            }
        }
    }
    
    // MARK: - Status Icon
    
    @ViewBuilder
    private var statusIcon: some View {
        switch viewModel.connectionState {
        case .connecting:
            ProgressView()
                .scaleEffect(0.7)
                .tint(.white)
        case .reconnecting:
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#F59E0B"))
        case .disconnected:
            Image(systemName: "wifi.slash")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(hex: "#EF4444"))
        case .connected:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#22C55E"))
        }
    }
    
    // MARK: - Status Text
    
    private var statusTitle: String {
        switch viewModel.connectionState {
        case .connecting: "Connecting..."
        case .reconnecting: "Reconnecting..."
        case .disconnected: "Disconnected"
        case .connected: "Connected"
        }
    }
    
    private var statusSubtitle: String? {
        switch viewModel.connectionState {
        case .connecting:
            return "Establishing connection"
        case .reconnecting:
            if let countdown = viewModel.reconnectCountdown {
                return "Retrying in \(countdown)s"
            }
            return "Attempting to recover connection"
        case .disconnected:
            if let countdown = viewModel.reconnectCountdown {
                return "Retrying in \(countdown)s"
            }
            return "Tap Retry to reconnect"
        case .connected:
            return nil
        }
    }
    
    // MARK: - Background
    
    private var statusBackground: some View {
        Group {
            switch viewModel.connectionState {
            case .connecting:
                Color(hex: "#F59E0B").opacity(0.15)
            case .reconnecting:
                Color(hex: "#F59E0B").opacity(0.18)
            case .disconnected:
                Color(hex: "#EF4444").opacity(0.15)
            case .connected:
                Color(hex: "#22C55E").opacity(0.15)
            }
        }
    }
}

// MARK: - Compact Connection Dot

/// Small dot indicator for use in headers/toolbars.
struct ConnectionDot: View {
    let state: ConnectionState
    @State private var isPulsing = false
    
    var body: some View {
        Circle()
            .fill(dotColor)
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .stroke(dotColor.opacity(0.4), lineWidth: isPulsing ? 3 : 0)
                    .scaleEffect(isPulsing ? 1.8 : 1.0)
                    .opacity(isPulsing ? 0 : 1)
            )
            .onAppear {
                if state == .connecting || state == .reconnecting {
                    withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: false)) {
                        isPulsing = true
                    }
                }
            }
            .onChange(of: state) { _, newState in
                isPulsing = false
                if newState == .connecting || newState == .reconnecting {
                    withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: false)) {
                        isPulsing = true
                    }
                }
            }
    }
    
    private var dotColor: Color {
        switch state {
        case .connected: Color(hex: "#22C55E")
        case .connecting: Color(hex: "#F59E0B")
        case .reconnecting: Color(hex: "#F59E0B")
        case .disconnected: Color(hex: "#EF4444")
        }
    }
}

// MARK: - Global Connection Status Overlay

/// An overlay that shows connection status for all bots.
/// Designed to sit at the top of the main content area.
struct GlobalConnectionOverlay: View {
    @EnvironmentObject var appState: AppState
    
    private var disconnectedBots: [BotConfig] {
        appState.bots.filter { bot in
            let vm = appState.viewModel(for: bot)
            return vm.connectionState == .disconnected
        }
    }
    
    var body: some View {
        if !disconnectedBots.isEmpty {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#F59E0B"))
                    
                    Text("\(disconnectedBots.count) bot\(disconnectedBots.count == 1 ? "" : "s") offline")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                    
                    Spacer()
                    
                    Button("Reconnect All") {
                        HapticManager.shared.medium()
                        for bot in disconnectedBots {
                            appState.viewModel(for: bot).connect()
                        }
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: "#F59E0B"))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color(hex: "#F59E0B").opacity(0.1))
            }
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}
