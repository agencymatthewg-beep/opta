import SwiftUI
import Foundation

// MARK: - Flexible JSON Value
// Handles mixed types from backend: usage/limit can be null, Double, or String

enum FlexValue: Codable {
    case number(Double)
    case text(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let d = try? container.decode(Double.self) {
            self = .number(d)
        } else if let s = try? container.decode(String.self) {
            self = .text(s)
        } else {
            throw DecodingError.typeMismatch(
                FlexValue.self,
                .init(codingPath: decoder.codingPath, debugDescription: "Expected number or string")
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let d): try container.encode(d)
        case .text(let s): try container.encode(s)
        }
    }

    var asDouble: Double? {
        if case .number(let d) = self { return d }
        return nil
    }
}

// MARK: - Data Model

struct ProviderData: Codable {
    let name: String
    let type: String?
    let status: String
    let usage: FlexValue?
    let limit: FlexValue?
    let currency: String?
    let percent: Double?
    let color: String
    let note: String?
    let account: String?

    // Coding keys — all optional fields get defaults
    enum CodingKeys: String, CodingKey {
        case name, type, status, usage, limit, currency, percent, color, note, account
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        type = try c.decodeIfPresent(String.self, forKey: .type)
        status = try c.decode(String.self, forKey: .status)
        usage = try c.decodeIfPresent(FlexValue.self, forKey: .usage)
        limit = try c.decodeIfPresent(FlexValue.self, forKey: .limit)
        currency = try c.decodeIfPresent(String.self, forKey: .currency)
        percent = try c.decodeIfPresent(Double.self, forKey: .percent)
        color = try c.decodeIfPresent(String.self, forKey: .color) ?? "gray"
        note = try c.decodeIfPresent(String.self, forKey: .note)
        account = try c.decodeIfPresent(String.self, forKey: .account)
    }
}

// MARK: - Usage Manager

class UsageManager: ObservableObject {
    @Published var providers: [String: ProviderData] = [:]
    @Published var lastUpdated = Date()
    @Published var isLaunchAtLogin = false

    private var refreshTimer: Timer?

    private static let home = FileManager.default.homeDirectoryForCurrentUser.path

    private var dataFilePath: String {
        "\(Self.home)/Synced/Opta/1-Apps/1D-MonoUsage/backend/data/latest.json"
    }

    private var refreshScriptPath: String {
        "\(Self.home)/Synced/Opta/1-Apps/1D-MonoUsage/backend/scripts/refresh-all.js"
    }

    private var launchAgentPath: String {
        "\(Self.home)/Library/LaunchAgents/com.opta.MonoUsage.plist"
    }

    init() {
        isLaunchAtLogin = FileManager.default.fileExists(atPath: launchAgentPath)
        loadData()
        startAutoRefresh()
    }

    func loadData() {
        let url = URL(fileURLWithPath: dataFilePath)
        guard let raw = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: ProviderData].self, from: raw) else {
            return
        }
        DispatchQueue.main.async {
            self.providers = decoded
            self.lastUpdated = Date()
        }
    }

    func triggerBackendRefresh() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        task.arguments = ["node", refreshScriptPath]
        task.standardOutput = nil
        task.standardError = nil
        try? task.run()

        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) {
            self.loadData()
        }
    }

    func startAutoRefresh() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.loadData()
        }
    }

    // MARK: Spend Totals

    var spendTotals: (usd: Double, cny: Double) {
        var usd = 0.0, cny = 0.0
        for p in providers.values {
            guard let u = p.usage?.asDouble, let c = p.currency else { continue }
            if c == "USD" { usd += u }
            else if c == "CNY" { cny += u }
        }
        return (usd, cny)
    }

    var menuBarLabel: String {
        let t = spendTotals
        var label = "$\(String(format: "%.2f", t.usd))"
        if t.cny > 0 {
            label += " ¥\(String(format: "%.0f", t.cny))"
        }
        return label
    }

    // MARK: Sorted Providers

    var sortedProviders: [(key: String, value: ProviderData)] {
        providers.sorted { a, b in
            let typeA = a.value.type ?? "zzz"
            let typeB = b.value.type ?? "zzz"
            if typeA != typeB { return typeA < typeB }
            return a.value.name < b.value.name
        }
    }

    // MARK: Launch at Login

    func toggleLaunchAtLogin() {
        if isLaunchAtLogin {
            // Unload and remove
            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
            task.arguments = ["unload", launchAgentPath]
            try? task.run()
            task.waitUntilExit()
            try? FileManager.default.removeItem(atPath: launchAgentPath)
            isLaunchAtLogin = false
        } else {
            // Create LaunchAgent plist
            let execPath = ProcessInfo.processInfo.arguments[0]
            let plist: [String: Any] = [
                "Label": "com.opta.MonoUsage",
                "ProgramArguments": [execPath],
                "RunAtLoad": true,
                "KeepAlive": false
            ]

            let dir = (launchAgentPath as NSString).deletingLastPathComponent
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)

            if let data = try? PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0) {
                try? data.write(to: URL(fileURLWithPath: launchAgentPath))
                let task = Process()
                task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
                task.arguments = ["load", launchAgentPath]
                try? task.run()
                task.waitUntilExit()
                isLaunchAtLogin = true
            }
        }
    }
}

// MARK: - Color Helper

func themeColor(for item: ProviderData) -> Color {
    // Percentage-based thresholds take priority
    if let pct = item.percent {
        if pct < 0.5 { return .green }
        if pct < 0.8 { return .yellow }
        return .red
    }
    // Fall back to backend-provided color string
    switch item.color {
    case "green": return .green
    case "yellow": return .yellow
    case "orange": return .orange
    case "red": return .red
    case "blue": return .blue
    default: return .gray
    }
}

// MARK: - App Delegate (hide from Dock)

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }
}

// MARK: - App Entry Point

@main
struct MonoUsageApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject var manager = UsageManager()

    var body: some Scene {
        MenuBarExtra {
            DashboardView(manager: manager)
        } label: {
            HStack(spacing: 2) {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 9))
                Text(manager.menuBarLabel)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
            }
        }
        .menuBarExtraStyle(.window)
    }
}

// MARK: - Dashboard View

struct DashboardView: View {
    @ObservedObject var manager: UsageManager

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerBar

            Divider()

            // Total spend summary
            TotalSpendRow(totals: manager.spendTotals)

            Divider()

            // Provider list
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(manager.sortedProviders, id: \.key) { _, provider in
                        ProviderRow(item: provider)
                    }
                }
                .padding()
            }
            .frame(maxHeight: 400)

            Divider()

            // Footer
            footerBar
        }
        .frame(width: 320)
    }

    private var headerBar: some View {
        HStack {
            Text("MonoUsage")
                .font(.headline)
            Spacer()
            Button(action: { manager.triggerBackendRefresh() }) {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.plain)
            .help("Refresh all APIs")

            Button(action: { NSApplication.shared.terminate(nil) }) {
                Image(systemName: "xmark.circle")
            }
            .buttonStyle(.plain)
            .help("Quit MonoUsage")
        }
        .padding()
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var footerBar: some View {
        VStack(spacing: 6) {
            Toggle("Launch at Login", isOn: Binding(
                get: { manager.isLaunchAtLogin },
                set: { _ in manager.toggleLaunchAtLogin() }
            ))
            .toggleStyle(.switch)
            .controlSize(.small)

            HStack {
                Text("Updated \(manager.lastUpdated.formatted(date: .omitted, time: .standard))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("v2.0")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(10)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

// MARK: - Total Spend Row

struct TotalSpendRow: View {
    let totals: (usd: Double, cny: Double)

    var body: some View {
        HStack {
            Image(systemName: "dollarsign.circle.fill")
                .foregroundColor(.green)
                .font(.system(size: 14))
            Text("Today")
                .font(.system(size: 12, weight: .semibold))
            Spacer()

            HStack(spacing: 10) {
                Text("$\(String(format: "%.2f", totals.usd))")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))

                if totals.cny > 0 {
                    Text("¥\(String(format: "%.2f", totals.cny))")
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundColor(.orange)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
    }
}

// MARK: - Provider Row

struct ProviderRow: View {
    let item: ProviderData

    private var displayColor: Color { themeColor(for: item) }

    private var currencySymbol: String {
        switch item.currency {
        case "CNY": return "¥"
        case "EUR": return "€"
        case "GBP": return "£"
        default: return "$"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Top line: status dot, name, type badge, usage value
            HStack {
                Circle()
                    .fill(displayColor)
                    .frame(width: 8, height: 8)

                Text(item.name)
                    .font(.system(size: 12, weight: .medium))

                if let type = item.type {
                    Text(type.uppercased())
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.secondary.opacity(0.15))
                        .cornerRadius(3)
                }

                Spacer()

                // Usage amount or status text
                if let d = item.usage?.asDouble {
                    Text("\(currencySymbol)\(String(format: "%.2f", d))")
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(displayColor)
                } else {
                    Text(item.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }

            // Progress bar (only when we have a percentage)
            if let pct = item.percent {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.gray.opacity(0.2))
                        Capsule().fill(displayColor)
                            .frame(width: geo.size.width * CGFloat(min(pct, 1.0)))
                    }
                }
                .frame(height: 4)

                HStack {
                    Text("\(Int(pct * 100))% used")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    if let lim = item.limit?.asDouble {
                        Text("of \(currencySymbol)\(String(format: "%.0f", lim))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Note line
            if let note = item.note {
                Text(note)
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(8)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }
}
