//
//  ProcessesView.swift
//  OptaApp
//
//  Sortable, filterable process table showing running processes
//  with CPU/memory usage, multi-select, and terminate actions.
//

import SwiftUI

// MARK: - ProcessesView

struct ProcessesView: View {
    @Bindable var coreManager: OptaCoreManager
    @Environment(\.colorTemperature) private var colorTemp
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var searchText = ""
    @State private var sortBy: ProcessSortViewModel = .cpu
    @State private var sortAscending = false
    @State private var onlyKillable = false
    @State private var showTerminateConfirm = false

    /// Debounce timer for search input
    @State private var searchDebounceTask: Task<Void, Never>?

    private let obsidianBase = Color(hex: "0A0A0F")
    private let electricViolet = Color(hex: "8B5CF6")

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            // Toolbar
            toolbarView

            // Divider
            Rectangle()
                .fill(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.3))
                .frame(height: 1)

            // Process Table
            processTableView

            // Action Bar (when processes selected)
            if coreManager.viewModel.selectedProcessCount > 0 {
                actionBarView
            }
        }
        .background(obsidianBase)
        .onAppear {
            coreManager.dispatch(.refreshProcesses)
        }
        .alert("Terminate Processes", isPresented: $showTerminateConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Terminate", role: .destructive) {
                coreManager.dispatch(.terminateSelected)
            }
        } message: {
            Text("Are you sure you want to terminate \(coreManager.viewModel.selectedProcessCount) selected process\(coreManager.viewModel.selectedProcessCount == 1 ? "" : "es")? This action cannot be undone.")
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack(spacing: 12) {
            // Back button
            Button {
                coreManager.dispatch(.navigateTo(page: .dashboard))
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(width: 32, height: 32)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(.white.opacity(0.05))
                    )
            }
            .buttonStyle(.plain)

            // Title
            Text("Processes")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)

            // Count badge
            Text("\(coreManager.viewModel.processCount)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(colorTemp.violetColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(colorTemp.violetColor.opacity(0.15))
                )

            Spacer()

            // Refresh button
            Button {
                coreManager.dispatch(.refreshProcesses)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(width: 32, height: 32)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(.white.opacity(0.05))
                    )
                    .rotationEffect(.degrees(coreManager.viewModel.loadingProcesses ? 360 : 0))
                    .animation(
                        coreManager.viewModel.loadingProcesses
                            ? .linear(duration: 1).repeatForever(autoreverses: false)
                            : .default,
                        value: coreManager.viewModel.loadingProcesses
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }

    // MARK: - Toolbar

    private var toolbarView: some View {
        HStack(spacing: 12) {
            // Search field
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.4))

                TextField("Filter processes...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .onChange(of: searchText) { _, newValue in
                        debounceSearch(newValue)
                    }

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        dispatchFilter()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.4))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                    )
            )
            .frame(maxWidth: 250)

            // Sort picker
            Menu {
                ForEach(ProcessSortViewModel.allCases, id: \.self) { option in
                    Button {
                        sortBy = option
                        dispatchFilter()
                    } label: {
                        Label(option.displayName, systemImage: option.icon)
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: sortBy.icon)
                        .font(.system(size: 12))
                    Text(sortBy.displayName)
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.white.opacity(0.05))
                )
            }
            .menuStyle(.borderlessButton)

            // Sort direction
            Button {
                sortAscending.toggle()
                dispatchFilter()
            } label: {
                Image(systemName: sortAscending ? "arrow.up" : "arrow.down")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.white.opacity(0.05))
                    )
            }
            .buttonStyle(.plain)

            // Killable only toggle
            Button {
                onlyKillable.toggle()
                dispatchFilter()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: onlyKillable ? "lock.open" : "lock")
                        .font(.system(size: 11))
                    Text("Killable")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(onlyKillable ? electricViolet : .white.opacity(0.5))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(onlyKillable ? electricViolet.opacity(0.15) : .white.opacity(0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(onlyKillable ? electricViolet.opacity(0.4) : .clear, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
    }

    // MARK: - Process Table

    private var processTableView: some View {
        Group {
            if coreManager.viewModel.loadingProcesses && coreManager.viewModel.processes.isEmpty {
                // Loading state
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(0.9)
                        .tint(electricViolet)
                    Text("Loading processes...")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.5))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if coreManager.viewModel.processes.isEmpty {
                // Empty state
                VStack(spacing: 12) {
                    Image(systemName: "gearshape.2")
                        .font(.system(size: 36))
                        .foregroundStyle(.white.opacity(0.2))
                    Text("No processes found")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                    if !searchText.isEmpty || onlyKillable {
                        Text("Try adjusting your filters")
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.3))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Table header
                VStack(spacing: 0) {
                    tableHeaderRow

                    ScrollView {
                        LazyVStack(spacing: 1) {
                            ForEach(coreManager.viewModel.processes) { process in
                                ProcessRowView(
                                    process: process,
                                    isSelected: coreManager.viewModel.selectedPids.contains(process.pid),
                                    colorTemp: colorTemp,
                                    onToggleSelection: {
                                        coreManager.dispatch(.toggleProcessSelection(pid: process.pid))
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
            }
        }
    }

    private var tableHeaderRow: some View {
        HStack(spacing: 0) {
            // Checkbox space
            Color.clear
                .frame(width: 30)

            Text("Name")
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("PID")
                .frame(width: 60, alignment: .trailing)

            Text("CPU")
                .frame(width: 70, alignment: .trailing)

            Text("Memory")
                .frame(width: 80, alignment: .trailing)

            // Killable indicator space
            Color.clear
                .frame(width: 30)
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(.white.opacity(0.4))
        .textCase(.uppercase)
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(.white.opacity(0.02))
    }

    // MARK: - Action Bar

    private var actionBarView: some View {
        HStack(spacing: 16) {
            // Selected count
            Text("\(coreManager.viewModel.selectedProcessCount) selected")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)

            Spacer()

            // Clear selection
            Button {
                coreManager.dispatch(.clearProcessSelection)
            } label: {
                Text("Clear")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(.white.opacity(0.08))
                    )
            }
            .buttonStyle(.plain)

            // Terminate button
            Button {
                showTerminateConfirm = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 13))
                    Text("Terminate")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.red.opacity(0.7))
                        .shadow(color: electricViolet.opacity(colorTemp.glowOpacity * 0.4), radius: 8)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            Rectangle()
                .fill(obsidianBase)
                .overlay(
                    Rectangle()
                        .fill(electricViolet.opacity(0.05))
                )
                .shadow(color: .black.opacity(0.3), radius: 8, y: -4)
        )
    }

    // MARK: - Helpers

    private func debounceSearch(_ text: String) {
        searchDebounceTask?.cancel()
        searchDebounceTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms
            guard !Task.isCancelled else { return }
            await MainActor.run {
                dispatchFilter()
            }
        }
    }

    private func dispatchFilter() {
        coreManager.dispatch(.updateProcessFilter(
            search: searchText.isEmpty ? nil : searchText,
            minCpu: nil,
            onlyKillable: onlyKillable,
            sortBy: sortBy,
            sortAscending: sortAscending
        ))
    }
}

// MARK: - ProcessRowView

private struct ProcessRowView: View {
    let process: ProcessViewModel
    let isSelected: Bool
    let colorTemp: ColorTemperatureState
    let onToggleSelection: () -> Void

    @State private var isHovered = false

    private let obsidianBase = Color(hex: "0A0A0F")
    private let electricViolet = Color(hex: "8B5CF6")

    var body: some View {
        HStack(spacing: 0) {
            // Selection checkbox
            Button(action: onToggleSelection) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 15))
                    .foregroundStyle(
                        isSelected
                            ? electricViolet
                            : (process.isKillable ? .white.opacity(0.3) : .white.opacity(0.15))
                    )
            }
            .buttonStyle(.plain)
            .frame(width: 30)
            .disabled(!process.isKillable)

            // Process name
            Text(process.name)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(process.isKillable ? .white : .white.opacity(0.4))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            // PID
            Text("\(process.pid)")
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.white.opacity(0.35))
                .frame(width: 60, alignment: .trailing)

            // CPU usage (color-coded)
            Text(String(format: "%.1f%%", process.cpuPercent))
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(cpuColor(process.cpuPercent))
                .frame(width: 70, alignment: .trailing)

            // Memory usage
            Text(formatMemory(process.memoryMb))
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.white.opacity(0.6))
                .frame(width: 80, alignment: .trailing)

            // Killable indicator
            Group {
                if !process.isKillable {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.2))
                } else {
                    Color.clear
                }
            }
            .frame(width: 30)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 8)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(rowBackground)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if process.isKillable {
                onToggleSelection()
            }
        }
        .onHover { hovering in
            isHovered = hovering
        }
    }

    // MARK: - Row Background

    private var rowBackground: Color {
        if isSelected {
            return electricViolet.opacity(0.12)
        } else if isHovered && process.isKillable {
            return .white.opacity(0.03)
        } else {
            return .clear
        }
    }

    // MARK: - CPU Color Coding

    private func cpuColor(_ percent: Float) -> Color {
        switch percent {
        case ..<30:
            return Color(hex: "22C55E") // Green
        case 30..<60:
            return Color(hex: "EAB308") // Yellow
        case 60..<85:
            return Color(hex: "F97316") // Orange
        default:
            return Color(hex: "EF4444") // Red
        }
    }

    // MARK: - Memory Formatting

    private func formatMemory(_ mb: Float) -> String {
        if mb >= 1000 {
            return String(format: "%.1f GB", mb / 1000.0)
        } else {
            return String(format: "%.0f MB", mb)
        }
    }
}

// MARK: - Preview

#Preview {
    ProcessesView(coreManager: OptaCoreManager())
        .frame(width: 800, height: 600)
        .preferredColorScheme(.dark)
}
