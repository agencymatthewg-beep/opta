//
//  OptimizationView.swift
//  OptaNative
//
//  View for Advanced Optimization settings (Power & Network).
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import SwiftUI

struct OptimizationView: View {
    @State private var viewModel = OptimizationViewModel()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                
                // Power Section
                VStack(alignment: .leading, spacing: 16) {
                    Label("Power Management", systemImage: "bolt.fill")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("Select a power profile to prioritize performance or battery life.")
                        .foregroundStyle(.secondary)
                    
                    Picker("Profile", selection: Binding(
                        get: { viewModel.activePowerProfile },
                        set: { viewModel.setPowerProfile($0) }
                    )) {
                        ForEach(PowerProfile.allCases) { profile in
                            Text(profile.rawValue).tag(profile)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    
                    // Description Box
                    HStack {
                        Image(systemName: "info.circle")
                            .foregroundStyle(.blue)
                        Text(viewModel.activePowerProfile.description)
                            .font(.subheadline)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
                }
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(12)
                
                // Network Section
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Label("Network Latency", systemImage: "network")
                            .font(.title2)
                            .fontWeight(.bold)
                        Spacer()
                        Button(action: { viewModel.checkNetworkLatency() }) {
                            if viewModel.isCheckingLatency {
                                ProgressView().scaleEffect(0.6)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                        }
                        .disabled(viewModel.isCheckingLatency)
                    }
                    
                    Text("Estimating Round Trip Time (RTT) to global gaming hubs.")
                        .foregroundStyle(.secondary)
                    
                    if viewModel.latencies.isEmpty {
                        Button("Check Latency") {
                            viewModel.checkNetworkLatency()
                        }
                        .buttonStyle(.bordered)
                    } else {
                        // Results Grid
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))]) {
                            ForEach(viewModel.latencies) { result in
                                LatencyCard(result: result)
                            }
                        }
                    }
                    
                    if let date = viewModel.lastCheckDate {
                        Text("Last checked: \(date.formatted(date: .omitted, time: .standard))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(12)
                
                Spacer()
            }
            .padding()
        }
        .frame(minWidth: 500, minHeight: 600)
    }
}

// MARK: - Subviews

struct LatencyCard: View {
    let result: LatencyResult
    
    var color: Color {
        if result.rttMs < 50 { return .green }
        if result.rttMs < 100 { return .orange }
        return .red
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(result.targetName)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(.secondary)
            
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(String(format: "%.0f", result.rttMs))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(color)
                Text("ms")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

#Preview {
    OptimizationView()
}
