//
//  ProcessListSection.swift
//  OptaNative
//
//  A section displaying filtered and searchable process list.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// Section view displaying a filtered, searchable list of running processes.
struct ProcessListSection: View {

    // MARK: - Properties

    /// The process view model (bindable for filter/search state)
    @Bindable var viewModel: ProcessViewModel

    // MARK: - Body

    var body: some View {
        VStack(spacing: OptaSpacing.md) {
            // Header with controls
            headerSection

            // Process List
            GlassCard(cornerRadius: OptaSpacing.radiusLarge) {
                VStack(spacing: 0) {
                    if viewModel.isLoading {
                        loadingView
                    } else if viewModel.filteredProcesses.isEmpty {
                        emptyView
                    } else {
                        processList
                    }
                }
            }

            // Error message
            if let error = viewModel.errorMessage {
                errorBanner(message: error)
            }
        }
        .alert(
            "Terminate System Process?",
            isPresented: $viewModel.showTerminationConfirmation,
            presenting: viewModel.processToTerminate
        ) { process in
            Button("Cancel", role: .cancel) {
                viewModel.cancelTermination()
            }
            Button("Terminate", role: .destructive) {
                viewModel.confirmTermination()
            }
        } message: { process in
            Text("'\(process.name)' is a system process. Terminating it may cause system instability. Are you sure?")
        }
    }

    // MARK: - Header Section

    @ViewBuilder
    private var headerSection: some View {
        VStack(spacing: OptaSpacing.md) {
            HStack {
                Text("Processes")
                    .font(.optaH3)
                    .foregroundStyle(Color.optaForeground)

                Spacer()

                // Process count
                Text("\(viewModel.processCount) processes")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)

                // Refresh button
                Button(action: { viewModel.refreshProcesses() }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.optaPrimary)
                }
                .buttonStyle(.plain)
                .help("Refresh process list")
            }

            // Filter and Search Row
            HStack(spacing: OptaSpacing.md) {
                // Filter Picker
                filterPicker

                Spacer()

                // Search Field
                searchField
            }
        }
    }

    @ViewBuilder
    private var filterPicker: some View {
        Picker("Filter", selection: $viewModel.filter) {
            ForEach(ProcessFilter.allCases, id: \.self) { filter in
                Text(filter.rawValue).tag(filter)
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 220)
    }

    @ViewBuilder
    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundStyle(Color.optaMutedForeground)

            TextField("Search processes...", text: $viewModel.searchText)
                .textFieldStyle(.plain)
                .font(.optaBody)
                .foregroundStyle(Color.optaForeground)

            if !viewModel.searchText.isEmpty {
                Button(action: { viewModel.searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.optaMutedForeground)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, OptaSpacing.sm)
        .padding(.vertical, 6)
        .background {
            RoundedRectangle(cornerRadius: OptaSpacing.radiusSmall)
                .fill(Color.optaMuted)
                .overlay(
                    RoundedRectangle(cornerRadius: OptaSpacing.radiusSmall)
                        .stroke(Color.optaBorder, lineWidth: 1)
                )
        }
        .frame(width: 200)
    }

    // MARK: - Process List

    @ViewBuilder
    private var processList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(viewModel.filteredProcesses) { process in
                    ProcessRow(
                        process: process,
                        onTerminate: {
                            viewModel.requestTermination(of: process)
                        }
                    )

                    if process.id != viewModel.filteredProcesses.last?.id {
                        Divider()
                            .background(Color.optaBorder.opacity(0.5))
                    }
                }
            }
        }
        .frame(maxHeight: 400)
    }

    // MARK: - State Views

    @ViewBuilder
    private var loadingView: some View {
        VStack(spacing: OptaSpacing.md) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.8)

            Text("Loading processes...")
                .font(.optaBody)
                .foregroundStyle(Color.optaMutedForeground)
        }
        .frame(height: 200)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var emptyView: some View {
        VStack(spacing: OptaSpacing.md) {
            Image(systemName: "tray")
                .font(.system(size: 32))
                .foregroundStyle(Color.optaMutedForeground)

            Text("No processes found")
                .font(.optaBodyMedium)
                .foregroundStyle(Color.optaForeground)

            Text("Try adjusting your filter or search")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)
        }
        .frame(height: 200)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func errorBanner(message: String) -> some View {
        HStack(spacing: OptaSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.optaDanger)

            Text(message)
                .font(.optaSmall)
                .foregroundStyle(Color.optaDanger)

            Spacer()

            Button(action: { viewModel.errorMessage = nil }) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.optaDanger)
            }
            .buttonStyle(.plain)
        }
        .padding(OptaSpacing.sm)
        .background {
            RoundedRectangle(cornerRadius: OptaSpacing.radiusSmall)
                .fill(Color.optaDanger.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: OptaSpacing.radiusSmall)
                        .stroke(Color.optaDanger.opacity(0.3), lineWidth: 1)
                )
        }
    }
}

// MARK: - Preview

#Preview("Process List Section") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        ProcessListSection(viewModel: ProcessViewModel.preview)
            .padding(24)
    }
    .frame(width: 600, height: 600)
}

#Preview("Process List - Empty") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        ProcessListSection(viewModel: ProcessViewModel())
            .padding(24)
    }
    .frame(width: 600, height: 400)
}
