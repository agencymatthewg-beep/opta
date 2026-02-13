//
//  GameSessionDetailView.swift
//  OptaNative
//
//  Detailed analysis view for a recorded game session.
//  Visualizes FPS, CPU, and thermal trends using Swift Charts.
//  Created for Opta Native macOS - Plan 96-01 (v12.0)
//

import SwiftUI
import Charts

struct GameSessionDetailView: View {
    let session: GameSession
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text(session.gameName)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    HStack {
                        Label(session.startTime.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                        Spacer()
                        Label(formatDuration(session.duration), systemImage: "clock")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
                .padding(.bottom)
                
                // Key Metrics Cards
                HStack(spacing: 16) {
                    StatCard(title: "Avg FPS", value: String(format: "%.1f", session.avgFPS), color: .green)
                    StatCard(title: "1% Low", value: String(format: "%.1f", session.minFPS), color: .orange)
                    StatCard(title: "Avg CPU", value: String(format: "%.1f%%", session.avgCpuUsage), color: .blue)
                    StatCard(title: "Peak Thermal", value: thermalString(session.maxThermalState), color: thermalColor(session.maxThermalState))
                }
                
                // FPS Chart
                GroupBox("Frame Rate (FPS)") {
                    Chart(session.samples, id: \.timestamp) { sample in
                        LineMark(
                            x: .value("Time", sample.timestamp),
                            y: .value("FPS", sample.fps ?? 0)
                        )
                        .foregroundStyle(.green)
                        .interpolationMethod(.catmullRom)
                    }
                    .chartYScale(domain: 0...144) // logical max
                    .frame(height: 200)
                    .padding()
                }
                
                // CPU Chart
                GroupBox("CPU Usage") {
                    Chart(session.samples, id: \.timestamp) { sample in
                        AreaMark(
                            x: .value("Time", sample.timestamp),
                            y: .value("CPU", sample.cpuUsage)
                        )
                        .foregroundStyle(
                            .linearGradient(
                                colors: [.blue.opacity(0.6), .blue.opacity(0.1)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    }
                    .chartYScale(domain: 0...100)
                    .frame(height: 150)
                    .padding()
                }
                
                Spacer()
            }
            .padding()
        }
        .navigationTitle("Session Analysis")
    }
    
    // MARK: - Helpers
    
    func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration) / 60
        let s = Int(duration) % 60
        return String(format: "%d min %d sec", m, s)
    }
    
    func thermalString(_ state: Int) -> String {
        switch state {
        case 0: return "Nominal"
        case 1: return "Fair"
        case 2: return "Serious"
        case 3: return "Critical"
        default: return "Unknown"
        }
    }
    
    func thermalColor(_ state: Int) -> Color {
        switch state {
        case 0: return .green
        case 1: return .yellow
        case 2: return .orange
        case 3: return .red
        default: return .gray
        }
    }
}

// MARK: - Subviews

struct StatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

#Preview {
    GameSessionDetailView(session: GameSession(
        id: UUID(),
        gameName: "Preview Game",
        gameId: nil,
        startTime: Date(),
        endTime: Date().addingTimeInterval(300),
        duration: 300,
        wasOptimized: true,
        samples: [],
        avgFPS: 60,
        minFPS: 45,
        maxFPS: 75,
        avgCpuUsage: 40,
        avgGpuUsage: 80,
        maxThermalState: 0
    ))
}
