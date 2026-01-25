//
//  GameSessionView.swift
//  OptaNative
//
//  Main view for game session tracking and benchmarking.
//  Allows starting/stopping sessions and viewing history.
//  Created for Opta Native macOS - Plan 96-01 (v12.0)
//

import SwiftUI
import Charts

struct GameSessionView: View {
    @State private var viewModel = GameSessionViewModel()
    @State private var gameName: String = ""
    @State private var isOptimized: Bool = true
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("Game Performance")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                if viewModel.isRecording {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 8, height: 8)
                        Text("REC")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(.red)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal)
            
            if viewModel.isRecording {
                // Recording State
                VStack(spacing: 30) {
                    // Timer
                    Text(viewModel.currentDuration)
                        .font(.system(size: 64, weight: .thin, design: .monospaced))
                        .contentTransition(.numericText())
                    
                    // Live Metrics Grid
                    HStack(spacing: 40) {
                        MetricDial(title: "FPS", value: viewModel.currentFPS, unit: "", color: .green, max: 240)
                        MetricDial(title: "CPU", value: viewModel.currentCPU, unit: "%", color: .blue, max: 100)
                    }
                    
                    Button(action: {
                        viewModel.stopRecording()
                    }) {
                        Text("Stop Session")
                            .font(.headline)
                            .padding(.horizontal, 30)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black.opacity(0.2))
                .cornerRadius(16)
                
            } else {
                // Idle State
                VStack(spacing: 20) {
                    // Start Form
                    GroupBox(label: Text("New Session")) {
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("Game Name (e.g. Cyberpunk 2077)", text: $gameName)
                                .textFieldStyle(.roundedBorder)
                            
                            Toggle("Opta Optimization Active", isOn: $isOptimized)
                            
                            Button(action: {
                                if !gameName.isEmpty {
                                    viewModel.startRecording(gameName: gameName, isOptimized: isOptimized)
                                }
                            }) {
                                Text("Start Recording")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(gameName.isEmpty)
                        }
                        .padding()
                    }
                    
                    // History List
                    VStack(alignment: .leading) {
                        Text("Recent Sessions")
                            .font(.headline)
                        
                        List(viewModel.sessions) { session in
                            NavigationLink(destination: GameSessionDetailView(session: session)) {
                                GameSessionRow(session: session)
                            }
                        }
                        .listStyle(.plain)
                        .frame(minHeight: 200)
                    }
                }
            }
        }
        .padding()
        .frame(minWidth: 500, minHeight: 400)
    }
}

// MARK: - Subviews

struct MetricDial: View {
    let title: String
    let value: Double
    let unit: String
    let color: Color
    let max: Double
    
    var body: some View {
        VStack {
            ZStack {
                Circle()
                    .stroke(color.opacity(0.2), lineWidth: 8)
                
                Circle()
                    .trim(from: 0, to: CGFloat(value / max))
                    .stroke(color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring, value: value)
                
                VStack(spacing: 0) {
                    Text(String(format: "%.0f", value))
                        .font(.title)
                        .fontWeight(.bold)
                    Text(unit)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 100, height: 100)
            
            Text(title)
                .font(.headline)
                .foregroundStyle(.secondary)
        }
    }
}

struct GameSessionRow: View {
    let session: GameSession
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(session.gameName)
                    .font(.body)
                    .fontWeight(.medium)
                HStack {
                    if session.wasOptimized {
                        Text("Optimized")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.2))
                            .foregroundStyle(.purple)
                            .cornerRadius(4)
                    }
                    Text(session.startTime.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing) {
                Text("\(Int(session.avgFPS)) FPS")
                    .font(.body)
                    .fontWeight(.bold)
                    .foregroundStyle(session.avgFPS > 60 ? .green : .orange)
                Text(formatDuration(session.duration))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration) / 60
        let s = Int(duration) % 60
        return String(format: "%dm %ds", m, s)
    }
}

#Preview {
    GameSessionView()
}
