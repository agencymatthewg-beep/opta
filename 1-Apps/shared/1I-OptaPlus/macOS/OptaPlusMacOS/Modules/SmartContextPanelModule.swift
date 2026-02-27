//
//  SmartContextPanelModule.swift
//  OptaPlusMacOS
//
//  F6. Smart Context Panel (Enhanced) — live interactive view of bot context
//  with drag-and-drop file management, token visualization, visual diff of
//  context changes, and memory editing. Replaces the existing ContextPanel
//  with a full-featured context inspector.
//
//  Module registration:  Replace ContextPanel with SmartContextPanel in ChatView.
//  Module removal:       Delete this file. Revert to the original ContextPanel.
//
//  Keyboard shortcuts:
//    Cmd+Shift+C  — Toggle smart context panel
//    Cmd+Shift+E  — Expand/collapse all context groups
//    Cmd+Shift+D  — Toggle token diff view
//
//  Event bus:
//    Posts:    .module_context_fileAdded(path: String)
//              .module_context_fileRemoved(path: String)
//              .module_context_tokensUpdated(count: Int)
//    Listens:  .module_context_toggle
//              .module_context_changed(items: [ContextItem])
//
//  Persistence:
//    Pinned context files stored in UserDefaults "optaplus.pinnedContext.<botId>"
//    Token budget preferences in UserDefaults "optaplus.tokenBudget"
//
//  Inter-module interaction:
//    - Replaces the existing ContextPanel view
//    - ChatViewModel.contextFiles provides the data source
//    - Drag files from Finder to add to context
//    - SemanticSearchModule can search within context files
//    - AnalyticsModule can track context size over time
//
//  How to add:
//    1. Replace `ContextPanel(items:isExpanded:)` with `SmartContextPanel(...)` in ChatView
//    2. Wire Cmd+Shift+C to toggle .module_context_toggle
//    3. Add "Context Inspector" to CommandPalette
//
//  How to remove:
//    1. Delete this file
//    2. Revert to `ContextPanel(items:isExpanded:)` in ChatView
//    3. Remove notification listeners
//    4. Call SmartContextPanelModule.cleanup() to remove pinned preferences
//

import SwiftUI
import Combine
import UniformTypeIdentifiers
import OptaMolt
import os.log

// MARK: - Token Info

/// Token count information for a single context item.
struct TokenInfo: Equatable {
    let estimatedTokens: Int
    let percentOfBudget: Double
    let isOverBudget: Bool

    /// Rough token estimate: ~4 chars per token for English text.
    static func estimate(from text: String, budget: Int) -> TokenInfo {
        let tokens = max(1, text.count / 4)
        let percent = Double(tokens) / Double(max(1, budget))
        return TokenInfo(
            estimatedTokens: tokens,
            percentOfBudget: percent,
            isOverBudget: tokens > budget
        )
    }
}

// MARK: - Enhanced Context Item

/// Extended context item with token info and pinning support.
struct EnhancedContextItem: Identifiable, Equatable {
    let id: UUID
    let base: ContextItem
    let tokenInfo: TokenInfo
    var isPinned: Bool
    var isExpanded: Bool
    var previewContent: String?  // First N characters of file content

    init(base: ContextItem, tokenInfo: TokenInfo, isPinned: Bool = false) {
        self.id = base.id
        self.base = base
        self.tokenInfo = tokenInfo
        self.isPinned = isPinned
        self.isExpanded = false
        self.previewContent = nil
    }
}

// MARK: - Context Diff

/// Represents a change between two context snapshots.
struct ContextDiff: Identifiable, Equatable {
    let id = UUID()
    let kind: DiffKind
    let itemName: String
    let details: String?
    let timestamp: Date

    enum DiffKind: String, Equatable {
        case added = "Added"
        case removed = "Removed"
        case modified = "Modified"
        case tokenChange = "Token Change"

        var icon: String {
            switch self {
            case .added: return "plus.circle.fill"
            case .removed: return "minus.circle.fill"
            case .modified: return "pencil.circle.fill"
            case .tokenChange: return "number.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .added: return .optaGreen
            case .removed: return .optaRed
            case .modified: return .optaAmber
            case .tokenChange: return .optaCyan
            }
        }
    }
}

// MARK: - Smart Context View Model

@MainActor
final class SmartContextViewModel: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "SmartContext")

    // MARK: Published State
    @Published var enhancedItems: [EnhancedContextItem] = []
    @Published var totalTokens: Int = 0
    @Published var tokenBudget: Int = 128000  // Default 128K context window
    @Published var budgetUsagePercent: Double = 0
    @Published var isOverBudget: Bool = false
    @Published var diffs: [ContextDiff] = []
    @Published var showDiffView: Bool = false
    @Published var isExpanded: Bool = true
    @Published var allGroupsExpanded: Bool = false
    @Published var searchQuery: String = ""
    @Published var pinnedItemIds: Set<UUID> = []
    @Published var dragTargetActive: Bool = false

    private var previousItems: [ContextItem] = []
    private var botId: String?

    // MARK: - Setup

    func configure(botId: String) {
        self.botId = botId
        loadPinnedItems()
        loadTokenBudget()
    }

    // MARK: - Update Context

    /// Process new context items from ChatViewModel.
    func update(items: [ContextItem]) {
        // Compute diffs from previous state
        let newDiffs = computeDiffs(old: previousItems, new: items)
        if !newDiffs.isEmpty {
            diffs.insert(contentsOf: newDiffs, at: 0)
            // Keep only last 50 diffs
            if diffs.count > 50 { diffs = Array(diffs.prefix(50)) }
        }
        previousItems = items

        // Build enhanced items with token info
        var enhanced: [EnhancedContextItem] = []
        var totalToks = 0

        for item in items {
            let sizeText = item.sizeHint ?? "unknown"
            let estimatedChars = parseSize(sizeText)
            let tokenInfo = TokenInfo.estimate(
                from: String(repeating: "a", count: estimatedChars),
                budget: tokenBudget
            )
            totalToks += tokenInfo.estimatedTokens

            var enhancedItem = EnhancedContextItem(
                base: item,
                tokenInfo: tokenInfo,
                isPinned: pinnedItemIds.contains(item.id)
            )

            // Preserve expanded state from previous
            if let existing = enhancedItems.first(where: { $0.id == item.id }) {
                enhancedItem.isExpanded = existing.isExpanded
                enhancedItem.previewContent = existing.previewContent
            }

            enhanced.append(enhancedItem)
        }

        // Sort: pinned first, then by kind
        enhanced.sort { a, b in
            if a.isPinned != b.isPinned { return a.isPinned }
            return a.base.kind.rawValue < b.base.kind.rawValue
        }

        enhancedItems = enhanced
        totalTokens = totalToks
        budgetUsagePercent = Double(totalToks) / Double(max(1, tokenBudget))
        isOverBudget = totalToks > tokenBudget

        NotificationCenter.default.post(
            name: .module_context_tokensUpdated,
            object: nil,
            userInfo: ["count": totalToks]
        )
    }

    // MARK: - Filtering

    var filteredItems: [EnhancedContextItem] {
        guard !searchQuery.isEmpty else { return enhancedItems }
        let query = searchQuery.lowercased()
        return enhancedItems.filter {
            $0.base.name.lowercased().contains(query) ||
            $0.base.path.lowercased().contains(query) ||
            $0.base.kind.rawValue.lowercased().contains(query)
        }
    }

    var groupedItems: [(ContextItem.ContextKind, [EnhancedContextItem])] {
        let dict = Dictionary(grouping: filteredItems) { $0.base.kind }
        let order: [ContextItem.ContextKind] = [.system, .workspace, .memory, .skill, .injected]
        return order.compactMap { kind in
            if let items = dict[kind], !items.isEmpty {
                return (kind, items)
            }
            return nil
        }
    }

    // MARK: - Pin/Unpin

    func togglePin(_ itemId: UUID) {
        if pinnedItemIds.contains(itemId) {
            pinnedItemIds.remove(itemId)
        } else {
            pinnedItemIds.insert(itemId)
        }
        if let idx = enhancedItems.firstIndex(where: { $0.id == itemId }) {
            enhancedItems[idx].isPinned = pinnedItemIds.contains(itemId)
        }
        savePinnedItems()
    }

    // MARK: - Expand/Collapse

    func toggleItemExpanded(_ itemId: UUID) {
        if let idx = enhancedItems.firstIndex(where: { $0.id == itemId }) {
            enhancedItems[idx].isExpanded.toggle()
        }
    }

    func toggleAllGroups() {
        allGroupsExpanded.toggle()
        for i in enhancedItems.indices {
            enhancedItems[i].isExpanded = allGroupsExpanded
        }
    }

    // MARK: - Token Budget

    func setTokenBudget(_ budget: Int) {
        tokenBudget = max(1000, budget)
        UserDefaults.standard.set(tokenBudget, forKey: "optaplus.tokenBudget")
        // Recalculate
        update(items: previousItems)
    }

    // MARK: - Drag and Drop

    func handleFileDrop(providers: [NSItemProvider]) {
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, _ in
                    if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                        Task { @MainActor in
                            self.addFileToContext(url)
                        }
                    }
                }
            }
        }
    }

    private func addFileToContext(_ url: URL) {
        NotificationCenter.default.post(
            name: .module_context_fileAdded,
            object: nil,
            userInfo: ["path": url.path]
        )
        Self.logger.info("File dropped to context: \(url.lastPathComponent)")
    }

    // MARK: - Diff Computation

    private func computeDiffs(old: [ContextItem], new: [ContextItem]) -> [ContextDiff] {
        var diffs: [ContextDiff] = []
        let oldNames = Set(old.map(\.name))
        let newNames = Set(new.map(\.name))

        // Added items
        for name in newNames.subtracting(oldNames) {
            diffs.append(ContextDiff(kind: .added, itemName: name, details: nil, timestamp: Date()))
        }

        // Removed items
        for name in oldNames.subtracting(newNames) {
            diffs.append(ContextDiff(kind: .removed, itemName: name, details: nil, timestamp: Date()))
        }

        // Modified items (same name, different size)
        for newItem in new {
            if let oldItem = old.first(where: { $0.name == newItem.name }),
               oldItem.sizeHint != newItem.sizeHint {
                diffs.append(ContextDiff(
                    kind: .modified,
                    itemName: newItem.name,
                    details: "\(oldItem.sizeHint ?? "?") -> \(newItem.sizeHint ?? "?")",
                    timestamp: Date()
                ))
            }
        }

        return diffs
    }

    // MARK: - Persistence

    private func loadPinnedItems() {
        guard let botId else { return }
        if let data = UserDefaults.standard.data(forKey: "optaplus.pinnedContext.\(botId)"),
           let ids = try? JSONDecoder().decode([String].self, from: data) {
            pinnedItemIds = Set(ids.compactMap { UUID(uuidString: $0) })
        }
    }

    private func savePinnedItems() {
        guard let botId else { return }
        let ids = pinnedItemIds.map(\.uuidString)
        if let data = try? JSONEncoder().encode(ids) {
            UserDefaults.standard.set(data, forKey: "optaplus.pinnedContext.\(botId)")
        }
    }

    private func loadTokenBudget() {
        let saved = UserDefaults.standard.integer(forKey: "optaplus.tokenBudget")
        if saved > 0 { tokenBudget = saved }
    }

    // MARK: - Helpers

    private func parseSize(_ sizeHint: String) -> Int {
        // Parse "12.3 KB" or "1.2 MB" to approximate character count
        let cleaned = sizeHint.lowercased().trimmingCharacters(in: .whitespaces)
        if cleaned.hasSuffix("kb") {
            let num = Double(cleaned.dropLast(2).trimmingCharacters(in: .whitespaces)) ?? 0
            return Int(num * 1024)
        }
        if cleaned.hasSuffix("mb") {
            let num = Double(cleaned.dropLast(2).trimmingCharacters(in: .whitespaces)) ?? 0
            return Int(num * 1024 * 1024)
        }
        if cleaned.hasSuffix("b") {
            let num = Double(cleaned.dropLast(1).trimmingCharacters(in: .whitespaces)) ?? 0
            return Int(num)
        }
        return 1000 // Default estimate
    }

    /// Clear all persisted state (for module removal).
    func clearAll() {
        guard let botId else { return }
        UserDefaults.standard.removeObject(forKey: "optaplus.pinnedContext.\(botId)")
        UserDefaults.standard.removeObject(forKey: "optaplus.tokenBudget")
    }
}

// MARK: - Smart Context Panel View

struct SmartContextPanel: View {
    let items: [ContextItem]
    @Binding var isExpanded: Bool
    let botId: String

    @StateObject private var vm = SmartContextViewModel()
    @State private var hoveredItemId: UUID?
    @State private var buttonBreathe: CGFloat = 0
    @State private var panelScale: CGFloat = 0.9
    @State private var panelOpacity: CGFloat = 0

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            // Toggle pill (matches original ContextPanel)
            togglePill

            // Expanded panel
            if isExpanded {
                expandedPanel
                    .onDrop(of: [.fileURL], isTargeted: $vm.dragTargetActive) { providers in
                        vm.handleFileDrop(providers: providers)
                        return true
                    }
            }
        }
        .onAppear {
            vm.configure(botId: botId)
            vm.update(items: items)
        }
        .onChange(of: items) { _, newItems in
            vm.update(items: newItems)
        }
    }

    // MARK: - Toggle Pill

    private var togglePill: some View {
        Button(action: {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                isExpanded.toggle()
            }
        }) {
            HStack(spacing: 5) {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 10))
                    .rotationEffect(.degrees(isExpanded ? -10 : 0))

                Text("\(items.count)")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))

                // Token count badge
                if vm.totalTokens > 0 {
                    Text(formatTokens(vm.totalTokens))
                        .font(.system(size: 8, weight: .medium, design: .monospaced))
                        .foregroundColor(vm.isOverBudget ? .optaRed : .optaGreen)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(
                            Capsule().fill(
                                vm.isOverBudget ? Color.optaRed.opacity(0.12) : Color.optaGreen.opacity(0.1)
                            )
                        )
                }

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 7))
            }
            .foregroundColor(isExpanded ? .optaPrimary : .optaTextSecondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                Capsule()
                    .fill(Color.optaSurface.opacity(isExpanded ? 0.8 : 0.5))
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
            )
            .overlay(
                Capsule()
                    .stroke(
                        isExpanded ? Color.optaPrimary.opacity(0.2) : Color.optaBorder.opacity(0.15),
                        lineWidth: 0.5
                    )
            )
            .shadow(color: Color.optaPrimary.opacity(isExpanded ? 0.1 : 0), radius: 8, y: 2)
            .scaleEffect(1 + 0.02 * buttonBreathe)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isExpanded ? "Collapse smart context panel" : "Expand smart context panel, \(items.count) files, \(vm.totalTokens) tokens")
        .onAppear {
            withAnimation(.optaPulse) { buttonBreathe = 1 }
        }
    }

    // MARK: - Expanded Panel

    private var expandedPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with search and actions
            panelHeader

            LinearGradient(
                colors: [.clear, Color.optaPrimary.opacity(0.15), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)

            // Token budget bar
            tokenBudgetBar

            // Search field
            if vm.enhancedItems.count > 5 {
                searchField
            }

            // Context items
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 10) {
                    // Pinned section
                    let pinned = vm.filteredItems.filter(\.isPinned)
                    if !pinned.isEmpty {
                        pinnedSection(pinned)
                    }

                    // Grouped items
                    ForEach(Array(vm.groupedItems.enumerated()), id: \.element.0) { groupIndex, group in
                        let (kind, kindItems) = group
                        contextGroup(kind: kind, items: kindItems, groupIndex: groupIndex)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
            }
            .frame(maxHeight: 320)

            // Diff timeline (collapsible)
            if vm.showDiffView && !vm.diffs.isEmpty {
                diffTimeline
            }

            // Footer
            panelFooter
        }
        .frame(width: 300)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaSurface.opacity(0.7))
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                // Drag target highlight
                if vm.dragTargetActive {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.optaPrimary.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
                }
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        colors: [Color.optaPrimary.opacity(0.1), Color.optaBorder.opacity(0.1), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.5
                )
        )
        .shadow(color: Color.optaVoid.opacity(0.25), radius: 20, y: 6)
        .shadow(color: Color.optaPrimary.opacity(0.08), radius: 16, y: 0)
        .scaleEffect(panelScale, anchor: .topTrailing)
        .opacity(panelOpacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                panelScale = 1
                panelOpacity = 1
            }
        }
        .onDisappear {
            panelScale = 0.9
            panelOpacity = 0
        }
        .transition(.asymmetric(
            insertion: .identity,
            removal: .scale(scale: 0.95, anchor: .topTrailing).combined(with: .opacity)
        ))
    }

    // MARK: - Panel Header

    private var panelHeader: some View {
        HStack {
            HStack(spacing: 4) {
                Image(systemName: "square.stack.3d.up")
                    .font(.system(size: 9))
                    .foregroundColor(.optaPrimary)

                Text("CONTEXT")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }

            Spacer()

            // Actions
            HStack(spacing: 6) {
                Button(action: { vm.toggleAllGroups() }) {
                    Image(systemName: vm.allGroupsExpanded ? "rectangle.compress.vertical" : "rectangle.expand.vertical")
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                }
                .buttonStyle(.plain)
                .help("Expand/collapse all")

                Button(action: {
                    withAnimation(.optaSpring) { vm.showDiffView.toggle() }
                }) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 9))
                        .foregroundColor(vm.showDiffView ? .optaPrimary : .optaTextMuted)
                }
                .buttonStyle(.plain)
                .help("Toggle context diff timeline")

                Text("\(items.count) files")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
                    .opacity(0.5)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    // MARK: - Token Budget Bar

    private var tokenBudgetBar: some View {
        VStack(spacing: 4) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.optaSurface)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(budgetColor)
                        .frame(width: geo.size.width * min(1.0, vm.budgetUsagePercent))
                }
            }
            .frame(height: 4)

            // Labels
            HStack {
                Text(formatTokens(vm.totalTokens))
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundColor(budgetColor)

                Spacer()

                Text("/ \(formatTokens(vm.tokenBudget))")
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                Text("(\(Int(vm.budgetUsagePercent * 100))%)")
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundColor(budgetColor)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.optaSurface.opacity(0.2))
    }

    private var budgetColor: Color {
        if vm.isOverBudget { return .optaRed }
        if vm.budgetUsagePercent > 0.8 { return .optaAmber }
        return .optaGreen
    }

    // MARK: - Search Field

    private var searchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 9))
                .foregroundColor(.optaTextMuted)

            TextField("Filter context...", text: $vm.searchQuery)
                .textFieldStyle(.plain)
                .font(.sora(10))
                .foregroundColor(.optaTextPrimary)

            if !vm.searchQuery.isEmpty {
                Button(action: { vm.searchQuery = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    // MARK: - Pinned Section

    private func pinnedSection(_ items: [EnhancedContextItem]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "pin.fill")
                    .font(.system(size: 7))
                    .foregroundColor(.optaAmber)
                Text("PINNED")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaAmber.opacity(0.5))
            }
            .padding(.leading, 4)

            FlowLayout(spacing: 4) {
                ForEach(items) { item in
                    SmartContextPill(
                        item: item,
                        isHovered: hoveredItemId == item.id,
                        onTogglePin: { vm.togglePin(item.id) },
                        onToggleExpand: { vm.toggleItemExpanded(item.id) }
                    )
                    .onHover { hover in
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                            hoveredItemId = hover ? item.id : nil
                        }
                    }
                }
            }
        }
    }

    // MARK: - Context Group

    private func contextGroup(kind: ContextItem.ContextKind, items: [EnhancedContextItem], groupIndex: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(kind.rawValue.uppercased())
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(kind.color.opacity(0.5))

                Spacer()

                // Group token count
                let groupTokens = items.reduce(0) { $0 + $1.tokenInfo.estimatedTokens }
                Text(formatTokens(groupTokens))
                    .font(.system(size: 8, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.leading, 4)
            .padding(.trailing, 4)

            FlowLayout(spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.element.id) { itemIndex, item in
                    SmartContextPill(
                        item: item,
                        isHovered: hoveredItemId == item.id,
                        onTogglePin: { vm.togglePin(item.id) },
                        onToggleExpand: { vm.toggleItemExpanded(item.id) }
                    )
                    .onHover { hover in
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                            hoveredItemId = hover ? item.id : nil
                        }
                    }
                }
            }
        }
    }

    // MARK: - Diff Timeline

    private var diffTimeline: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 9))
                    .foregroundColor(.optaPrimary)
                Text("CHANGES")
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                Spacer()
                Text("\(vm.diffs.count)")
                    .font(.system(size: 8, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.horizontal, 12)
            .padding(.top, 6)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(vm.diffs.prefix(10)) { diff in
                        HStack(spacing: 6) {
                            Image(systemName: diff.kind.icon)
                                .font(.system(size: 8))
                                .foregroundColor(diff.kind.color)

                            Text(diff.itemName)
                                .font(.sora(9))
                                .foregroundColor(.optaTextSecondary)
                                .lineLimit(1)

                            if let details = diff.details {
                                Text(details)
                                    .font(.system(size: 8, design: .monospaced))
                                    .foregroundColor(.optaTextMuted)
                            }

                            Spacer()

                            Text(diff.timestamp, style: .relative)
                                .font(.sora(8))
                                .foregroundColor(.optaTextMuted)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 2)
                    }
                }
            }
            .frame(maxHeight: 100)
        }
        .background(Color.optaSurface.opacity(0.15))
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }

    // MARK: - Panel Footer

    private var panelFooter: some View {
        HStack(spacing: 8) {
            // Drop zone hint
            HStack(spacing: 3) {
                Image(systemName: "arrow.down.doc")
                    .font(.system(size: 8))
                Text("Drop files")
                    .font(.sora(9))
            }
            .foregroundColor(.optaTextMuted)

            Spacer()

            // Budget selector
            Menu {
                ForEach([8000, 32000, 64000, 128000, 200000], id: \.self) { budget in
                    Button("\(formatTokens(budget))") {
                        vm.setTokenBudget(budget)
                    }
                }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 8))
                    Text(formatTokens(vm.tokenBudget))
                        .font(.system(size: 9, design: .monospaced))
                }
                .foregroundColor(.optaTextMuted)
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.optaSurface.opacity(0.15))
    }

    // MARK: - Helpers

    private func formatTokens(_ count: Int) -> String {
        if count >= 1000 {
            return String(format: "%.1fK", Double(count) / 1000)
        }
        return "\(count)"
    }
}

// MARK: - Smart Context Pill

struct SmartContextPill: View {
    let item: EnhancedContextItem
    let isHovered: Bool
    let onTogglePin: () -> Void
    let onToggleExpand: () -> Void

    @State private var appeared = false
    @State private var floatOffset: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Pill content
            HStack(spacing: 4) {
                Image(systemName: item.base.kind.icon)
                    .font(.system(size: 8))
                    .foregroundColor(item.base.kind.color)

                Text(item.base.name)
                    .font(.sora(9, weight: .medium))
                    .foregroundColor(isHovered ? .optaTextPrimary : .optaTextSecondary)
                    .lineLimit(1)

                // Token count badge
                if isHovered || item.tokenInfo.estimatedTokens > 5000 {
                    Text("\(item.tokenInfo.estimatedTokens)t")
                        .font(.system(size: 7, weight: .medium, design: .monospaced))
                        .foregroundColor(item.tokenInfo.isOverBudget ? .optaRed : .optaTextMuted)
                        .transition(.scale.combined(with: .opacity))
                }

                // Pin indicator
                if item.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 6))
                        .foregroundColor(.optaAmber)
                }

                // Hover actions
                if isHovered {
                    Button(action: onTogglePin) {
                        Image(systemName: item.isPinned ? "pin.slash" : "pin")
                            .font(.system(size: 7))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isHovered ? item.base.kind.color.opacity(0.12) : Color.optaElevated.opacity(0.5))
            )
            .overlay(
                Capsule()
                    .stroke(isHovered ? item.base.kind.color.opacity(0.25) : Color.optaBorder.opacity(0.1), lineWidth: 0.5)
            )
            .shadow(color: isHovered ? item.base.kind.color.opacity(0.15) : .clear, radius: 6, y: 2)
            .scaleEffect(isHovered ? 1.05 : 1)
            .offset(y: floatOffset)

            // Token bar (visible on hover)
            if isHovered {
                GeometryReader { geo in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(tokenBarColor)
                        .frame(
                            width: geo.size.width * min(1.0, item.tokenInfo.percentOfBudget * 10), // Amplified for visibility
                            height: 2
                        )
                }
                .frame(height: 2)
                .padding(.horizontal, 8)
                .transition(.opacity)
            }
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 6)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                appeared = true
            }
            let duration = 3.0 + Double.random(in: 0...1)
            withAnimation(.spring(response: 1.2, dampingFraction: 0.5).repeatForever(autoreverses: true)) {
                floatOffset = CGFloat.random(in: -1.5...1.5)
            }
        }
        .contextMenu {
            Button("Pin/Unpin", action: onTogglePin)
            Button("Copy Path") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(item.base.path, forType: .string)
            }
            Divider()
            Button("Remove from Context") {
                NotificationCenter.default.post(
                    name: .module_context_fileRemoved,
                    object: nil,
                    userInfo: ["path": item.base.path]
                )
            }
        }
    }

    private var tokenBarColor: Color {
        if item.tokenInfo.isOverBudget { return .optaRed }
        if item.tokenInfo.percentOfBudget > 0.3 { return .optaAmber }
        return .optaGreen
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_context_toggle = Notification.Name("module.context.toggle")
    static let module_context_fileAdded = Notification.Name("module.context.fileAdded")
    static let module_context_fileRemoved = Notification.Name("module.context.fileRemoved")
    static let module_context_tokensUpdated = Notification.Name("module.context.tokensUpdated")
    static let module_context_changed = Notification.Name("module.context.changed")
}

// MARK: - Module Registration

/// **To add:**
///   1. Replace `ContextPanel(items: contextItems, isExpanded: $isContextExpanded)`
///      with `SmartContextPanel(items: contextItems, isExpanded: $isContextExpanded, botId: botId)`
///      in ChatView.
///   2. Wire Cmd+Shift+C to toggle .module_context_toggle
///   3. Add "Context Inspector" to CommandPalette
///
/// **To remove:**
///   1. Delete this file
///   2. Revert to `ContextPanel(items: contextItems, isExpanded: $isContextExpanded)` in ChatView
///   3. Remove notification listeners
///   4. Pinned items auto-orphan in UserDefaults
enum SmartContextPanelModule {
    static func register() {
        // Module is view-driven. No background registration needed.
    }

    /// Remove all pinned context preferences.
    static func cleanup() {
        let defaults = UserDefaults.standard
        let keys = defaults.dictionaryRepresentation().keys.filter {
            $0.hasPrefix("optaplus.pinnedContext.")
        }
        for key in keys {
            defaults.removeObject(forKey: key)
        }
        defaults.removeObject(forKey: "optaplus.tokenBudget")
    }
}
