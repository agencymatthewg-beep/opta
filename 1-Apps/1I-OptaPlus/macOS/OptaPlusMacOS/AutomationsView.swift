//
//  AutomationsView.swift
//  OptaPlusMacOS
//
//  Cron job management — view, toggle, run, create, edit, duplicate, history.
//  Ported from iOS AutomationsView + BotAutomationsPage + CreateJobSheet + JobHistorySheet.
//  macOS adaptations: context menus, hover effects, SoundManager feedback.
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
    let rawSchedule: [String: Any]?
    let rawPayload: [String: Any]?

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
    let bot: BotConfig?
    let viewModel: ChatViewModel?
    @EnvironmentObject var appState: AppState

    @State private var jobs: [CronJobItem] = []
    @State private var schedulerStatus: SchedulerStatus?
    @State private var isLoading = false
    @State private var selectedJob: CronJobItem?
    @State private var runningJobIds: Set<String> = []
    @State private var errorMessage: String?
    @State private var showCreateSheet = false
    @State private var editingJob: CronJobItem?
    @State private var duplicatingJob: CronJobItem?
    @State private var historyJob: CronJobItem?
    @State private var listVisible = false

    private var activeJobs: [CronJobItem] {
        jobs.filter { $0.enabled }
    }

    private var disabledJobs: [CronJobItem] {
        jobs.filter { !$0.enabled }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Label("Automations", systemImage: "bolt.circle")
                    .font(.sora(16, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                if let bot = bot {
                    Text(bot.emoji)
                        .font(.sora(14))
                    Text(bot.name)
                        .font(.sora(13))
                        .foregroundColor(.optaTextSecondary)
                }

                Spacer()

                if let status = schedulerStatus {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(status.running ? Color.optaGreen : Color.optaRed)
                            .frame(width: 6, height: 6)
                        Text("\(status.activeCount)/\(status.jobCount) active")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                Button(action: { showCreateSheet = true }) {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 14))
                        .foregroundColor(.optaPrimary)
                }
                .buttonStyle(.plain)
                .help("Create Job")
                .disabled(viewModel == nil || viewModel?.isGatewayReady != true)

                Button(action: { Task { await loadJobs() } }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
                .help("Refresh")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.optaElevated)

            Divider().background(Color.optaBorder.opacity(0.3))

            // Content
            if isLoading && jobs.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading automations...")
                        .font(.sora(13))
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if jobs.isEmpty {
                emptyState
            } else {
                jobList
            }
        }
        .background(Color.optaVoid)
        .task {
            await loadJobs()
        }
        .sheet(item: $selectedJob) { job in
            JobDetailSheet(job: job, onToggle: { toggleJob(job) }, onRun: { runJob(job) },
                           onEdit: { editingJob = job }, onDuplicate: { duplicatingJob = job },
                           onHistory: { historyJob = job })
        }
        .sheet(isPresented: $showCreateSheet) {
            if let vm = viewModel, let bot = bot {
                CreateJobSheet(viewModel: vm, botConfig: bot, existingJob: nil,
                               onSaved: { Task { await loadJobs() } })
            }
        }
        .sheet(item: $editingJob) { job in
            if let vm = viewModel, let bot = bot {
                CreateJobSheet(viewModel: vm, botConfig: bot, existingJob: job,
                               onSaved: { Task { await loadJobs() } })
            }
        }
        .sheet(item: $duplicatingJob) { job in
            if let vm = viewModel, let bot = bot {
                CreateJobSheet(viewModel: vm, botConfig: bot,
                               existingJob: CronJobItem(
                                   id: UUID().uuidString, name: "\(job.name) (copy)",
                                   enabled: job.enabled, scheduleText: job.scheduleText,
                                   scheduleKind: job.scheduleKind, sessionTarget: job.sessionTarget,
                                   payloadKind: job.payloadKind, model: job.model,
                                   lastRunAt: nil, nextRunAt: nil,
                                   botName: job.botName, botEmoji: job.botEmoji, botId: job.botId,
                                   rawSchedule: job.rawSchedule, rawPayload: job.rawPayload),
                               onSaved: { Task { await loadJobs() } })
            }
        }
        .sheet(item: $historyJob) { job in
            if let vm = viewModel {
                JobHistorySheet(job: job, viewModel: vm)
            }
        }
    }

    // MARK: - Job List

    private var jobList: some View {
        ScrollView {
            VStack(spacing: 12) {
                if !activeJobs.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("ACTIVE")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                            .padding(.horizontal, 16)

                        ForEach(Array(activeJobs.enumerated()), id: \.element.id) { index, job in
                            JobRow(
                                job: job,
                                isRunning: runningJobIds.contains(job.id),
                                onTap: { selectedJob = job },
                                onToggle: { toggleJob(job) },
                                onRun: { runJob(job) },
                                onEdit: { editingJob = job },
                                onDuplicate: { duplicatingJob = job },
                                onHistory: { historyJob = job },
                                onDelete: { deleteJob(job) }
                            )
                            .staggeredIgnition(index: index, isVisible: listVisible)
                        }
                    }
                }

                if !disabledJobs.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("DISABLED")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundColor(.optaTextMuted)
                            .padding(.horizontal, 16)

                        ForEach(Array(disabledJobs.enumerated()), id: \.element.id) { index, job in
                            JobRow(
                                job: job,
                                isRunning: runningJobIds.contains(job.id),
                                onTap: { selectedJob = job },
                                onToggle: { toggleJob(job) },
                                onRun: { runJob(job) },
                                onEdit: { editingJob = job },
                                onDuplicate: { duplicatingJob = job },
                                onHistory: { historyJob = job },
                                onDelete: { deleteJob(job) }
                            )
                            .staggeredIgnition(index: index + activeJobs.count, isVisible: listVisible)
                        }
                    }
                }

                if let error = errorMessage {
                    Text(error)
                        .font(.soraCaption)
                        .foregroundColor(.optaRed)
                        .padding()
                }
            }
            .padding(.vertical, 12)
        }
        .onAppear { listVisible = true }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bolt.circle")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)
            Text("No automations")
                .font(.soraHeadline)
                .foregroundColor(.optaTextSecondary)

            if let vm = viewModel, vm.connectionState == .disconnected {
                Button {
                    vm.connect()
                } label: {
                    Label("Connect", systemImage: "bolt.fill")
                        .font(.soraSubhead)
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Color.optaPrimary, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
            } else if viewModel != nil {
                Text("No cron jobs configured")
                    .font(.soraSubhead)
                    .foregroundColor(.optaTextMuted)

                Button {
                    showCreateSheet = true
                } label: {
                    Label("Create Job", systemImage: "plus.circle.fill")
                        .font(.soraSubhead)
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Color.optaPrimary, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
            } else {
                Text("Select a bot to manage automations")
                    .font(.soraSubhead)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .optaEntrance()
    }

    // MARK: - Data Loading

    private func loadJobs() async {
        guard let vm = viewModel, vm.isGatewayReady else {
            jobs = []
            return
        }
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await vm.call("cron.list", params: ["includeDisabled": true])
            guard let jobsArray = response?.dict?["jobs"] as? [[String: Any]] else {
                jobs = []
                return
            }

            var loaded: [CronJobItem] = []
            for job in jobsArray {
                guard let jobId = job["id"] as? String ?? job["jobId"] as? String else { continue }

                let name = job["name"] as? String ?? ""
                let enabled = job["enabled"] as? Bool ?? true
                let sessionTarget = job["sessionTarget"] as? String ?? "main"

                let scheduleText: String
                let scheduleKind: String
                if let schedule = job["schedule"] as? [String: Any] {
                    scheduleKind = schedule["kind"] as? String ?? "unknown"
                    scheduleText = parseSchedule(schedule)
                } else {
                    scheduleKind = "unknown"
                    scheduleText = "Unknown schedule"
                }

                let payloadKind: String
                let model: String?
                let rawPayload = job["payload"] as? [String: Any]
                if let payload = rawPayload {
                    payloadKind = payload["kind"] as? String ?? "unknown"
                    model = payload["model"] as? String
                } else {
                    payloadKind = "unknown"
                    model = nil
                }

                let rawSchedule = job["schedule"] as? [String: Any]
                let lastRunAt = parseDate(job["lastRunAt"])
                let nextRunAt = parseDate(job["nextRunAt"])

                loaded.append(CronJobItem(
                    id: jobId, name: name, enabled: enabled,
                    scheduleText: scheduleText, scheduleKind: scheduleKind,
                    sessionTarget: sessionTarget, payloadKind: payloadKind,
                    model: model, lastRunAt: lastRunAt, nextRunAt: nextRunAt,
                    botName: bot?.name ?? "", botEmoji: bot?.emoji ?? "",
                    botId: bot?.id ?? "",
                    rawSchedule: rawSchedule, rawPayload: rawPayload
                ))
            }

            // Load scheduler status
            let statusResult = try? await vm.call("cron.status")
            if let statusDict = statusResult?.dict {
                let running = statusDict["running"] as? Bool ?? false
                let total = statusDict["totalJobs"] as? Int ?? loaded.count
                let active = statusDict["activeJobs"] as? Int ?? loaded.filter { $0.enabled }.count
                schedulerStatus = SchedulerStatus(running: running, jobCount: total, activeCount: active)
            }

            jobs = loaded.sorted { ($0.enabled ? 0 : 1, $0.name) < ($1.enabled ? 0 : 1, $1.name) }
            listVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { listVisible = true }
        } catch {
            NSLog("[Automations] Failed to load: \(error)")
            errorMessage = "Failed to load: \(error.localizedDescription)"
        }
    }

    // MARK: - Actions

    private func toggleJob(_ job: CronJobItem) {
        guard let vm = viewModel else { return }
        Task {
            do {
                _ = try await vm.call("cron.update", params: [
                    "jobId": job.id,
                    "patch": ["enabled": !job.enabled] as [String: Any]
                ])
                if let idx = jobs.firstIndex(where: { $0.id == job.id }) {
                    jobs[idx].enabled.toggle()
                }
                SoundManager.shared.play(.sendMessage)
            } catch {
                errorMessage = "Toggle failed: \(error.localizedDescription)"
            }
        }
    }

    private func runJob(_ job: CronJobItem) {
        guard let vm = viewModel else { return }
        runningJobIds.insert(job.id)
        Task {
            do {
                _ = try await vm.call("cron.run", params: ["jobId": job.id])
                SoundManager.shared.play(.sendMessage)
            } catch {
                errorMessage = "Run failed: \(error.localizedDescription)"
                SoundManager.shared.play(.error)
            }
            runningJobIds.remove(job.id)
        }
    }

    private func deleteJob(_ job: CronJobItem) {
        guard let vm = viewModel else { return }
        Task {
            do {
                _ = try await vm.call("cron.remove", params: ["jobId": job.id])
                withAnimation(.optaSpring) {
                    jobs.removeAll { $0.id == job.id }
                }
                SoundManager.shared.play(.sendMessage)
            } catch {
                errorMessage = "Delete failed: \(error.localizedDescription)"
            }
        }
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

extension String {
    func leftPad(_ length: Int, pad: Character = "0") -> String {
        String(repeating: pad, count: max(0, length - count)) + self
    }
}

// MARK: - Job Row (macOS)

private struct JobRow: View {
    let job: CronJobItem
    let isRunning: Bool
    let onTap: () -> Void
    let onToggle: () -> Void
    let onRun: () -> Void
    let onEdit: () -> Void
    let onDuplicate: () -> Void
    let onHistory: () -> Void
    let onDelete: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(job.botEmoji)
                        .font(.sora(14))
                    Text(job.displayName)
                        .font(.sora(14, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { job.enabled },
                        set: { _ in onToggle() }
                    ))
                    .labelsHidden()
                    .tint(.optaPrimary)
                    .scaleEffect(0.8)
                }

                HStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                        .foregroundColor(.optaTextMuted)
                    Text(job.scheduleText)
                        .font(.sora(12))
                        .foregroundColor(.optaTextSecondary)

                    if let model = job.model {
                        Text("· \(model)")
                            .font(.sora(11))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                HStack {
                    if let lastRun = job.lastRunAt {
                        Text("Last: \(OptaFormatting.relativeTime(lastRun))")
                            .font(.sora(11))
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
                                    .font(.sora(11, weight: .medium))
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
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isHovered ? Color.optaSurface.opacity(0.5) : Color.optaElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.optaBorder.opacity(isHovered ? 0.5 : 0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.optaSnap) {
                isHovered = hovering
            }
        }
        .contextMenu {
            Button { onEdit() } label: {
                Label("Edit", systemImage: "pencil")
            }
            Button { onDuplicate() } label: {
                Label("Duplicate", systemImage: "doc.on.doc")
            }
            Button { onHistory() } label: {
                Label("Run History", systemImage: "clock.arrow.circlepath")
            }
            Divider()
            Button { onToggle() } label: {
                Label(job.enabled ? "Pause" : "Resume",
                      systemImage: job.enabled ? "pause.circle" : "play.circle")
            }
            if job.enabled {
                Button { onRun() } label: {
                    Label("Run Now", systemImage: "bolt.fill")
                }
            }
            Divider()
            Button(role: .destructive) { onDelete() } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .padding(.horizontal, 16)
    }

}

// MARK: - Job Detail Sheet (macOS)

struct JobDetailSheet: View {
    let job: CronJobItem
    let onToggle: () -> Void
    let onRun: () -> Void
    var onEdit: (() -> Void)? = nil
    var onDuplicate: (() -> Void)? = nil
    var onHistory: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(job.botEmoji)
                    .font(.soraTitle2)
                Text(job.displayName)
                    .font(.sora(16, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider().background(Color.optaBorder.opacity(0.3))

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Job Info
                    detailSection("Job Info") {
                        LabeledRow(label: "Name", value: job.displayName)
                        LabeledRow(label: "ID", value: job.id, mono: true)
                        LabeledRow(label: "Bot", value: "\(job.botEmoji) \(job.botName)")
                        LabeledRow(label: "Status", value: job.enabled ? "Enabled" : "Disabled")
                    }

                    detailSection("Schedule") {
                        LabeledRow(label: "Type", value: job.scheduleKind.capitalized)
                        LabeledRow(label: "Schedule", value: job.scheduleText)
                        if let next = job.nextRunAt {
                            LabeledRow(label: "Next Run", value: OptaFormatting.formatDate(next))
                        }
                        if let last = job.lastRunAt {
                            LabeledRow(label: "Last Run", value: OptaFormatting.formatDate(last))
                        }
                    }

                    detailSection("Execution") {
                        LabeledRow(label: "Payload", value: job.payloadKind)
                        LabeledRow(label: "Session", value: job.sessionTarget)
                        if let model = job.model {
                            LabeledRow(label: "Model", value: model)
                        }
                    }

                    // Actions
                    VStack(spacing: 8) {
                        Button(action: { onToggle(); dismiss() }) {
                            Label(job.enabled ? "Disable Job" : "Enable Job",
                                  systemImage: job.enabled ? "pause.circle" : "play.circle")
                                .foregroundColor(job.enabled ? .optaAmber : .optaGreen)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)

                        if job.enabled {
                            Button(action: { onRun(); dismiss() }) {
                                Label("Run Now", systemImage: "bolt.fill")
                                    .foregroundColor(.optaPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }

                        if let onEdit = onEdit {
                            Button(action: { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onEdit() } }) {
                                Label("Edit Job", systemImage: "pencil")
                                    .foregroundColor(.optaTextPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }

                        if let onDuplicate = onDuplicate {
                            Button(action: { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onDuplicate() } }) {
                                Label("Duplicate", systemImage: "doc.on.doc")
                                    .foregroundColor(.optaTextPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }

                        if let onHistory = onHistory {
                            Button(action: { dismiss(); DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { onHistory() } }) {
                                Label("Run History", systemImage: "clock.arrow.circlepath")
                                    .foregroundColor(.optaTextPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.optaElevated))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.optaBorder.opacity(0.2), lineWidth: 1))
                }
                .padding()
            }
        }
        .frame(width: 420)
        .frame(minHeight: 400)
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func detailSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextMuted)
            VStack(spacing: 4) {
                content()
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.optaElevated))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.optaBorder.opacity(0.2), lineWidth: 1))
        }
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
                .font(.sora(12))
                .foregroundColor(.optaTextMuted)
            Spacer()
            Text(value)
                .font(mono ? .system(size: 12, design: .monospaced) : .sora(12))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)
        }
    }
}

// MARK: - Create Job Sheet (macOS)

struct CreateJobSheet: View {
    let viewModel: ChatViewModel
    let botConfig: BotConfig
    let existingJob: CronJobItem?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var command = ""
    @State private var scheduleKind: ScheduleKind = .cron
    @State private var cronExpression = "0 9 * * *"
    @State private var intervalValue: Int = 30
    @State private var intervalUnit: IntervalUnit = .minutes
    @State private var oneTimeDate = Date().addingTimeInterval(3600)
    @State private var sessionTarget = "main"
    @State private var model = ""
    @State private var availableSessions: [String] = ["main"]
    @State private var isSaving = false
    @State private var errorMessage: String?

    enum ScheduleKind: String, CaseIterable {
        case cron, every, at
        var label: String {
            switch self {
            case .cron: return "Cron"
            case .every: return "Interval"
            case .at: return "One-Time"
            }
        }
    }

    enum IntervalUnit: String, CaseIterable {
        case seconds, minutes, hours
        var label: String { rawValue.capitalized }
        var multiplier: Int {
            switch self {
            case .seconds: return 1000
            case .minutes: return 60_000
            case .hours: return 3_600_000
            }
        }
    }

    private var isEditing: Bool { existingJob != nil }
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        !command.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(isEditing ? "Edit Job" : "Create Job")
                    .font(.sora(16, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Button(isEditing ? "Save" : "Create") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(!canSave || isSaving)
            }
            .padding()

            Divider().background(Color.optaBorder.opacity(0.3))

            Form {
                Section("Job Details") {
                    TextField("Job Name", text: $name)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Command")
                            .font(.sora(12))
                            .foregroundColor(.optaTextSecondary)
                        TextEditor(text: $command)
                            .font(.system(size: 13, design: .monospaced))
                            .frame(minHeight: 80)
                            .scrollContentBackground(.hidden)
                            .background(Color.optaSurface)
                            .cornerRadius(8)
                    }
                }

                Section("Schedule") {
                    Picker("Schedule Type", selection: $scheduleKind) {
                        ForEach(ScheduleKind.allCases, id: \.self) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch scheduleKind {
                    case .cron:
                        TextField("Cron Expression", text: $cronExpression)
                            .font(.system(.body, design: .monospaced))
                        Text(cronPreview)
                            .font(.sora(12))
                            .foregroundColor(.optaTextMuted)
                    case .every:
                        Stepper("Every \(intervalValue) \(intervalUnit.label.lowercased())",
                                value: $intervalValue, in: 1...9999)
                        Picker("Unit", selection: $intervalUnit) {
                            ForEach(IntervalUnit.allCases, id: \.self) { unit in
                                Text(unit.label).tag(unit)
                            }
                        }
                        .pickerStyle(.segmented)
                    case .at:
                        DatePicker("Run At", selection: $oneTimeDate, in: Date()...,
                                   displayedComponents: [.date, .hourAndMinute])
                    }
                }

                Section("Session Target") {
                    Picker("Session", selection: $sessionTarget) {
                        ForEach(availableSessions, id: \.self) { session in
                            Text(session).tag(session)
                        }
                    }
                }

                Section {
                    TextField("Model (optional)", text: $model)
                } header: {
                    Text("Model Override")
                } footer: {
                    Text("Leave empty to use the bot's default model.")
                        .font(.soraCaption)
                        .foregroundColor(.optaTextMuted)
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .font(.soraCaption)
                            .foregroundColor(.optaRed)
                    }
                }
            }
            .formStyle(.grouped)
        }
        .frame(width: 460)
        .frame(minHeight: 500)
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
        .task {
            await loadSessions()
            if let job = existingJob {
                populateFromJob(job)
            }
        }
    }

    private var cronPreview: String {
        let parts = cronExpression.split(separator: " ")
        guard parts.count >= 5 else { return "Invalid cron expression" }
        let min = String(parts[0])
        let hour = String(parts[1])
        if min != "*" && hour != "*" {
            return "Runs daily at \(hour.leftPad(2)):\(min.leftPad(2))"
        }
        if min == "*" && hour == "*" { return "Runs every minute" }
        if min == "0" && hour == "*" { return "Runs every hour" }
        return "Custom schedule: \(cronExpression)"
    }

    private func save() {
        isSaving = true
        errorMessage = nil

        let tz = TimeZone.current.identifier
        let schedule: [String: Any]
        switch scheduleKind {
        case .cron:
            schedule = ["kind": "cron", "expression": cronExpression, "tz": tz]
        case .every:
            schedule = ["kind": "every", "intervalMs": intervalValue * intervalUnit.multiplier, "tz": tz]
        case .at:
            schedule = ["kind": "at", "date": oneTimeDate.timeIntervalSince1970 * 1000, "tz": tz]
        }

        var payload: [String: Any] = ["kind": "agentTurn", "message": command]
        if !model.trimmingCharacters(in: .whitespaces).isEmpty {
            payload["model"] = model
        }

        Task {
            do {
                if let job = existingJob {
                    _ = try await viewModel.call("cron.update", params: [
                        "jobId": job.id,
                        "patch": [
                            "name": name, "schedule": schedule,
                            "payload": payload, "sessionTarget": sessionTarget
                        ] as [String: Any]
                    ])
                } else {
                    _ = try await viewModel.call("cron.add", params: [
                        "name": name, "schedule": schedule,
                        "payload": payload, "sessionTarget": sessionTarget,
                        "enabled": true
                    ] as [String: Any])
                }
                SoundManager.shared.play(.sendMessage)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                SoundManager.shared.play(.error)
                isSaving = false
            }
        }
    }

    private func loadSessions() async {
        guard viewModel.isGatewayReady else { return }
        do {
            let result = try await viewModel.call("sessions.list")
            if let list = result?.dict?["sessions"] as? [[String: Any]] {
                let keys = list.compactMap { $0["sessionKey"] as? String ?? $0["key"] as? String }
                if !keys.isEmpty { availableSessions = keys }
            }
        } catch { }
    }

    private func populateFromJob(_ job: CronJobItem) {
        name = job.name
        sessionTarget = job.sessionTarget
        model = job.model ?? ""
        if let payload = job.rawPayload {
            command = payload["message"] as? String ?? payload["prompt"] as? String ?? ""
        }
        if let schedule = job.rawSchedule {
            let kind = schedule["kind"] as? String ?? ""
            switch kind {
            case "cron":
                scheduleKind = .cron
                cronExpression = schedule["expression"] as? String ?? schedule["expr"] as? String ?? "0 9 * * *"
            case "every":
                scheduleKind = .every
                let ms = schedule["intervalMs"] as? Int ?? schedule["interval"] as? Int ?? 60_000
                if ms >= 3_600_000 { intervalValue = ms / 3_600_000; intervalUnit = .hours }
                else if ms >= 60_000 { intervalValue = ms / 60_000; intervalUnit = .minutes }
                else { intervalValue = ms / 1000; intervalUnit = .seconds }
            case "at":
                scheduleKind = .at
                if let ts = schedule["date"] as? Double { oneTimeDate = Date(timeIntervalSince1970: ts / 1000) }
            default: break
            }
        }
    }
}

// MARK: - Job History Sheet (macOS)

struct JobHistorySheet: View {
    let job: CronJobItem
    let viewModel: ChatViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var runs: [JobRun] = []
    @State private var isLoading = false
    @State private var listVisible = false

    struct JobRun: Identifiable {
        let id: String
        let startedAt: Date
        let durationMs: Int?
        let succeeded: Bool
        let errorMessage: String?
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Run History", systemImage: "clock.arrow.circlepath")
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Text("— \(job.displayName)")
                    .font(.sora(13))
                    .foregroundColor(.optaTextSecondary)
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider().background(Color.optaBorder.opacity(0.3))

            if isLoading && runs.isEmpty {
                VStack(spacing: 12) {
                    ProgressView().scaleEffect(0.8)
                    Text("Loading history...")
                        .font(.sora(13))
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if runs.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "clock.badge.questionmark")
                        .font(.system(size: 48))
                        .foregroundColor(.optaTextMuted)
                    Text("No execution history")
                        .font(.soraHeadline)
                        .foregroundColor(.optaTextSecondary)
                    Text("This job hasn't run yet.")
                        .font(.soraSubhead)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        Text("\(runs.count) execution\(runs.count == 1 ? "" : "s")")
                            .font(.sora(11))
                            .foregroundColor(.optaTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.top, 8)

                        ForEach(Array(runs.enumerated()), id: \.element.id) { index, run in
                            RunRow(run: run)
                                .staggeredIgnition(index: index, isVisible: listVisible)
                        }
                    }
                    .padding(.bottom, 12)
                }
                .onAppear { listVisible = true }
            }
        }
        .frame(width: 420)
        .frame(minHeight: 350)
        .background(Color.optaVoid)
        .preferredColorScheme(.dark)
        .task {
            await loadHistory()
        }
    }

    private func loadHistory() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let result = try await viewModel.call("cron.status", params: ["jobId": job.id])
            guard let dict = result?.dict else { return }

            let rawRuns: [[String: Any]]
            if let history = dict["history"] as? [[String: Any]] { rawRuns = history }
            else if let executions = dict["executions"] as? [[String: Any]] { rawRuns = executions }
            else if let r = dict["runs"] as? [[String: Any]] { rawRuns = r }
            else { rawRuns = [] }

            var parsed: [JobRun] = []
            for (index, run) in rawRuns.enumerated() {
                let id = run["id"] as? String ?? run["runId"] as? String ?? "\(index)"
                let startedAt: Date
                if let ts = run["startedAt"] as? Double { startedAt = Date(timeIntervalSince1970: ts / 1000) }
                else if let ts = run["timestamp"] as? Double { startedAt = Date(timeIntervalSince1970: ts / 1000) }
                else if let ts = run["date"] as? Double { startedAt = Date(timeIntervalSince1970: ts / 1000) }
                else { startedAt = Date() }

                let durationMs = run["durationMs"] as? Int ?? run["duration"] as? Int
                let succeeded = run["success"] as? Bool ?? run["ok"] as? Bool ?? (run["error"] == nil)
                let error = run["error"] as? String ?? run["errorMessage"] as? String

                parsed.append(JobRun(id: id, startedAt: startedAt, durationMs: durationMs,
                                     succeeded: succeeded, errorMessage: error))
            }

            runs = parsed.sorted { $0.startedAt > $1.startedAt }
            listVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { listVisible = true }
        } catch {
            // Silently handle — empty state will show
        }
    }
}

// MARK: - Run Row

private struct RunRow: View {
    let run: JobHistorySheet.JobRun

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Circle()
                    .fill(run.succeeded ? Color.optaGreen : Color.optaRed)
                    .frame(width: 8, height: 8)
                Text(OptaFormatting.formatDate(run.startedAt))
                    .font(.sora(13, weight: .medium))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                if let ms = run.durationMs {
                    Text(OptaFormatting.formatDuration(ms))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                }
            }

            if let error = run.errorMessage {
                Text(error)
                    .font(.sora(11))
                    .foregroundColor(.optaRed)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
    }

}
