//
//  ConflictView.swift
//  OptaNative
//
//  View for identifying and resolving software conflicts.
//  Also displays smart suggestions based on user patterns.
//  Created for Opta Native macOS - Plan 97-01 (v12.0)
//

import SwiftUI

struct ConflictView: View {
    @State private var viewModel = ConflictViewModel()
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            
            // Header
            HStack {
                Text("System Health")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                if viewModel.isScanning {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Button(action: { viewModel.refresh() }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
            
            // Stats Row
            HStack(spacing: 12) {
                StatusCard(
                    title: "Conflicts",
                    value: "\(viewModel.conflicts.count)",
                    color: viewModel.conflicts.isEmpty ? .green : .orange,
                    icon: "exclamationmark.triangle.fill"
                )
                
                StatusCard(
                    title: "Smart Patterns",
                    value: "\(viewModel.suggestions.count)",
                    color: .blue,
                    icon: "brain.head.profile"
                )
            }
            .padding(.horizontal)
            
            Divider()
                .padding(.horizontal)
            
            ScrollView {
                VStack(spacing: 24) {
                    
                    // Conflicts Section
                    if !viewModel.conflicts.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Detected Conflicts")
                                .font(.headline)
                                .padding(.horizontal)
                            
                            ForEach(viewModel.conflicts) { conflict in
                                ConflictRow(conflict: conflict, onIgnore: {
                                    viewModel.ignoreConflict(id: conflict.id)
                                })
                            }
                        }
                    } else {
                        HStack {
                            Image(systemName: "checkmark.shield.fill")
                                .foregroundStyle(.green)
                            Text("No software conflicts detected.")
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(8)
                        .padding(.horizontal)
                    }
                    
                    // Suggestions Section
                    if !viewModel.suggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Optimization Habits")
                                .font(.headline)
                                .padding(.horizontal)
                            
                            ForEach(viewModel.suggestions) { pattern in
                                PatternRow(pattern: pattern)
                            }
                        }
                    }
                }
                .padding(.vertical)
            }
        }
        .frame(minWidth: 400, minHeight: 500)
    }
}

// MARK: - Subviews

struct StatusCard: View {
    let title: String
    let value: String
    let color: Color
    let icon: String
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundStyle(color)
            }
            Spacer()
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color.opacity(0.8))
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

struct ConflictRow: View {
    let conflict: ConflictInfo
    let onIgnore: () -> Void
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title2)
                .foregroundStyle(severityColor(conflict.severity))
                .padding(.top, 4)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(conflict.name)
                    .font(.headline)
                Text(conflict.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Text(conflict.recommendation)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(severityColor(conflict.severity))
                    .padding(.top, 2)
            }
            
            Spacer()
            
            Button("Ignore", action: onIgnore)
                .font(.caption)
        }
        .padding()
        .background(severityColor(conflict.severity).opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
    
    func severityColor(_ severity: ConflictSeverity) -> Color {
        switch severity {
        case .high: return .red
        case .medium: return .orange
        case .low: return .yellow
        }
    }
}

struct PatternRow: View {
    let pattern: OptimizationPattern
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(pattern.context)
                    .font(.body)
                    .fontWeight(.medium)
                Text("Optimized \(Int(pattern.optimizationProbability * 100))% of launches")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if pattern.optimizationProbability > 0.8 {
                Text("Favorite")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.2))
                    .foregroundStyle(.blue)
                    .clipShape(Capsule())
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
        .padding(.horizontal)
    }
}

#Preview {
    ConflictView()
}
