//
//  AutomationsView.swift
//  OptaPlusIOS
//
//  Cron job management — view, toggle, run automations from the OpenClaw gateway.
//

import SwiftUI
import OptaPlus
import OptaMolt

// MARK: - Cron Job Model

struct CronJobItem: Identifiable {
    let id: String
    let name: String
    var enabled: Bool
    let scheduleText: String
    let scheduleKind: String
    let sessionTarget: String
    let payloadKind: String
    let model: String?
    let lastRunAt: Date?
    let nextRunAt: Date?
    let botName: String
    let botEmoji: String
    let botId: String

    var displayName: String {
        name.isEmpty ? id : name
    }
}

// MARK: - Scheduler Status

struct SchedulerStatus {
    let running: Bool
    let jobCount: Int
    let activeCount: Int
}

// MARK: - Automations View

struct AutomationsView: View {
    @EnvironmentObject var appState: AppState
    @State private var jobs: [CronJobItem] = []
    @State private var schedulerStatus: SchedulerStatus?
    @State private var isLoading = false
    @State private var selectedJob: CronJobItem?
    @State private var runningJobIds: Set<String> = []
    @State private var errorMessage: String?

    private var activeJobs: [CronJobItem] {
        jobs.filter { $0.enabled }
    }

    private var disabledJobs: [CronJobItem] {
        jobs.filter { !$0.enabled }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && jobs.isEmpty {
                    ProgressView("Loading automations...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if jobs.isEmpty {
                    emptyState
                } else {
                    jobList
                }
            }
            .background(Color.optaVoid)
            .navigationTitle("Automations")
            .refreshable {
                await loadJobs()
            }
            .task {
                await loadJobs()
            }
            .sheet(item: $selectedJob) { job in
                JobDetailSheet(job: job, onToggle: { toggleJob(job) }, onRun: { runJob(job) })
            }
        }
    }

    private var jobList: some View {
        List {
            // Scheduler header
            if let status = schedulerStatus {
                Section {
                    HStack {
                        Circle()
                            .fill(status.running ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text("Scheduler: \(status.running ? "Running" : "Stopped")")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.optaTextPrimary)
                        Spacer()
                        Text("\(status.jobCount) jobs (\(status.activeCount) active)")
                            .font(.system(size: 12))
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaElevated)
                }
            }

            // Active jobs
            if !activeJobs.isEmpty {
                Section("Active") {
                    ForEach(activeJobs) { job in
                        JobRow(
                            job: job,
                            isRunning: runningJobIds.contains(job.id),
                            onTap: { selectedJob = job },
                            onToggle: { toggleJob(job) },
                            onRun: { runJob(job) }
                        )
                    }
                    .listRowBackground(Color.optaSurface)
                }
            }

            // Disabled jobs
            if !disabledJobs.isEmpty {
                Section("Disabled") {
                    ForEach(disabledJobs) { job in
                        JobRow(
                            job: job,
                            isRunning: runningJobIds.contains(job.id),
                            onTap: { selectedJob = job },
                            onToggle: { toggleJob(job) },
                            onRun: { runJob(job) }
                        )
                    }
                    .listRowBackground(Color.optaSurface)
                }
            }

            if let error = errorMessage {
                Section {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.optaRed)
                }
            }
        }
        .scrollContentBackground(.hidden)
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bolt.circle")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)
            Text("No automations")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)
            Text("Connect to a bot to manage cron jobs")
                .font(.subheadline)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data Loading

    private func loadJobs() async {
        isLoading = true
        defer { isLoading = false }

        var allJobs: [CronJobItem] = []

        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)
            guard vm.isGatewayReady else { continue }

            do {
                // Load cron jobs
                let response = try await vm.call("cron.list", params: ["includeDisabled": true])
                guard let jobsArray = response?.dict?["jobs"] as? [[String: Any]] else { continue }

                for job in jobsArray {
                    guard let jobId = job["id"] as? String ?? job["jobId"] as? String else { continue }

                    let name = job["name"] as? String ?? ""
                    let enabled = job["enabled"] as? Bool ?? true
                    let sessionTarget = job["sessionTarget"] as? String ?? "main"

                    // Parse schedule
                    let scheduleText: String
                    let scheduleKind: String
                    if let schedule = job["schedule"] as? [String: Any] {
                        let kind = schedule["kind"] as? String ?? "unknown"
                        scheduleKind = kind
                        scheduleText = parseSchedule(schedule)
                    } else {
                        scheduleKind = "unknown"
                        scheduleText = "Unknown schedule"
                    }

                    // Parse payload
                    let payloadKind: String
                    let model: String?
                    if let payload = job["payload"] as? [String: Any] {
                        payloadKind = payload["kind"] as? String ?? "unknown"
                        model = payload["model"] as? String
                    } else {
                        payloadKind = "unknown"
                        model = nil
                    }

                    // Parse dates
                    let lastRunAt = parseDate(job["lastRunAt"])
                    let nextRunAt = parseDate(job["nextRunAt"])

                    allJobs.append(CronJobItem(
                        id: jobId,
                        name: name,
                        enabled: enabled,
                        scheduleText: scheduleText,
                        scheduleKind: scheduleKind,
                        sessionTarget: sessionTarget,
                        payloadKind: payloadKind,
                        model: model,
                        lastRunAt: lastRunAt,
                        nextRunAt: nextRunAt,
                        botName: bot.name,
                        botEmoji: bot.emoji,
                        botId: bot.id
                    ))
                }

                // Load scheduler status
                let statusResult = try? await vm.call("cron.status")
                if let statusDict = statusResult?.dict {
                    let running = statusDict["running"] as? Bool ?? false
                    let total = statusDict["totalJobs"] as? Int ?? allJobs.count
                    let active = statusDict["activeJobs"] as? Int ?? allJobs.filter { $0.enabled }.count
                    schedulerStatus = SchedulerStatus(running: running, jobCount: total, activeCount: active)
                }
            } catch {
                NSLog("[Automations] Failed to load for \(bot.name): \(error)")
                errorMessage = "Failed to load from \(bot.name): \(error.localizedDescription)"
            }
        }

        jobs = allJobs.sorted { ($0.enabled ? 0 : 1, $0.name) < ($1.enabled ? 0 : 1, $1.name) }
    }

    // MARK: - Actions

    private func toggleJob(_ job: CronJobItem) {
        guard let vm = viewModel(for: job) else { return }
        Task {
            do {
                _ = try await vm.call("cron.update", params: [
                    "jobId": job.id,
                    "patch": ["enabled": !job.enabled] as [String: Any]
                ])
                if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                    jobs[idx].enabled.toggle()
                }
            } catch {
                errorMessage = "Toggle failed: \(error.localizedDescription)"
            }
        }
    }

    private func runJob(_ job: CronJobItem) {
        guard let vm = viewModel(for: job) else { return }
        runningJobIds.insert(job.id)
        Task {
            do {
                _ = try await vm.call("cron.run", params: ["jobId": job.id])
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                errorMessage = "Run failed: \(error.localizedDescription)"
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            runningJobIds.remove(job.id)
        }
    }

    private func viewModel(for job: CronJobItem) -> ChatViewModel? {
        guard let bot = appState.bots.first(where: { $0.id == job.botId }) else { return nil }
        return appState.viewModel(for: bot)
    }

    // MARK: - Parsing Helpers

    private func parseSchedule(_ schedule: [String: Any]) -> String {
        let kind = schedule["kind"] as? String ?? ""
        switch kind {
        case "cron":
            let expr = schedule["expression"] as? String ?? schedule["expr"] as? String ?? "?"
            return parseCronExpression(expr)
        case "every":
            let ms = schedule["intervalMs"] as? Int ?? schedule["interval"] as? Int ?? 0
            return formatInterval(ms)
        case "at":
            if let ts = schedule["date"] as? Double {
                let date = Date(timeIntervalSince1970: ts / 1000)
                let f = DateFormatter()
                f.dateStyle = .medium
                f.timeStyle = .short
                return f.string(from: date)
            }
            return "One-time"
        default:
            return "Unknown"
        }
    }

    private func parseCronExpression(_ expr: String) -> String {
        let parts = expr.split(separator: " ")
        guard parts.count >= 5 else { return expr }
        let min = String(parts[0])
        let hour = String(parts[1])

        if min != "*" && hour != "*" {
            return "Daily at \(hour.leftPad(2)):\(min.leftPad(2))"
        }
        if parts[4] != "*" {
            return "Weekly — \(expr)"
        }
        return expr
    }

    private func formatInterval(_ ms: Int) -> String {
        if ms < 60000 { return "Every \(ms / 1000)s" }
        if ms < 3600000 { return "Every \(ms / 60000)m" }
        return "Every \(ms / 3600000)h"
    }

    private func parseDate(_ value: Any?) -> Date? {
        if let ts = value as? Double { return Date(timeIntervalSince1970: ts / 1000) }
        if let ts = value as? Int { return Date(timeIntervalSince1970: Double(ts) / 1000) }
        return nil
    }
}

// MARK: - String Padding Helper

private extension String {
    func leftPad(_ length: Int, pad: Character = "0") -> String {
        String(repeating: pad, count: max(0, length - count)) + self
    }
}

// MARK: - Job Row

struct JobRow: View {
    let job: CronJobItem
    let isRunning: Bool
    let onTap: () -> Void
    let onToggle: () -> Void
    let onRun: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(job.botEmoji)
                        .font(.system(size: 14))
                    Text(job.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { job.enabled },
                        set: { _ in onToggle() }
                    ))
                    .labelsHidden()
                    .tint(.optaPrimary)
                }

                HStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                        .foregroundColor(.optaTextMuted)
                    Text(job.scheduleText)
                        .font(.system(size: 12))
                        .foregroundColor(.optaTextSecondary)

                    if let model = job.model {
                        Text("· \(model)")
                            .font(.system(size: 11))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                HStack {
                    if let lastRun = job.lastRunAt {
                        Text("Last: \(relativeTime(lastRun))")
                            .font(.system(size: 11))
                            .foregroundColor(.optaTextMuted)
                    }

                    Spacer()

                    if job.enabled {
                        Button(action: onRun) {
                            HStack(spacing: 4) {
                                if isRunning {
                                    ProgressView()
                                        .scaleEffect(0.6)
                                        .tint(.optaPrimary)
                                } else {
                                    Image(systemName: "play.fill")
                                        .font(.system(size: 10))
                                }
                                Text("Run Now")
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundColor(.optaPrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.optaPrimary.opacity(0.15)))
                        }
                        .buttonStyle(.plain)
                        .disabled(isRunning)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func relativeTime(_ date: Date) -> String {
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(seconds / 60)m ago" }
        if seconds < 86400 { return "\(seconds / 3600)h ago" }
        return "\(seconds / 86400)d ago"
    }
}

// MARK: - Job Detail Sheet

struct JobDetailSheet: View {
    let job: CronJobItem
    let onToggle: () -> Void
    let onRun: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Job Info") {
                    LabeledRow(label: "Name", value: job.displayName)
                    LabeledRow(label: "ID", value: job.id, mono: true)
                    LabeledRow(label: "Bot", value: "\(job.botEmoji) \(job.botName)")
                    LabeledRow(label: "Status", value: job.enabled ? "Enabled" : "Disabled")
                }

                Section("Schedule") {
                    LabeledRow(label: "Type", value: job.scheduleKind.capitalized)
                    LabeledRow(label: "Schedule", value: job.scheduleText)
                    if let next = job.nextRunAt {
                        LabeledRow(label: "Next Run", value: formatDate(next))
                    }
                    if let last = job.lastRunAt {
                        LabeledRow(label: "Last Run", value: formatDate(last))
                    }
                }

                Section("Execution") {
                    LabeledRow(label: "Payload", value: job.payloadKind)
                    LabeledRow(label: "Session", value: job.sessionTarget)
                    if let model = job.model {
                        LabeledRow(label: "Model", value: model)
                    }
                }

                Section {
                    Button(action: {
                        onToggle()
                        dismiss()
                    }) {
                        Label(
                            job.enabled ? "Disable Job" : "Enable Job",
                            systemImage: job.enabled ? "pause.circle" : "play.circle"
                        )
                        .foregroundColor(job.enabled ? .optaAmber : .optaGreen)
                    }

                    if job.enabled {
                        Button(action: {
                            onRun()
                            dismiss()
                        }) {
                            Label("Run Now", systemImage: "bolt.fill")
                                .foregroundColor(.optaPrimary)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle(job.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }
}

// MARK: - Labeled Row Helper

struct LabeledRow: View {
    let label: String
    let value: String
    var mono: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundColor(.optaTextSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 14, design: mono ? .monospaced : .default))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)
        }
        .listRowBackground(Color.optaSurface)
    }
}
