import SwiftUI
import OptaPlus
import OptaMolt

struct TempRootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var pairingCoordinator: PairingCoordinator
    @State private var selectedTabId = TempTabRegistry.orderedTabs.first?.id ?? "home"
    @State private var showLegacyPicker = false

    var body: some View {
        GeometryReader { _ in
            ZStack {
                Color.optaTempBackground.ignoresSafeArea()
                tabView(for: selectedTabDescriptor)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottom) {
                TempBottomBar(
                    tabs: primaryTabs,
                    selectedTabId: activePrimaryTabId,
                    onSelect: handleBottomTabSelection
                )
            }
        }
        .sheet(isPresented: $showLegacyPicker) {
            LegacyTabPicker(tabs: legacyTabs, onSelect: selectTab)
        }
        .toolbar(.hidden, for: .navigationBar)
        .preferredColorScheme(.dark)
    }

    private var primaryTabs: [TempTabDescriptor] {
        TempTabRegistry.orderedTabs.filter { ["home", "plan", "chat", "work", "more"].contains($0.id) }
    }

    private var legacyTabs: [TempTabDescriptor] {
        TempTabRegistry.orderedTabs.filter { !["home", "plan", "chat", "work", "more"].contains($0.id) }
    }

    private var selectedTabDescriptor: TempTabDescriptor {
        TempTabRegistry.orderedTabs.first(where: { $0.id == selectedTabId }) ?? TempTabRegistry.orderedTabs[0]
    }

    private var activePrimaryTabId: String {
        primaryTabs.contains(where: { $0.id == selectedTabId }) ? selectedTabId : "more"
    }

    @ViewBuilder
    private func tabView(for tab: TempTabDescriptor) -> some View {
        switch tab.id {
        case "home":
            SaturdayHomeView(selectTab: selectTab)
        case "plan":
            SaturdayPlanView()
        case "work":
            SaturdayWorkView()
        case "chat":
            SaturdayChatView(selectTab: selectTab)
        case "more":
            SaturdayMoreView(selectTab: selectTab, legacyTabs: legacyTabs, showLegacyPicker: { showLegacyPicker = true })
        case "map":
            BotMapView()
                .environmentObject(appState)
                .environmentObject(pairingCoordinator)
        case "legacy-chat":
            if appState.bots.isEmpty {
                LegacyEmptyState(title: "Legacy Chat", detail: "Add or pair a bot first.")
            } else {
                ChatPagerTab()
                    .environmentObject(appState)
            }
        case "automations":
            if appState.bots.isEmpty {
                LegacyEmptyState(title: "Automations", detail: "Add or pair a bot first.")
            } else {
                AutomationsPagerTab()
                    .environmentObject(appState)
            }
        case "settings":
            SettingsView(isModal: false)
                .environmentObject(appState)
        case "diagnostics":
            DebugView()
                .environmentObject(appState)
        default:
            LegacyEmptyState(title: tab.title, detail: "Page is not wired yet.")
        }
    }

    private func selectTab(_ id: String) {
        guard TempTabRegistry.orderedTabs.contains(where: { $0.id == id }) else { return }
        selectedTabId = id
    }

    private func handleBottomTabSelection(_ id: String) {
        guard ["home", "plan", "chat", "work", "more"].contains(id) else { return }
        if id == "more" && selectedTabId == "more" {
            showLegacyPicker = true
            return
        }
        selectTab(id)
    }
}

private enum TempLayout {
    static let horizontalPadding: CGFloat = 16
    static let baseTopPadding: CGFloat = 12
    static let tabBarClearance: CGFloat = 164
    static let tabBarHorizontalInset: CGFloat = 16
    static let tabBarBottomPadding: CGFloat = 8
    static let tabBarIconSize: CGFloat = 18
}

private struct LegacyEmptyState: View {
    let title: String
    let detail: String

    var body: some View {
        ZStack {
            Color.optaTempBackground.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "wrench.and.screwdriver")
                    .font(.system(size: 32, weight: .regular))
                    .foregroundStyle(Color.optaTempTextMuted)
                Text(title)
                    .font(.optaTempSection)
                    .foregroundStyle(Color.optaTempTextPrimary)
                Text(detail)
                    .font(.optaTempBody)
                    .foregroundStyle(Color.optaTempTextSecondary)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct SaturdayShell<Content: View>: View {
    let scrollable: Bool
    @ViewBuilder let content: Content

    var body: some View {
        GeometryReader { _ in
            let topPadding = TempLayout.baseTopPadding

            ZStack {
                Color.optaTempBackground.ignoresSafeArea()
                if scrollable {
                    ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 16) {
                        content
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, TempLayout.horizontalPadding)
                    .padding(.top, topPadding)
                    .padding(.bottom, TempLayout.tabBarClearance)
                }
                .contentMargins(.top, 0, for: .scrollContent)
                .contentMargins(.top, 0, for: .scrollIndicators)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else {
                    VStack(alignment: .leading, spacing: 16) {
                        content
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(.horizontal, TempLayout.horizontalPadding)
                    .padding(.top, topPadding)
                    .padding(.bottom, TempLayout.tabBarClearance)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

private struct TempTabHeader: View {
    let eyebrow: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(eyebrow)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .tracking(0.4)
                .foregroundStyle(Color.optaTempTextMuted)
            Text(title)
                .font(.optaTempTitle)
                .foregroundStyle(Color.optaTempTextPrimary)
            Text(detail)
                .font(.optaTempBody)
                .foregroundStyle(Color.optaTempTextSecondary)
        }
        .padding(.top, 2)
    }
}

private struct SaturdayTemplateNote: View {
    var body: some View {
        TempCard(title: "Daily Brief", subtitle: "Saturday structure, Opta aesthetic") {
            Text("This temp app mirrors Josh’s Saturday tab architecture while exposing Opta legacy pages at the end.")
                .font(.optaTempBody)
                .foregroundStyle(Color.optaTempTextSecondary)
        }
    }
}

private struct SaturdayHomeView: View {
    let selectTab: (String) -> Void

    var body: some View {
        SaturdayShell(scrollable: true) {
            TempTabHeader(
                eyebrow: "OPTA PLUS",
                title: "Command Center",
                detail: "Saturday-inspired shell with Opta visual language."
            )

            SaturdayTemplateNote()

            VStack(alignment: .leading, spacing: 10) {
                Text("Quick Actions")
                    .font(.optaTempSection)
                    .foregroundStyle(Color.optaTempTextPrimary)
                HStack(spacing: 10) {
                    TempAction(title: "Chat", symbol: "bubble.left.and.bubble.right", tint: .optaTempPrimary) {
                        selectTab("chat")
                    }
                    TempAction(title: "Plan", symbol: "calendar", tint: .optaTempSecondary) {
                        selectTab("plan")
                    }
                    TempAction(title: "Legacy", symbol: "square.stack.3d.up", tint: .optaTempAccent) {
                        selectTab("map")
                    }
                }
            }

            TempCard(title: "Legacy Strip", subtitle: "Current Opta pages appended") {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(["Map", "Legacy Chat", "Automations", "Settings", "Diagnostics"], id: \.self) { item in
                        Text("• \(item)")
                            .font(.optaTempBody)
                            .foregroundStyle(Color.optaTempTextSecondary)
                    }
                }
            }
        }
    }
}

private struct SaturdayPlanView: View {
    var body: some View {
        SaturdayShell(scrollable: true) {
            TempTabHeader(
                eyebrow: "PLANNING LANE",
                title: "Plan",
                detail: "Daily structure, schedules, and automation timing."
            )
            TempCard(title: "Plan", subtitle: "Calendar + tasks layout lane") {
                Text("Uses Saturday-inspired stacked planning sections as the future destination for Opta scheduling and cron orchestration views.")
                    .font(.optaTempBody)
                    .foregroundStyle(Color.optaTempTextSecondary)
            }
            TempPlaceholderRows(rows: ["Week strip", "Placement tracker", "Habit tracker", "Task stack"])
        }
    }
}

private struct SaturdayWorkView: View {
    var body: some View {
        SaturdayShell(scrollable: true) {
            TempTabHeader(
                eyebrow: "PROJECT LANE",
                title: "Work",
                detail: "Bot projects, task queues, and active operations."
            )
            TempCard(title: "Work", subtitle: "Project-isolated sessions") {
                Text("This slot is intentionally shaped like Saturday’s project board lane so we can merge Opta bot projects and task pipelines into it.")
                    .font(.optaTempBody)
                    .foregroundStyle(Color.optaTempTextSecondary)
            }
            TempPlaceholderRows(rows: ["Project cards", "Pipeline board", "Archived projects"])
        }
    }
}

private struct SaturdayChatView: View {
    let selectTab: (String) -> Void

    var body: some View {
        SaturdayShell(scrollable: false) {
            TempTabHeader(
                eyebrow: "CHAT LANE",
                title: "Chat",
                detail: "Saturday shell now linked to Opta legacy chat for comparison."
            )

            TempCard(title: "Saturday-style Chat Shell", subtitle: "Header + stream lane + input rail") {
                VStack(alignment: .leading, spacing: 6) {
                    Text("This is the redesigned shell for chat interaction. Use the Legacy Chat tab to compare with current Opta implementation.")
                        .font(.optaTempBody)
                        .foregroundStyle(Color.optaTempTextSecondary)
                    Button("Open Legacy Chat") {
                        selectTab("legacy-chat")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.optaTempPrimary)
                }
            }

            TempCard(title: "Merge Workspace", subtitle: "Feature parity queue") {
                TempPlaceholderRows(rows: ["Primary chat stream", "Context controls", "Model switcher", "Composer rail"])
            }

            Spacer(minLength: 0)
        }
    }
}

private struct SaturdayMoreView: View {
    let selectTab: (String) -> Void
    let legacyTabs: [TempTabDescriptor]
    let showLegacyPicker: () -> Void

    var body: some View {
        SaturdayShell(scrollable: true) {
            TempTabHeader(
                eyebrow: "CONTROL LANE",
                title: "More",
                detail: "Operational controls and settings consolidation."
            )
            TempCard(title: "More", subtitle: "Settings and infra controls") {
                Text("Gateway controls, alerts, and operational toggles can be consolidated here, then compared against legacy Settings/Diagnostics tabs.")
                    .font(.optaTempBody)
                    .foregroundStyle(Color.optaTempTextSecondary)
            }
            TempPlaceholderRows(rows: ["Gateway controls", "Alerts center", "System settings", "Feature flags"])

            TempCard(title: "Legacy Pages", subtitle: "Appended from current Opta iOS build") {
                VStack(spacing: 8) {
                    ForEach(legacyTabs) { tab in
                        Button {
                            selectTab(tab.id)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: tab.symbol)
                                    .foregroundStyle(Color.optaTempSecondary)
                                Text(tab.title)
                                    .font(.optaTempBody)
                                    .foregroundStyle(Color.optaTempTextPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Color.optaTempTextMuted)
                            }
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.optaTempRaised)
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    Button("Show Legacy Picker") {
                        showLegacyPicker()
                    }
                    .buttonStyle(.bordered)
                    .tint(.optaTempSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

private struct TempBottomBar: View {
    let tabs: [TempTabDescriptor]
    let selectedTabId: String
    let onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs) { tab in
                let isSelected = tab.id == selectedTabId
                Button {
                    onSelect(tab.id)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.symbol)
                            .font(.system(size: TempLayout.tabBarIconSize, weight: isSelected ? .semibold : .regular))
                        Text(tab.title)
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                    }
                    .foregroundStyle(isSelected ? Color.optaTempPrimary : Color.optaTempTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(isSelected ? Color.optaTempPrimary.opacity(0.2) : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule(style: .continuous))
        .overlay(
            Capsule(style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        )
        .padding(.horizontal, TempLayout.tabBarHorizontalInset)
        .padding(.bottom, TempLayout.tabBarBottomPadding)
    }
}

private struct LegacyTabPicker: View {
    let tabs: [TempTabDescriptor]
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Legacy Pages") {
                    ForEach(tabs) { tab in
                        Button {
                            onSelect(tab.id)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: tab.symbol)
                                    .foregroundStyle(Color.optaTempSecondary)
                                Text(tab.title)
                                    .foregroundStyle(Color.optaTempTextPrimary)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.optaTempBackground.ignoresSafeArea())
            .navigationTitle("Appended Opta Pages")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private struct TempCard<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.optaTempSection)
                .foregroundStyle(Color.optaTempTextPrimary)
            Text(subtitle)
                .font(.optaTempCaption)
                .foregroundStyle(Color.optaTempTextMuted)
            content
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.optaTempSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.optaTempBorder.opacity(0.65), lineWidth: 1)
                )
        )
    }
}

private struct TempAction: View {
    let title: String
    let symbol: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .semibold))
                Text(title)
                    .font(.optaTempCaption)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(tint.opacity(0.14))
            )
            .foregroundStyle(tint)
        }
        .buttonStyle(.plain)
    }
}

private struct TempPlaceholderRows: View {
    let rows: [String]

    var body: some View {
        VStack(spacing: 10) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.optaTempSecondary.opacity(0.8))
                        .frame(width: 8, height: 8)
                    Text(row)
                        .font(.optaTempBody)
                        .foregroundStyle(Color.optaTempTextSecondary)
                    Spacer()
                }
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.optaTempRaised)
                )
            }
        }
    }
}
