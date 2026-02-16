//
//  BotAutomationsPage.swift
//  OptaPlusIOS
//
//  Per-bot automations page shown inside the BotPagerView.
//  Fetches and displays cron jobs for a single bot.
//  Supports create, edit, duplicate, history, toggle, run, delete.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct BotAutomationsPage: View {
    let bot: BotConfig
    @ObservedObject var viewModel: ChatViewModel
    @State private var jobs: [CronJobItem] = []
    @State private var isLoading = false
    @State private var selectedJob: CronJobItem?
    @State private var runningJobIds: Set<String> = []
    @State private var errorMessage: String?
    @State private var listVisible = false
    @State private var showCreateSheet = false
    @State private var editingJob: CronJobItem?
    @State private var duplicatingJob: CronJobItem?
    @State private var historyJob: CronJobItem?

    var body: some View {
        Group {
            if isLoading && jobs.isEmpty {
                VStack(spacing: 12) {
                    OptaLoader(size: 24)
                    Text("Loading automations...")
                        .font(.sora(13, weight: .regular))
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
        .refreshable {
            await loadJobs()
        }
        .onChange(of: viewModel.connectionState) { old, new in
            if old != .connected && new == .connected {
                Task { await loadJobs() }
            }
        }
        .sheet(item: $selectedJob) { job in
            JobDetailSheet(
                job: job,
                onToggle: { toggleJob(job) },
                onRun: { runJob(job) },
                onEdit: { editingJob = job },
                onDuplicate: { duplicatingJob = job },
                onHistory: { historyJob = job }
            )
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateJobSheet(
                viewModel: viewModel,
                botConfig: bot,
                existingJob: nil,
                onSaved: { Task { await loadJobs() } }
            )
        }
        .sheet(item: $editingJob) { job in
            CreateJobSheet(
                viewModel: viewModel,
                botConfig: bot,
                existingJob: job,
                onSaved: { Task { await loadJobs() } }
            )
        }
        .sheet(item: $duplicatingJob) { job in
            // Duplicate: open create sheet with the same data but nil id
            CreateJobSheet(
                viewModel: viewModel,
                botConfig: bot,
                existingJob: CronJobItem(
                    id: UUID().uuidString,
                    name: "\(job.name) (copy)",
                    enabled: job.enabled,
                    scheduleText: job.scheduleText,
                    scheduleKind: job.scheduleKind,
                    sessionTarget: job.sessionTarget,
                    payloadKind: job.payloadKind,
                    model: job.model,
                    lastRunAt: nil,
                    nextRunAt: nil,
                    botName: job.botName,
                    botEmoji: job.botEmoji,
                    botId: job.botId,
                    rawSchedule: job.rawSchedule,
                    rawPayload: job.rawPayload
                ),
                onSaved: { Task { await loadJobs() } }
            )
        }
        .sheet(item: $historyJob) { job in
            JobHistorySheet(job: job, viewModel: viewModel)
        }
    }

    // MARK: - Job List

    private var jobList: some View {
        List {
            ForEach(Array(jobs.enumerated()), id: \.element.id) { index, job in
                Button { selectedJob = job } label: {
                    JobRow(
                        job: job,
                        isRunning: runningJobIds.contains(job.id),
                        onTap: { selectedJob = job },
                        onToggle: { toggleJob(job) },
                        onRun: { runJob(job) }
                    )
                }
                .staggeredIgnition(index: index, isVisible: listVisible)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        deleteJob(job)
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }

                    Button {
                        duplicatingJob = job
                    } label: {
                        Label("Duplicate", systemImage: "doc.on.doc")
                    }
                    .tint(.optaPrimary)
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        toggleJob(job)
                    } label: {
                        Label(
                            job.enabled ? "Pause" : "Resume",
                            systemImage: job.enabled ? "pause.circle" : "play.circle"
                        )
                    }
                    .tint(job.enabled ? .optaAmber : .optaGreen)
                }
            }
            .listRowBackground(Color.optaSurface)

            if let error = errorMessage {
                Section {
                    Text(error)
                        .font(.soraCaption)
                        .foregroundColor(.optaRed)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .onAppear { listVisible = true }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bolt.circle")
                .font(.sora(48, weight: .regular))
                .foregroundColor(.optaTextMuted)
            Text("No automations")
                .font(.soraHeadline)
                .foregroundColor(.optaTextSecondary)
            Text("\(bot.name) has no cron jobs configured")
                .font(.soraSubhead)
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)

            HStack(spacing: 12) {
                if viewModel.connectionState == .disconnected {
                    Button {
                        viewModel.connect()
                    } label: {
                        Label("Connect", systemImage: "bolt.fill")
                            .font(.sora(15, weight: .medium))
                            .foregroundColor(.optaPrimary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Capsule().stroke(Color.optaPrimary, lineWidth: 1.5))
                    }
                } else {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Label("Create Job", systemImage: "plus.circle.fill")
                            .font(.sora(15, weight: .medium))
                            .foregroundColor(.optaPrimary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Capsule().stroke(Color.optaPrimary, lineWidth: 1.5))
                    }
                }

                Button {
                    Task { await loadJobs() }
                } label: {
                    Label("Scan", systemImage: "arrow.clockwise")
                        .font(.sora(15, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Color.optaBorder, lineWidth: 1))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .optaEntrance()
    }

    // MARK: - Data Loading

    private func loadJobs() async {
        isLoading = true
        defer { isLoading = false }

        guard viewModel.isGatewayReady else {
            jobs = []
            return
        }

        do {
            let response = try await viewModel.call("cron.list", params: ["includeDisabled": true])
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
                    botName: bot.name, botEmoji: bot.emoji, botId: bot.id,
                    rawSchedule: rawSchedule, rawPayload: rawPayload
                ))
            }

            jobs = loaded.sorted { ($0.enabled ? 0 : 1, $0.name) < ($1.enabled ? 0 : 1, $1.name) }
            listVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { listVisible = true }
        } catch {
            NSLog("[BotAutomations] Failed to load for \(bot.name): \(error)")
            errorMessage = "Failed to load: \(error.localizedDescription)"
        }
    }

    // MARK: - Actions

    private func toggleJob(_ job: CronJobItem) {
        Task {
            do {
                _ = try await viewModel.call("cron.update", params: [
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
        runningJobIds.insert(job.id)
        Task {
            do {
                _ = try await viewModel.call("cron.run", params: ["jobId": job.id])
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                errorMessage = "Run failed: \(error.localizedDescription)"
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            runningJobIds.remove(job.id)
        }
    }

    private func deleteJob(_ job: CronJobItem) {
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        Task {
            do {
                _ = try await viewModel.call("cron.remove", params: ["jobId": job.id])
                withAnimation(.optaSpring) {
                    jobs.removeAll { $0.id == job.id }
                }
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
            return "Weekly \u{2014} \(expr)"
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

// String leftPad is already defined in AutomationsView.swift
