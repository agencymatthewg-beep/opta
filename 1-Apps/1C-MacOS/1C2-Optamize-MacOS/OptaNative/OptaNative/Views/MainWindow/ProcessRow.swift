//
//  ProcessRow.swift
//  OptaNative
//
//  A row displaying process information with terminate action.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// A row view displaying a single process with its metrics and actions.
struct ProcessRow: View {

    // MARK: - Properties

    /// The process to display
    let process: ProcessInfo

    /// Action to terminate the process
    let onTerminate: () -> Void

    // MARK: - State

    @State private var isHovered = false

    // MARK: - Body

    var body: some View {
        HStack(spacing: OptaSpacing.md) {
            // Process Icon (based on category)
            processIcon
                .frame(width: 24)

            // Process Info
            VStack(alignment: .leading, spacing: 2) {
                Text(process.name)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaForeground)
                    .lineLimit(1)

                Text("PID: \(process.pid)")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }

            Spacer()

            // CPU Usage
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f%%", process.cpuUsage))
                    .font(.optaBodyMedium)
                    .foregroundStyle(cpuColor)

                Text("CPU")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }
            .frame(width: 60)

            // Memory Usage
            VStack(alignment: .trailing, spacing: 2) {
                Text(formattedMemory)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaForeground)

                Text("Memory")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }
            .frame(width: 70)

            // Terminate Button
            terminateButton
        }
        .padding(.horizontal, OptaSpacing.md)
        .padding(.vertical, OptaSpacing.sm)
        .background {
            if isHovered {
                RoundedRectangle(cornerRadius: OptaSpacing.radiusSmall)
                    .fill(Color.optaMuted.opacity(0.5))
            }
        }
        .animation(.easeOut(duration: 0.15), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var processIcon: some View {
        let (iconName, iconColor) = iconForCategory(process.category)

        Image(systemName: iconName)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(iconColor)
    }

    @ViewBuilder
    private var terminateButton: some View {
        Button(action: onTerminate) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(
                    process.isSystem ? Color.optaDanger.opacity(0.5) : Color.optaDanger
                )
        }
        .buttonStyle(.plain)
        .opacity(isHovered ? 1 : 0.5)
        .help(process.isSystem ? "System process - terminate with caution" : "Terminate process")
    }

    // MARK: - Computed Properties

    /// Color for CPU usage based on threshold
    private var cpuColor: Color {
        if process.cpuUsage < 30 {
            return Color.optaSuccess
        } else if process.cpuUsage < 70 {
            return Color.optaWarning
        } else {
            return Color.optaDanger
        }
    }

    /// Formatted memory string
    private var formattedMemory: String {
        if process.memoryMB >= 1024 {
            return String(format: "%.1f GB", process.memoryMB / 1024)
        } else {
            return String(format: "%.0f MB", process.memoryMB)
        }
    }

    // MARK: - Helpers

    /// Returns icon name and color for process category
    private func iconForCategory(_ category: ProcessCategory) -> (String, Color) {
        switch category {
        case .essential:
            return ("shield.fill", Color.optaPrimary)
        case .user:
            return ("app.fill", Color.optaSuccess)
        case .background:
            return ("gearshape.fill", Color.optaMutedForeground)
        case .bloatware:
            return ("exclamationmark.triangle.fill", Color.optaWarning)
        }
    }
}

// MARK: - Preview

#Preview("Process Row") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        VStack(spacing: 0) {
            ProcessRow(
                process: ProcessInfo(
                    id: 1,
                    name: "Safari",
                    user: "user",
                    cpuUsage: 12.5,
                    memoryMB: 450.0,
                    isSystem: false,
                    path: "/Applications/Safari.app",
                    category: .user
                ),
                onTerminate: {}
            )

            Divider()
                .background(Color.optaBorder)

            ProcessRow(
                process: ProcessInfo(
                    id: 2,
                    name: "WindowServer",
                    user: "root",
                    cpuUsage: 5.0,
                    memoryMB: 180.0,
                    isSystem: true,
                    path: "/System/Library/",
                    category: .essential
                ),
                onTerminate: {}
            )

            Divider()
                .background(Color.optaBorder)

            ProcessRow(
                process: ProcessInfo(
                    id: 3,
                    name: "Adobe CEF Helper",
                    user: "user",
                    cpuUsage: 75.0,
                    memoryMB: 2500.0,
                    isSystem: false,
                    path: "/Applications/Adobe/",
                    category: .bloatware
                ),
                onTerminate: {}
            )
        }
        .padding()
    }
    .frame(width: 500, height: 200)
}
