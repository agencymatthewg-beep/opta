//
//  ConversationBranchingModule.swift
//  OptaPlusMacOS
//
//  F2. Conversation Branching/Forking — fork conversations at any message
//  into alternate timelines. Tree data structure stores all branches. Users
//  can navigate between branches, compare responses, and merge branches.
//
//  Module registration:  ConversationBranchingModule.register()
//  Module removal:       Delete this file, remove notification listeners and context menu items.
//
//  Keyboard shortcuts:
//    Cmd+Opt+F    — Fork conversation at selected message
//    Cmd+Opt+Left — Switch to previous branch
//    Cmd+Opt+Right — Switch to next branch
//    Cmd+Shift+T  — Toggle branch navigator
//
//  Event bus:
//    Posts:    .module_branching_created(branchId: String, parentMessageId: String)
//              .module_branching_switched(branchId: String)
//    Listens:  .module_branching_toggleNavigator
//              .module_branching_fork(messageId: String)
//
//  Persistence:
//    JSON files in App Support/OptaPlus/Branches/ (one file per bot)
//
//  Inter-module interaction:
//    - Integrates with ChatViewModel: swaps the displayed message list
//    - SemanticSearchModule can search across all branches
//    - AnalyticsModule counts branches per bot
//
//  How to add:
//    1. Add branch navigator toggle to ContentView sidebar
//    2. Add "Fork" to MessageBubble context menu
//    3. Add .onReceive(publisher(for: .module_branching_toggleNavigator)) listener
//
//  How to remove:
//    1. Delete this file
//    2. Remove "Fork" from context menu
//    3. Remove notification listeners
//    4. Call ConversationBranchingModule.cleanup() to remove persisted data
//

import SwiftUI
import Combine
import OptaMolt
import os.log

// MARK: - Branch Node

/// A single node in the conversation tree. Each node holds one message
/// and may have multiple child branches.
struct BranchNode: Identifiable, Codable, Equatable {
    let id: String
    let messageId: String
    let content: String
    let senderIsUser: Bool
    let timestamp: Date
    var children: [BranchNode]
    let branchLabel: String?  // User-assigned label, e.g. "Formal tone", "Code version"

    init(
        id: String = UUID().uuidString,
        messageId: String,
        content: String,
        senderIsUser: Bool,
        timestamp: Date = Date(),
        children: [BranchNode] = [],
        branchLabel: String? = nil
    ) {
        self.id = id
        self.messageId = messageId
        self.content = content
        self.senderIsUser = senderIsUser
        self.timestamp = timestamp
        self.children = children
        self.branchLabel = branchLabel
    }
}

// MARK: - Conversation Tree

/// The full tree of all branches for a single bot conversation.
struct ConversationTree: Codable, Equatable {
    var root: BranchNode?
    var activeBranchPath: [String]  // Array of node IDs tracing the active branch
    var branchCount: Int

    init() {
        self.root = nil
        self.activeBranchPath = []
        self.branchCount = 0
    }

    // MARK: - Tree Operations

    /// Build the tree from a linear message list (initial conversion).
    mutating func buildFromMessages(_ messages: [ChatMessage]) {
        guard !messages.isEmpty else { return }
        var current: BranchNode? = nil
        for msg in messages.reversed() {
            let node = BranchNode(
                messageId: msg.id,
                content: msg.content,
                senderIsUser: msg.sender == .user,
                timestamp: msg.timestamp,
                children: current.map { [$0] } ?? []
            )
            current = node
        }
        root = current
        activeBranchPath = collectPath(from: root)
        branchCount = 1
    }

    /// Fork at a specific message ID, creating a new branch.
    mutating func fork(at messageId: String, withContent: String, senderIsUser: Bool, label: String? = nil) -> String? {
        guard root != nil else { return nil }
        let newBranchId = UUID().uuidString
        let newNode = BranchNode(
            id: newBranchId,
            messageId: UUID().uuidString,
            content: withContent,
            senderIsUser: senderIsUser,
            branchLabel: label
        )
        var rootCopy = root!
        if insertFork(node: &rootCopy, targetMessageId: messageId, newChild: newNode) {
            root = rootCopy
            branchCount += 1
            return newBranchId
        }
        return nil
    }

    /// Get all messages along the active branch path.
    func activeBranchMessages() -> [BranchNode] {
        guard let root else { return [] }
        return collectLinear(from: root, path: activeBranchPath)
    }

    /// Switch to a different branch at a fork point.
    mutating func switchBranch(at forkMessageId: String, toBranchIndex: Int) {
        guard root != nil else { return }
        // Rebuild active path taking the specified branch at the fork
        activeBranchPath = collectPathWithBranch(
            from: root,
            forkAt: forkMessageId,
            branchIndex: toBranchIndex
        )
    }

    /// Get all fork points (nodes with more than one child).
    func forkPoints() -> [BranchNode] {
        guard let root else { return [] }
        var forks: [BranchNode] = []
        collectForks(node: root, into: &forks)
        return forks
    }

    /// Count total nodes in the tree.
    func totalNodeCount() -> Int {
        guard let root else { return 0 }
        return countNodes(root)
    }

    // MARK: - Private Helpers

    private func collectPath(from node: BranchNode?) -> [String] {
        guard let node else { return [] }
        var path = [node.id]
        if let firstChild = node.children.first {
            path.append(contentsOf: collectPath(from: firstChild))
        }
        return path
    }

    private func collectPathWithBranch(from node: BranchNode?, forkAt: String, branchIndex: Int) -> [String] {
        guard let node else { return [] }
        var path = [node.id]
        if node.messageId == forkAt && branchIndex < node.children.count {
            path.append(contentsOf: collectPath(from: node.children[branchIndex]))
        } else if let firstChild = node.children.first {
            path.append(contentsOf: collectPathWithBranch(from: firstChild, forkAt: forkAt, branchIndex: branchIndex))
        }
        return path
    }

    private func collectLinear(from node: BranchNode, path: [String]) -> [BranchNode] {
        var result = [node]
        for child in node.children {
            if path.contains(child.id) {
                result.append(contentsOf: collectLinear(from: child, path: path))
                break
            }
        }
        // If no child on path, follow first child
        if result.count == 1, let first = node.children.first, !path.contains(first.id) {
            if path.isEmpty || path.last == node.id {
                result.append(contentsOf: collectLinear(from: first, path: path))
            }
        }
        return result
    }

    private mutating func insertFork(node: inout BranchNode, targetMessageId: String, newChild: BranchNode) -> Bool {
        if node.messageId == targetMessageId {
            node.children.append(newChild)
            return true
        }
        for i in node.children.indices {
            if insertFork(node: &node.children[i], targetMessageId: targetMessageId, newChild: newChild) {
                return true
            }
        }
        return false
    }

    private func collectForks(node: BranchNode, into forks: inout [BranchNode]) {
        if node.children.count > 1 {
            forks.append(node)
        }
        for child in node.children {
            collectForks(node: child, into: &forks)
        }
    }

    private func countNodes(_ node: BranchNode) -> Int {
        1 + node.children.reduce(0) { $0 + countNodes($1) }
    }
}

// MARK: - Branch Store

/// Persists conversation trees per bot in App Support.
actor BranchStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "BranchStore")
    private let storageDir: URL

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        self.storageDir = appSupport.appendingPathComponent("OptaPlus/Branches", isDirectory: true)
        try? FileManager.default.createDirectory(at: storageDir, withIntermediateDirectories: true)
    }

    func save(tree: ConversationTree, botId: String) {
        let url = storageDir.appendingPathComponent("tree-\(botId).json")
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(tree)
            try data.write(to: url, options: .atomic)
        } catch {
            Self.logger.error("Failed to save branch tree for \(botId): \(error.localizedDescription)")
        }
    }

    func load(botId: String) -> ConversationTree? {
        let url = storageDir.appendingPathComponent("tree-\(botId).json")
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(ConversationTree.self, from: data)
        } catch {
            Self.logger.error("Failed to load branch tree for \(botId): \(error.localizedDescription)")
            return nil
        }
    }

    func clearAll() {
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: storageDir, includingPropertiesForKeys: nil) {
            for file in files where file.lastPathComponent.hasPrefix("tree-") {
                try? fm.removeItem(at: file)
            }
        }
    }
}

// MARK: - Branching View Model

@MainActor
final class BranchingViewModel: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Branching")

    @Published var tree: ConversationTree = ConversationTree()
    @Published var showNavigator: Bool = false
    @Published var selectedForkId: String?
    @Published var isComparing: Bool = false
    @Published var comparisonBranches: (Int, Int)?  // Two branch indices at a fork

    private let store = BranchStore()
    private var botId: String?

    // MARK: - Setup

    func load(botId: String, messages: [ChatMessage]) async {
        self.botId = botId
        if let saved = await store.load(botId: botId) {
            self.tree = saved
        } else if !messages.isEmpty {
            // First time: build tree from existing linear conversation
            self.tree.buildFromMessages(messages)
            await save()
        }
    }

    // MARK: - Fork

    func forkAtMessage(_ messageId: String, initialContent: String = "", label: String? = nil) async {
        guard let branchId = tree.fork(
            at: messageId,
            withContent: initialContent,
            senderIsUser: true,
            label: label
        ) else { return }

        NotificationCenter.default.post(
            name: .module_branching_created,
            object: nil,
            userInfo: ["branchId": branchId, "parentMessageId": messageId]
        )
        await save()
        Self.logger.info("Forked at message \(messageId), new branch: \(branchId)")
    }

    // MARK: - Navigation

    func switchBranch(at forkMessageId: String, toIndex: Int) async {
        tree.switchBranch(at: forkMessageId, toBranchIndex: toIndex)
        NotificationCenter.default.post(
            name: .module_branching_switched,
            object: nil,
            userInfo: ["forkMessageId": forkMessageId, "branchIndex": toIndex]
        )
        await save()
    }

    func switchToNextBranch(at forkId: String) async {
        let forks = tree.forkPoints()
        guard let fork = forks.first(where: { $0.id == forkId }),
              fork.children.count > 1 else { return }

        // Find current branch index
        let activePath = tree.activeBranchPath
        var currentIndex = 0
        for (i, child) in fork.children.enumerated() {
            if activePath.contains(child.id) {
                currentIndex = i
                break
            }
        }
        let nextIndex = (currentIndex + 1) % fork.children.count
        await switchBranch(at: fork.messageId, toIndex: nextIndex)
    }

    func switchToPreviousBranch(at forkId: String) async {
        let forks = tree.forkPoints()
        guard let fork = forks.first(where: { $0.id == forkId }),
              fork.children.count > 1 else { return }

        let activePath = tree.activeBranchPath
        var currentIndex = 0
        for (i, child) in fork.children.enumerated() {
            if activePath.contains(child.id) {
                currentIndex = i
                break
            }
        }
        let prevIndex = (currentIndex - 1 + fork.children.count) % fork.children.count
        await switchBranch(at: fork.messageId, toIndex: prevIndex)
    }

    // MARK: - Comparison

    func beginCompare(at forkId: String, branch1: Int, branch2: Int) {
        selectedForkId = forkId
        comparisonBranches = (branch1, branch2)
        isComparing = true
    }

    func endCompare() {
        isComparing = false
        comparisonBranches = nil
    }

    // MARK: - Persistence

    private func save() async {
        guard let botId else { return }
        await store.save(tree: tree, botId: botId)
    }
}

// MARK: - Branch Navigator View

struct BranchNavigatorView: View {
    @ObservedObject var vm: BranchingViewModel
    @EnvironmentObject var appState: AppState

    @State private var hoveredForkId: String?
    @State private var appeared = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 11))
                    .foregroundColor(.optaPrimary)

                Text("BRANCHES")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)

                Spacer()

                Text("\(vm.tree.branchCount) branches")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)

                Button(action: { vm.showNavigator = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            LinearGradient(
                colors: [.clear, Color.optaPrimary.opacity(0.12), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)

            // Fork points list
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 8) {
                    let forks = vm.tree.forkPoints()

                    if forks.isEmpty {
                        emptyForkState
                    } else {
                        ForEach(Array(forks.enumerated()), id: \.element.id) { index, fork in
                            ForkPointCard(
                                fork: fork,
                                index: index,
                                isSelected: vm.selectedForkId == fork.id,
                                isHovered: hoveredForkId == fork.id,
                                activePath: vm.tree.activeBranchPath,
                                onSwitchBranch: { branchIndex in
                                    Task { await vm.switchBranch(at: fork.messageId, toIndex: branchIndex) }
                                },
                                onCompare: { b1, b2 in
                                    vm.beginCompare(at: fork.id, branch1: b1, branch2: b2)
                                }
                            )
                            .onHover { hover in
                                withAnimation(.optaSnap) {
                                    hoveredForkId = hover ? fork.id : nil
                                }
                            }
                            .staggeredIgnition(index: index, isVisible: appeared)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .frame(maxHeight: 400)

            // Stats footer
            HStack(spacing: 12) {
                statPill("Nodes", value: "\(vm.tree.totalNodeCount())")
                statPill("Forks", value: "\(vm.tree.forkPoints().count)")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.optaSurface.opacity(0.2))
        }
        .frame(width: 260)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.optaSurface.opacity(0.7))
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.optaBorder.opacity(0.15), lineWidth: 0.5)
        )
        .shadow(color: Color.optaVoid.opacity(0.3), radius: 20, y: 8)
        .onAppear {
            withAnimation(.optaSpring.delay(0.1)) { appeared = true }
        }
        .transition(.asymmetric(
            insertion: .scale(scale: 0.95, anchor: .trailing).combined(with: .opacity),
            removal: .scale(scale: 0.95, anchor: .trailing).combined(with: .opacity)
        ))
    }

    private var emptyForkState: some View {
        VStack(spacing: 8) {
            Image(systemName: "arrow.triangle.branch")
                .font(.system(size: 20))
                .foregroundColor(.optaTextMuted)

            Text("No branches yet")
                .font(.sora(11))
                .foregroundColor(.optaTextSecondary)

            Text("Right-click a message and select \"Fork\" to create alternate timelines")
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
    }

    private func statPill(_ label: String, value: String) -> some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
            Text(label)
                .font(.sora(9))
                .foregroundColor(.optaTextMuted)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .glassPill()
    }
}

// MARK: - Fork Point Card

struct ForkPointCard: View {
    let fork: BranchNode
    let index: Int
    let isSelected: Bool
    let isHovered: Bool
    let activePath: [String]
    let onSwitchBranch: (Int) -> Void
    let onCompare: (Int, Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Fork header
            HStack(spacing: 6) {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 9))
                    .foregroundColor(.optaPrimary)

                Text("Fork #\(index + 1)")
                    .font(.sora(10, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                Spacer()

                Text(fork.timestamp, style: .relative)
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }

            // Message preview
            Text(fork.content)
                .font(.sora(10))
                .foregroundColor(.optaTextSecondary)
                .lineLimit(2)

            // Branch buttons
            HStack(spacing: 4) {
                ForEach(Array(fork.children.enumerated()), id: \.element.id) { branchIdx, child in
                    let isActive = activePath.contains(child.id)
                    Button(action: { onSwitchBranch(branchIdx) }) {
                        HStack(spacing: 3) {
                            Circle()
                                .fill(isActive ? Color.optaPrimary : Color.optaTextMuted.opacity(0.4))
                                .frame(width: 5, height: 5)

                            Text(child.branchLabel ?? "Branch \(branchIdx + 1)")
                                .font(.sora(9, weight: isActive ? .semibold : .regular))
                                .foregroundColor(isActive ? .optaPrimary : .optaTextSecondary)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(
                            Capsule().fill(isActive ? Color.optaPrimary.opacity(0.12) : Color.optaElevated.opacity(0.4))
                        )
                    }
                    .buttonStyle(.plain)
                }

                Spacer()

                // Compare button (if 2+ branches)
                if fork.children.count >= 2 {
                    Button(action: { onCompare(0, 1) }) {
                        Image(systemName: "arrow.left.arrow.right")
                            .font(.system(size: 8))
                            .foregroundColor(.optaTextMuted)
                    }
                    .buttonStyle(.plain)
                    .help("Compare branches")
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isHovered ? Color.optaElevated.opacity(0.5) : Color.optaElevated.opacity(0.2))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

// MARK: - Branch Comparison View

struct BranchComparisonView: View {
    @ObservedObject var vm: BranchingViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "arrow.left.arrow.right")
                    .foregroundColor(.optaPrimary)
                Text("Branch Comparison")
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                Spacer()

                Button("Done") {
                    withAnimation(.optaSpring) { vm.endCompare() }
                }
                .buttonStyle(.plain)
                .foregroundColor(.optaPrimary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.optaSurface.opacity(0.3))

            Divider().background(Color.optaBorder.opacity(0.3))

            // Side-by-side comparison
            if let forkId = vm.selectedForkId,
               let (b1, b2) = vm.comparisonBranches {
                let forks = vm.tree.forkPoints()
                if let fork = forks.first(where: { $0.id == forkId }),
                   b1 < fork.children.count, b2 < fork.children.count {
                    HStack(spacing: 1) {
                        branchColumn(fork.children[b1], label: "Branch \(b1 + 1)", color: .optaPrimary)
                        branchColumn(fork.children[b2], label: "Branch \(b2 + 1)", color: .optaCyan)
                    }
                }
            }
        }
        .glassStrong()
    }

    private func branchColumn(_ node: BranchNode, label: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
                Text(node.branchLabel ?? label)
                    .font(.sora(11, weight: .semibold))
                    .foregroundColor(color)
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    comparisonMessageRow(node)
                    ForEach(node.children, id: \.id) { child in
                        comparisonMessageRow(child)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color.optaSurface.opacity(0.15))
    }

    private func comparisonMessageRow(_ node: BranchNode) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(node.senderIsUser ? "You" : "Bot")
                .font(.sora(9, weight: .medium))
                .foregroundColor(.optaTextMuted)
            Text(node.content)
                .font(.sora(11))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(6)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassSubtle()
    }
}

// MARK: - Fork Indicator (inline in MessageBubble)

/// Small indicator shown on messages that have branches. Place this as an
/// overlay on MessageBubble when branching module is active.
struct ForkIndicator: View {
    let branchCount: Int
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 3) {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 8))
                Text("\(branchCount)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
            }
            .foregroundColor(.optaPrimary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule().fill(Color.optaPrimary.opacity(0.12))
            )
            .overlay(
                Capsule().stroke(Color.optaPrimary.opacity(0.2), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .help("\(branchCount) branches from this message")
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_branching_toggleNavigator = Notification.Name("module.branching.toggleNavigator")
    static let module_branching_fork = Notification.Name("module.branching.fork")
    static let module_branching_created = Notification.Name("module.branching.created")
    static let module_branching_switched = Notification.Name("module.branching.switched")
}

// MARK: - Module Registration

/// **To add:**
///   1. Add `BranchNavigatorView` as an overlay or side panel in ContentView
///   2. Add "Fork" action to MessageBubble context menu:
///      ```swift
///      Button("Fork Conversation") {
///          NotificationCenter.default.post(
///              name: .module_branching_fork,
///              object: nil,
///              userInfo: ["messageId": message.id]
///          )
///      }
///      ```
///   3. Wire Cmd+Shift+T to toggle `.module_branching_toggleNavigator`
///   4. Wire Cmd+Opt+F to post `.module_branching_fork` for selected message
///
/// **To remove:**
///   1. Delete this file
///   2. Remove "Fork" from context menu
///   3. Remove notification listeners
///   4. Call cleanup() to purge persisted data
enum ConversationBranchingModule {
    private static let store = BranchStore()

    static func register() {
        // Module is event-driven. Notification listeners wire it up.
    }

    /// Remove all persisted branch data.
    static func cleanup() {
        Task { await store.clearAll() }
    }
}
