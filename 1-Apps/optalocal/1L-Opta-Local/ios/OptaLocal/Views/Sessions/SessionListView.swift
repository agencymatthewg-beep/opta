import SwiftUI

struct SessionListView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @State private var viewModel = SessionsViewModel()
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ZStack {
                OptaColors.void_.ignoresSafeArea()

                if connectionManager.client != nil {
                    VStack(spacing: 0) {
                        // Search bar
                        searchBar

                        // Model filter chips
                        if !viewModel.availableModels.isEmpty {
                            modelFilterBar
                        }

                        // Results count
                        if !viewModel.searchQuery.isEmpty || viewModel.modelFilter != nil {
                            HStack {
                                Text("\(viewModel.filteredSessions.count) of \(viewModel.sessions.count) sessions")
                                    .font(.caption)
                                    .foregroundStyle(OptaColors.textMuted)
                                Spacer()
                                if viewModel.modelFilter != nil || !viewModel.searchQuery.isEmpty {
                                    Button("Clear") {
                                        OptaHaptics.select()
                                        viewModel.searchQuery = ""
                                        viewModel.modelFilter = nil
                                    }
                                    .font(.caption)
                                    .foregroundStyle(OptaColors.primary)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 4)
                        }

                        // Session list
                        if viewModel.filteredSessions.isEmpty && !viewModel.isLoading {
                            Spacer()
                            emptyState
                            Spacer()
                        } else {
                            List(viewModel.filteredSessions) { session in
                                SessionRow(session: session)
                                    .listRowBackground(OptaColors.surface.opacity(0.5))
                                    .listRowSeparatorTint(OptaColors.border.opacity(0.3))
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        OptaHaptics.tap()
                                        selectedSession = session
                                    }
                            }
                            .listStyle(.plain)
                            .scrollContentBackground(.hidden)
                        }
                    }
                    .overlay {
                        if viewModel.isLoading && viewModel.sessions.isEmpty {
                            ProgressView()
                                .tint(OptaColors.primary)
                        }
                    }
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 48))
                            .foregroundStyle(OptaColors.textMuted)
                        Text("Connect to view sessions")
                            .foregroundStyle(OptaColors.textSecondary)
                    }
                }
            }
            .navigationTitle("Sessions")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if let client = connectionManager.client {
                                OptaHaptics.tap()
                                await viewModel.refresh(client: client)
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .foregroundStyle(OptaColors.textSecondary)
                    }
                }
            }
            .task {
                if let client = connectionManager.client {
                    await viewModel.loadSessions(client: client)
                }
            }
            .navigationDestination(item: $selectedSession) { session in
                SessionResumeView(session: session)
            }
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(OptaColors.textMuted)
                .font(.subheadline)

            TextField("Search sessions...", text: $viewModel.searchQuery)
                .textFieldStyle(.plain)
                .foregroundStyle(OptaColors.textPrimary)
                .font(.subheadline)

            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(OptaColors.textMuted)
                        .font(.subheadline)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(OptaColors.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(OptaColors.border.opacity(0.4), lineWidth: 0.5)
        )
        .padding(.horizontal)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - Model filter

    private var modelFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip("All", isSelected: viewModel.modelFilter == nil) {
                    viewModel.modelFilter = nil
                }
                ForEach(viewModel.availableModels, id: \.self) { model in
                    filterChip(SessionsViewModel.shortModelName(model), isSelected: viewModel.modelFilter == model) {
                        viewModel.modelFilter = model
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 6)
        }
    }

    private func filterChip(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            OptaHaptics.select()
            action()
        } label: {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    isSelected ? OptaColors.primary.opacity(0.3) : OptaColors.surface
                )
                .foregroundStyle(
                    isSelected ? OptaColors.primary : OptaColors.textSecondary
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? OptaColors.primary.opacity(0.5) : OptaColors.border.opacity(0.3), lineWidth: 0.5)
                )
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: viewModel.searchQuery.isEmpty ? "clock.arrow.circlepath" : "magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(OptaColors.textMuted)
            Text(viewModel.searchQuery.isEmpty ? "No sessions yet" : "No matching sessions")
                .foregroundStyle(OptaColors.textSecondary)
            if !viewModel.searchQuery.isEmpty {
                Text("Try a different search term")
                    .font(.caption)
                    .foregroundStyle(OptaColors.textMuted)
            }
        }
    }
}

// MARK: - Session Row

private struct SessionRow: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(session.title)
                .font(.subheadline.bold())
                .foregroundStyle(OptaColors.textPrimary)
                .lineLimit(2)

            HStack(spacing: 8) {
                // Model badge
                Label(SessionsViewModel.shortModelName(session.model), systemImage: "cpu")
                    .font(.caption)
                    .foregroundStyle(OptaColors.primary)

                Text("·")
                    .foregroundStyle(OptaColors.textMuted)

                // Message count
                Label("\(session.messageCount)", systemImage: "bubble.left")
                    .font(.caption)
                    .foregroundStyle(OptaColors.textSecondary)

                Spacer()

                // Relative time
                Text(SessionsViewModel.relativeDate(from: session.updatedAt))
                    .font(.caption)
                    .foregroundStyle(OptaColors.textMuted)
            }
        }
        .padding(.vertical, 4)
    }
}

// Make Session Hashable for navigationDestination
extension Session: Hashable {
    static func == (lhs: Session, rhs: Session) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
