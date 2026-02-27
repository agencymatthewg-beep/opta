//
//  SplitPaneChatModule.swift
//  OptaPlusMacOS
//
//  F1. Split-Pane Chat — side-by-side or configurable grid layout for talking
//  to 2+ bots simultaneously. Supports linked mode (send message to all panes),
//  independent mode (each pane is its own conversation), and drag-to-resize dividers.
//
//  Module registration:  Add `.splitPane` case to DetailMode in ContentView.swift.
//  Module removal:       Delete this file. Remove the DetailMode case and notification.
//
//  Keyboard shortcuts:
//    Cmd+Shift+S  — Toggle split-pane mode
//    Cmd+Shift+L  — Toggle linked/independent mode
//    Cmd+Shift+A  — Add pane
//    Cmd+Shift+W  — Close focused pane
//    Cmd+Shift+1..4 — Focus pane N
//
//  Event bus:
//    Posts:    .module_splitpane_linkedMessage(content: String)
//    Listens:  .module_splitpane_toggle
//
//  Persistence:
//    UserDefaults key "optaplus.splitpane.config" — stores PaneConfiguration
//
//  Inter-module interaction:
//    - Uses AppState.viewModel(for:) to get per-bot ChatViewModels
//    - Each pane renders the same ChatView used in standard mode
//    - SemanticSearchModule results can target a specific pane
//
//  How to add:
//    1. Add `case splitPane` to DetailMode in ContentView.swift
//    2. Add `.onReceive(publisher(for: .module_splitpane_toggle))` to toggle mode
//    3. Add keyboard shortcut Cmd+Shift+S to trigger .module_splitpane_toggle
//    4. In the detail switch, add `case .splitPane: SplitPaneContainerView()`
//
//  How to remove:
//    1. Delete this file
//    2. Remove `case splitPane` from DetailMode
//    3. Remove notification listener and keyboard shortcut
//

import SwiftUI
import Combine
import OptaMolt
import os.log

// MARK: - Pane Layout Mode

/// How panes are arranged in the split view.
enum PaneLayoutMode: String, CaseIterable, Codable, Sendable {
    case sideBySide     // Horizontal: [A | B]
    case stacked        // Vertical: [A] / [B]
    case grid           // 2x2 grid: [A | B] / [C | D]
    case focusLeft      // Large left pane + narrow right: [AAA | B]
    case focusRight     // Narrow left + large right: [A | BBB]

    var icon: String {
        switch self {
        case .sideBySide: return "rectangle.split.2x1"
        case .stacked: return "rectangle.split.1x2"
        case .grid: return "rectangle.split.2x2"
        case .focusLeft: return "rectangle.leadinghalf.inset.filled"
        case .focusRight: return "rectangle.trailinghalf.inset.filled"
        }
    }

    var label: String {
        switch self {
        case .sideBySide: return "Side by Side"
        case .stacked: return "Stacked"
        case .grid: return "2x2 Grid"
        case .focusLeft: return "Focus Left"
        case .focusRight: return "Focus Right"
        }
    }

    var maxPanes: Int {
        switch self {
        case .sideBySide, .stacked, .focusLeft, .focusRight: return 2
        case .grid: return 4
        }
    }
}

// MARK: - Chat Pane

/// A single pane in the split view, bound to a specific bot.
struct ChatPane: Identifiable, Codable, Equatable {
    let id: String
    var botId: String
    var widthFraction: CGFloat  // 0.0–1.0 for horizontal layouts
    var heightFraction: CGFloat // 0.0–1.0 for vertical layouts

    init(
        id: String = UUID().uuidString,
        botId: String,
        widthFraction: CGFloat = 0.5,
        heightFraction: CGFloat = 0.5
    ) {
        self.id = id
        self.botId = botId
        self.widthFraction = widthFraction
        self.heightFraction = heightFraction
    }
}

// MARK: - Pane Configuration

/// Persisted split-pane layout configuration.
struct PaneConfiguration: Codable, Equatable {
    var layout: PaneLayoutMode
    var panes: [ChatPane]
    var isLinked: Bool  // Send messages to all panes simultaneously

    static let `default` = PaneConfiguration(
        layout: .sideBySide,
        panes: [],
        isLinked: false
    )
}

// MARK: - Split Pane View Model

@MainActor
final class SplitPaneViewModel: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "SplitPane")
    private static let configKey = "optaplus.splitpane.config"

    // MARK: Published State
    @Published var config: PaneConfiguration {
        didSet { save() }
    }
    @Published var focusedPaneId: String?
    @Published var isDraggingDivider: Bool = false
    @Published var showPaneSelector: Bool = false
    @Published var pendingPaneId: String?  // Pane waiting for bot selection

    init() {
        if let data = UserDefaults.standard.data(forKey: Self.configKey),
           let saved = try? JSONDecoder().decode(PaneConfiguration.self, from: data) {
            self.config = saved
        } else {
            self.config = .default
        }
    }

    // MARK: - Pane Management

    /// Initialize split pane with the currently selected bot in pane 1
    /// and the first other available bot in pane 2.
    func initialize(appState: AppState) {
        guard config.panes.isEmpty else { return }
        let bots = appState.bots
        guard bots.count >= 2 else { return }

        let firstBot = appState.selectedBot ?? bots[0]
        let secondBot = bots.first(where: { $0.id != firstBot.id }) ?? bots[1]

        config.panes = [
            ChatPane(botId: firstBot.id),
            ChatPane(botId: secondBot.id)
        ]
        focusedPaneId = config.panes.first?.id
    }

    /// Add a new pane for the given bot.
    func addPane(botId: String) {
        guard config.panes.count < config.layout.maxPanes else { return }
        let equalFraction = 1.0 / CGFloat(config.panes.count + 1)
        // Redistribute fractions evenly
        for i in config.panes.indices {
            config.panes[i].widthFraction = equalFraction
            config.panes[i].heightFraction = equalFraction
        }
        let newPane = ChatPane(
            botId: botId,
            widthFraction: equalFraction,
            heightFraction: equalFraction
        )
        config.panes.append(newPane)
        focusedPaneId = newPane.id
    }

    /// Remove a pane by ID.
    func removePane(id: String) {
        config.panes.removeAll { $0.id == id }
        // Redistribute fractions
        guard !config.panes.isEmpty else { return }
        let equalFraction = 1.0 / CGFloat(config.panes.count)
        for i in config.panes.indices {
            config.panes[i].widthFraction = equalFraction
            config.panes[i].heightFraction = equalFraction
        }
        if focusedPaneId == id {
            focusedPaneId = config.panes.first?.id
        }
    }

    /// Swap the bot assigned to a pane.
    func setBotForPane(_ paneId: String, botId: String) {
        if let idx = config.panes.firstIndex(where: { $0.id == paneId }) {
            config.panes[idx].botId = botId
        }
    }

    /// Focus the next pane in order.
    func focusNextPane() {
        guard let current = focusedPaneId,
              let idx = config.panes.firstIndex(where: { $0.id == current }) else {
            focusedPaneId = config.panes.first?.id
            return
        }
        let next = (idx + 1) % config.panes.count
        focusedPaneId = config.panes[next].id
    }

    /// Focus pane at index (0-based).
    func focusPane(at index: Int) {
        guard index < config.panes.count else { return }
        focusedPaneId = config.panes[index].id
    }

    /// Update divider position between two panes (horizontal).
    func updateDividerHorizontal(fraction: CGFloat) {
        guard config.panes.count == 2 else { return }
        let clamped = min(max(fraction, 0.2), 0.8)
        config.panes[0].widthFraction = clamped
        config.panes[1].widthFraction = 1.0 - clamped
    }

    /// Update divider position between two panes (vertical).
    func updateDividerVertical(fraction: CGFloat) {
        guard config.panes.count == 2 else { return }
        let clamped = min(max(fraction, 0.2), 0.8)
        config.panes[0].heightFraction = clamped
        config.panes[1].heightFraction = 1.0 - clamped
    }

    /// Send a message to all panes (linked mode).
    func sendLinkedMessage(_ content: String, appState: AppState) {
        guard config.isLinked else { return }
        for pane in config.panes {
            if let bot = appState.bots.first(where: { $0.id == pane.botId }) {
                let vm = appState.viewModel(for: bot)
                Task { await vm.send(content) }
            }
        }
        NotificationCenter.default.post(
            name: .module_splitpane_linkedMessage,
            object: nil,
            userInfo: ["content": content]
        )
    }

    // MARK: - Persistence

    private func save() {
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: Self.configKey)
        }
    }

    /// Clear all persisted state (for module removal).
    func clearAll() {
        UserDefaults.standard.removeObject(forKey: Self.configKey)
        config = .default
    }
}

// MARK: - Split Pane Container View

struct SplitPaneContainerView: View {
    @StateObject private var vm = SplitPaneViewModel()
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var animPrefs: AnimationPreferences

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            VStack(spacing: 0) {
                // Toolbar
                splitPaneToolbar

                Divider().background(Color.optaBorder.opacity(0.3))

                // Pane content
                if vm.config.panes.isEmpty {
                    emptyState
                } else {
                    paneGrid
                }
            }
        }
        .onAppear {
            vm.initialize(appState: appState)
        }
        .onReceive(NotificationCenter.default.publisher(for: .module_splitpane_toggle)) { _ in
            // handled by parent — this view is shown when splitPane mode is active
        }
        .sheet(isPresented: $vm.showPaneSelector) {
            PaneBotSelectorSheet(
                bots: appState.bots,
                onSelect: { botId in
                    if let paneId = vm.pendingPaneId {
                        vm.setBotForPane(paneId, botId: botId)
                    } else {
                        vm.addPane(botId: botId)
                    }
                    vm.showPaneSelector = false
                    vm.pendingPaneId = nil
                }
            )
        }
    }

    // MARK: - Toolbar

    private var splitPaneToolbar: some View {
        HStack(spacing: 12) {
            // Layout picker
            HStack(spacing: 4) {
                ForEach(PaneLayoutMode.allCases, id: \.rawValue) { mode in
                    Button(action: {
                        withAnimation(.optaSpring) {
                            vm.config.layout = mode
                            // Trim excess panes if layout has fewer slots
                            while vm.config.panes.count > mode.maxPanes {
                                vm.config.panes.removeLast()
                            }
                        }
                    }) {
                        Image(systemName: mode.icon)
                            .font(.system(size: 12))
                            .foregroundColor(vm.config.layout == mode ? .optaPrimary : .optaTextMuted)
                            .frame(width: 26, height: 26)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(vm.config.layout == mode ? Color.optaPrimary.opacity(0.15) : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                    .help(mode.label)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .glassSubtle()

            Spacer()

            // Linked mode toggle
            Button(action: {
                withAnimation(.optaSnap) {
                    vm.config.isLinked.toggle()
                }
            }) {
                HStack(spacing: 5) {
                    Image(systemName: vm.config.isLinked ? "link" : "link.badge.plus")
                        .font(.system(size: 11))
                    Text(vm.config.isLinked ? "Linked" : "Independent")
                        .font(.sora(11, weight: .medium))
                }
                .foregroundColor(vm.config.isLinked ? .optaPrimary : .optaTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .glassPill()
            }
            .buttonStyle(.plain)
            .help("Linked: send message to all panes simultaneously (Cmd+Shift+L)")

            // Add pane button
            if vm.config.panes.count < vm.config.layout.maxPanes {
                Button(action: {
                    vm.pendingPaneId = nil
                    vm.showPaneSelector = true
                }) {
                    Image(systemName: "plus.rectangle")
                        .font(.system(size: 12))
                        .foregroundColor(.optaTextSecondary)
                        .frame(width: 28, height: 28)
                        .glassSubtle()
                }
                .buttonStyle(.plain)
                .help("Add pane (Cmd+Shift+A)")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.optaSurface.opacity(0.3))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "rectangle.split.2x1")
                .font(.system(size: 44))
                .foregroundColor(.optaTextMuted)

            Text("Split-Pane Chat")
                .font(.sora(17, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            Text("Talk to multiple bots side-by-side")
                .font(.sora(13))
                .foregroundColor(.optaTextSecondary)

            Button("Set Up Panes") {
                vm.initialize(appState: appState)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.optaPrimary.opacity(0.2))
            .clipShape(Capsule())
            .foregroundColor(.optaPrimary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Pane Grid

    @ViewBuilder
    private var paneGrid: some View {
        let layout = vm.config.layout
        let panes = vm.config.panes

        switch layout {
        case .sideBySide, .focusLeft, .focusRight:
            horizontalPanes(panes)

        case .stacked:
            verticalPanes(panes)

        case .grid:
            gridPanes(panes)
        }
    }

    private func horizontalPanes(_ panes: [ChatPane]) -> some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                ForEach(Array(panes.enumerated()), id: \.element.id) { index, pane in
                    let width: CGFloat = {
                        switch vm.config.layout {
                        case .focusLeft:
                            return index == 0 ? geo.size.width * 0.65 : geo.size.width * 0.35
                        case .focusRight:
                            return index == 0 ? geo.size.width * 0.35 : geo.size.width * 0.65
                        default:
                            return geo.size.width * pane.widthFraction
                        }
                    }()

                    PaneChatView(
                        pane: pane,
                        isFocused: vm.focusedPaneId == pane.id,
                        isLinked: vm.config.isLinked,
                        onFocus: { vm.focusedPaneId = pane.id },
                        onClose: { withAnimation(.optaSpring) { vm.removePane(id: pane.id) } },
                        onSwapBot: {
                            vm.pendingPaneId = pane.id
                            vm.showPaneSelector = true
                        },
                        onLinkedSend: { content in
                            vm.sendLinkedMessage(content, appState: appState)
                        }
                    )
                    .frame(width: width)

                    // Draggable divider
                    if index < panes.count - 1 && vm.config.layout == .sideBySide {
                        SplitDivider(isVertical: true) { delta in
                            let fraction = panes[0].widthFraction + delta / geo.size.width
                            vm.updateDividerHorizontal(fraction: fraction)
                        }
                    }
                }
            }
        }
    }

    private func verticalPanes(_ panes: [ChatPane]) -> some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                ForEach(Array(panes.enumerated()), id: \.element.id) { index, pane in
                    let height = geo.size.height * pane.heightFraction

                    PaneChatView(
                        pane: pane,
                        isFocused: vm.focusedPaneId == pane.id,
                        isLinked: vm.config.isLinked,
                        onFocus: { vm.focusedPaneId = pane.id },
                        onClose: { withAnimation(.optaSpring) { vm.removePane(id: pane.id) } },
                        onSwapBot: {
                            vm.pendingPaneId = pane.id
                            vm.showPaneSelector = true
                        },
                        onLinkedSend: { content in
                            vm.sendLinkedMessage(content, appState: appState)
                        }
                    )
                    .frame(height: height)

                    if index < panes.count - 1 {
                        SplitDivider(isVertical: false) { delta in
                            let fraction = panes[0].heightFraction + delta / geo.size.height
                            vm.updateDividerVertical(fraction: fraction)
                        }
                    }
                }
            }
        }
    }

    private func gridPanes(_ panes: [ChatPane]) -> some View {
        GeometryReader { geo in
            let halfWidth = geo.size.width / 2
            let halfHeight = geo.size.height / 2

            VStack(spacing: 1) {
                HStack(spacing: 1) {
                    if panes.count > 0 {
                        gridCell(panes[0], width: halfWidth, height: halfHeight)
                    }
                    if panes.count > 1 {
                        gridCell(panes[1], width: halfWidth, height: halfHeight)
                    }
                }
                HStack(spacing: 1) {
                    if panes.count > 2 {
                        gridCell(panes[2], width: halfWidth, height: halfHeight)
                    }
                    if panes.count > 3 {
                        gridCell(panes[3], width: halfWidth, height: halfHeight)
                    }
                }
            }
        }
    }

    private func gridCell(_ pane: ChatPane, width: CGFloat, height: CGFloat) -> some View {
        PaneChatView(
            pane: pane,
            isFocused: vm.focusedPaneId == pane.id,
            isLinked: vm.config.isLinked,
            onFocus: { vm.focusedPaneId = pane.id },
            onClose: { withAnimation(.optaSpring) { vm.removePane(id: pane.id) } },
            onSwapBot: {
                vm.pendingPaneId = pane.id
                vm.showPaneSelector = true
            },
            onLinkedSend: { content in
                vm.sendLinkedMessage(content, appState: appState)
            }
        )
        .frame(width: width, height: height)
    }
}

// MARK: - Pane Chat View (Individual Pane)

struct PaneChatView: View {
    let pane: ChatPane
    let isFocused: Bool
    let isLinked: Bool
    let onFocus: () -> Void
    let onClose: () -> Void
    let onSwapBot: () -> Void
    let onLinkedSend: (String) -> Void

    @EnvironmentObject var appState: AppState
    @State private var messageText: String = ""
    @FocusState private var inputFocused: Bool

    private var bot: BotConfig? {
        appState.bots.first(where: { $0.id == pane.botId })
    }

    private var viewModel: ChatViewModel? {
        guard let bot else { return nil }
        return appState.viewModel(for: bot)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Pane header
            paneHeader

            Divider().background(Color.optaBorder.opacity(0.3))

            // Messages
            if let vm = viewModel {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(vm.messages) { message in
                                MessageBubble(
                                    message: message,
                                    botId: pane.botId
                                )
                                .id(message.id)
                            }
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                    }
                    .onChange(of: vm.messages.count) { _, _ in
                        if let last = vm.messages.last {
                            withAnimation(.optaGentle) {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }
            } else {
                Text("No bot assigned")
                    .font(.sora(13))
                    .foregroundColor(.optaTextMuted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            Divider().background(Color.optaBorder.opacity(0.3))

            // Input
            paneInput
        }
        .background(Color.optaVoid)
        .overlay(
            RoundedRectangle(cornerRadius: 0)
                .stroke(isFocused ? Color.optaPrimary.opacity(0.4) : Color.optaBorder.opacity(0.15), lineWidth: isFocused ? 2 : 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { onFocus() }
    }

    // MARK: - Pane Header

    private var paneHeader: some View {
        HStack(spacing: 8) {
            if let bot {
                Text(bot.emoji)
                    .font(.system(size: 14))

                Text(bot.name)
                    .font(.sora(12, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                if let vm = viewModel {
                    Circle()
                        .fill(vm.connectionState == .connected ? Color.optaGreen : Color.optaRed)
                        .frame(width: 6, height: 6)
                }
            }

            Spacer()

            if isLinked {
                Image(systemName: "link")
                    .font(.system(size: 9))
                    .foregroundColor(.optaPrimary.opacity(0.6))
            }

            Button(action: onSwapBot) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
            .help("Swap bot")

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
            .buttonStyle(.plain)
            .help("Close pane")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(isFocused ? Color.optaSurface.opacity(0.5) : Color.optaSurface.opacity(0.2))
    }

    // MARK: - Pane Input

    private var paneInput: some View {
        HStack(spacing: 8) {
            TextField("Message \(bot?.name ?? "")...", text: $messageText)
                .textFieldStyle(.plain)
                .font(.sora(13))
                .foregroundColor(.optaTextPrimary)
                .focused($inputFocused)
                .onSubmit { sendMessage() }

            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(messageText.isEmpty ? .optaTextMuted : .optaPrimary)
            }
            .buttonStyle(.plain)
            .disabled(messageText.isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.optaSurface.opacity(0.3))
    }

    private func sendMessage() {
        let trimmed = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if isLinked {
            onLinkedSend(trimmed)
        } else if let viewModel {
            Task { await viewModel.send(trimmed) }
        }
        messageText = ""
    }
}

// MARK: - Split Divider

struct SplitDivider: View {
    let isVertical: Bool
    let onDrag: (CGFloat) -> Void

    @State private var isHovered = false

    var body: some View {
        Rectangle()
            .fill(isHovered ? Color.optaPrimary.opacity(0.4) : Color.optaBorder.opacity(0.2))
            .frame(
                width: isVertical ? 5 : nil,
                height: isVertical ? nil : 5
            )
            .contentShape(Rectangle())
            .onHover { hover in
                withAnimation(.optaSnap) { isHovered = hover }
                if hover {
                    if isVertical {
                        NSCursor.resizeLeftRight.push()
                    } else {
                        NSCursor.resizeUpDown.push()
                    }
                } else {
                    NSCursor.pop()
                }
            }
            .onDisappear {
                if isHovered {
                    NSCursor.pop()
                }
            }
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let delta = isVertical ? value.translation.width : value.translation.height
                        onDrag(delta)
                    }
            )
            .overlay(
                Group {
                    if isHovered {
                        Capsule()
                            .fill(Color.optaPrimary.opacity(0.6))
                            .frame(
                                width: isVertical ? 2 : 30,
                                height: isVertical ? 30 : 2
                            )
                    }
                }
            )
    }
}

// MARK: - Bot Selector Sheet

struct PaneBotSelectorSheet: View {
    let bots: [BotConfig]
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("Select Bot for Pane")
                .font(.sora(15, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 12)], spacing: 12) {
                ForEach(bots) { bot in
                    Button(action: { onSelect(bot.id) }) {
                        VStack(spacing: 6) {
                            Text(bot.emoji)
                                .font(.system(size: 24))
                            Text(bot.name)
                                .font(.sora(12, weight: .medium))
                                .foregroundColor(.optaTextPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .glassSubtle()
                    }
                    .buttonStyle(.plain)
                }
            }

            Button("Cancel") { dismiss() }
                .buttonStyle(.plain)
                .foregroundColor(.optaTextMuted)
        }
        .padding(24)
        .frame(width: 360)
        .background(Color.optaSurface)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_splitpane_toggle = Notification.Name("module.splitpane.toggle")
    static let module_splitpane_linkedMessage = Notification.Name("module.splitpane.linkedMessage")
}

// MARK: - Module Registration

/// **To add:**
///   1. Add `case splitPane` to `DetailMode` in ContentView.swift
///   2. Add notification listener: `.onReceive(.module_splitpane_toggle) { detailMode = .splitPane }`
///   3. Add keyboard shortcut Cmd+Shift+S to post .module_splitpane_toggle
///   4. In detail switch: `case .splitPane: SplitPaneContainerView()`
///   5. Add "Split Pane" action to CommandPalette
///
/// **To remove:**
///   1. Delete this file
///   2. Remove `case splitPane` from DetailMode
///   3. Remove notification listener and keyboard shortcut
///   4. No data cleanup needed — UserDefaults key auto-orphans
enum SplitPaneChatModule {
    static func register() {
        // Module is view-driven — no background registration needed.
        // All wiring happens in ContentView via notification listeners.
    }
}
