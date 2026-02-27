//
//  ChatHistoryView.swift
//  OptaPlusIOS
//
//  Chronological list of all chat sessions across all bots.
//  Pulls data from gateway via sessions.list + sessions.preview.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - History Item Model

struct HistoryItem: Identifiable, Hashable {
    let id: String
    let botName: String
    let botEmoji: String
    let botId: String
    let sessionKey: String
    let summary: String
    let lastActivity: Date
    let channel: String?
    let kind: String?
    let contextSize: Int?
}

// MARK: - Date Group

enum DateGroup: String, CaseIterable {
    case today = "Today"
    case yesterday = "Yesterday"
    case thisWeek = "This Week"
    case older = "Older"

    static func from(_ date: Date) -> DateGroup {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return .today }
        if cal.isDateInYesterday(date) { return .yesterday }
        let weekAgo = cal.date(byAdding: .day, value: -7, to: Date()) ?? Date()
        if date > weekAgo { return .thisWeek }
        return .older
    }
}

// MARK: - Chat History View

struct ChatHistoryView: View {
    @EnvironmentObject var appState: AppState
    @State private var items: [HistoryItem] = []
    @State private var isLoading = false
    @State private var searchText = ""
    @State private var errorMessage: String?
    @State private var resumeItem: HistoryItem?
    @State private var pinnedIds: Set<String> = []
    @State private var listVisible = false

    private var filteredItems: [HistoryItem] {
        if searchText.isEmpty { return items }
        let query = searchText.lowercased()
        return items.filter {
            $0.botName.lowercased().contains(query) ||
            $0.summary.lowercased().contains(query) ||
            $0.sessionKey.lowercased().contains(query)
        }
    }

    private var groupedItems: [(DateGroup, [HistoryItem])] {
        let grouped = Dictionary(grouping: filteredItems) { DateGroup.from($0.lastActivity) }
        return DateGroup.allCases.compactMap { group in
            guard let items = grouped[group], !items.isEmpty else { return nil }
            return (group, items.sorted { $0.lastActivity > $1.lastActivity })
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && items.isEmpty {
                    ProgressView("Loading sessions...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if items.isEmpty {
                    emptyState
                } else {
                    sessionList
                }
            }
            .background(Color.optaVoid)
            .navigationTitle("History")
            .searchable(text: $searchText, prompt: "Search sessions...")
            .refreshable {
                await loadSessions()
            }
            .task {
                await loadSessions()
            }
        }
    }

    private var sessionList: some View {
        List {
            ForEach(groupedItems, id: \.0) { group, groupItems in
                Section {
                    ForEach(Array(groupItems.enumerated()), id: \.element.id) { index, item in
                        Button {
                            HapticManager.shared.impact(.light)
                            resumeSession(item)
                        } label: {
                            HistoryRow(item: item, isPinned: pinnedIds.contains(item.id))
                        }
                        .staggeredIgnition(index: index, isVisible: listVisible)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                HapticManager.shared.impact(.heavy)
                                deleteSession(item)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                HapticManager.shared.impact(.light)
                                togglePin(item)
                            } label: {
                                Label(
                                    pinnedIds.contains(item.id) ? "Unpin" : "Pin",
                                    systemImage: pinnedIds.contains(item.id) ? "pin.slash" : "pin"
                                )
                            }
                            .tint(.optaAmber)
                        }
                    }
                } header: {
                    Text(group.rawValue)
                        .font(.sora(15, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }
            }
            .listRowBackground(Color.optaSurface)
        }
        .scrollContentBackground(.hidden)
        .onAppear { listVisible = true }
        .navigationDestination(item: $resumeItem) { item in
            if let bot = appState.bots.first(where: { $0.id == item.botId }) {
                let vm = appState.viewModel(for: bot)
                ChatView(viewModel: vm, botConfig: bot)
            }
        }
    }

    private func deleteSession(_ item: HistoryItem) {
        withAnimation(.optaSpring) {
            items.removeAll { $0.id == item.id }
        }
        // Fire-and-forget delete on gateway
        if let bot = appState.bots.first(where: { $0.id == item.botId }) {
            let vm = appState.viewModel(for: bot)
            Task {
                _ = try? await vm.call("sessions.delete", params: ["sessionKey": item.sessionKey])
            }
        }
    }

    private func togglePin(_ item: HistoryItem) {
        if pinnedIds.contains(item.id) {
            pinnedIds.remove(item.id)
        } else {
            pinnedIds.insert(item.id)
        }
    }

    private func resumeSession(_ item: HistoryItem) {
        guard let bot = appState.bots.first(where: { $0.id == item.botId }) else { return }
        let vm = appState.viewModel(for: bot)

        // Connect if needed
        if vm.connectionState == .disconnected {
            vm.connect()
        }

        // Find existing session with this key, or create one
        if let existing = vm.sessions.first(where: { $0.sessionKey == item.sessionKey }) {
            vm.switchSession(existing)
        } else {
            let session = ChatSession(
                name: item.summary.prefix(30).description,
                sessionKey: item.sessionKey,
                mode: .synced
            )
            vm.sessions.append(session)
            vm.switchSession(session)
        }

        resumeItem = item
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.sora(48, weight: .regular))
                .foregroundColor(.optaTextMuted)
            Text("No sessions yet")
                .font(.soraHeadline)
                .foregroundColor(.optaTextSecondary)
            Text("Connect to a bot to see conversation history")
                .font(.soraSubhead)
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data Loading

    private func loadSessions() async {
        isLoading = true
        defer { isLoading = false }

        var allItems: [HistoryItem] = []

        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)
            guard vm.isGatewayReady else { continue }

            do {
                let response = try await vm.call("sessions.list", params: [:])
                guard let sessions = response?.dict?["sessions"] as? [[String: Any]] else { continue }

                let keys = sessions.compactMap { $0["sessionKey"] as? String ?? $0["key"] as? String }

                // Fetch previews for all session keys
                var previews: [String: String] = [:]
                if !keys.isEmpty {
                    let previewResult = try? await vm.call("sessions.preview", params: [
                        "keys": keys,
                        "limit": 1,
                        "maxChars": 100
                    ])
                    if let previewDict = previewResult?.dict?["previews"] as? [String: Any] {
                        for (key, val) in previewDict {
                            if let messages = val as? [[String: Any]],
                               let first = messages.first {
                                let content = first["content"] as? String ?? first["text"] as? String ?? ""
                                previews[key] = String(content.prefix(100))
                            }
                        }
                    }
                }

                for session in sessions {
                    guard let key = session["sessionKey"] as? String ?? session["key"] as? String else { continue }

                    var lastActive: Date = Date()
                    if let ts = session["lastActiveAt"] as? Double {
                        lastActive = Date(timeIntervalSince1970: ts / 1000)
                    } else if let ts = session["lastActiveAt"] as? Int {
                        lastActive = Date(timeIntervalSince1970: Double(ts) / 1000)
                    }

                    let label = session["label"] as? String ?? key
                    let summary = previews[key] ?? label
                    let channel = session["channel"] as? String

                    var contextSize: Int? = nil
                    if let usage = session["usage"] as? [String: Any],
                       let tokens = usage["totalTokens"] as? Int {
                        contextSize = tokens
                    }

                    allItems.append(HistoryItem(
                        id: "\(bot.id):\(key)",
                        botName: bot.name,
                        botEmoji: bot.emoji,
                        botId: bot.id,
                        sessionKey: key,
                        summary: summary,
                        lastActivity: lastActive,
                        channel: channel,
                        kind: session["kind"] as? String,
                        contextSize: contextSize
                    ))
                }
            } catch {
                NSLog("[History] Failed to load sessions for \(bot.name): \(error)")
            }
        }

        items = allItems.sorted { $0.lastActivity > $1.lastActivity }
    }
}

// MARK: - History Row

struct HistoryRow: View {
    let item: HistoryItem
    var isPinned: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Text(item.botEmoji)
                .font(.soraTitle2)

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    if isPinned {
                        Image(systemName: "pin.fill")
                            .font(.sora(9, weight: .regular))
                            .foregroundColor(.optaAmber)
                    }

                    Text(item.botName)
                        .font(.sora(15, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    if let channel = item.channel {
                        Text(channel)
                            .font(.sora(10, weight: .regular))
                            .foregroundColor(.optaTextMuted)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.optaSurface))
                    }
                }

                Text(item.summary)
                    .font(.sora(13, weight: .regular))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    Text(item.sessionKey)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(1)

                    if let size = item.contextSize {
                        Text("\(size / 1000)k")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(OptaFormatting.relativeTime(item.lastActivity))
                    .font(.sora(11, weight: .regular))
                    .foregroundColor(.optaTextMuted)

                Image(systemName: "chevron.right")
                    .font(.sora(10, weight: .regular))
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding(.vertical, 4)
    }
}
