//
//  JobHistorySheet.swift
//  OptaPlusIOS
//
//  Shows execution history for a specific cron job via cron.status RPC.
//  Displays list of runs sorted newest first with date, duration, status, error.
//

import SwiftUI
import OptaPlus
import OptaMolt

struct JobHistorySheet: View {
    let job: CronJobItem
    let viewModel: ChatViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var runs: [JobRun] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var listVisible = false

    struct JobRun: Identifiable {
        let id: String
        let startedAt: Date
        let durationMs: Int?
        let succeeded: Bool
        let errorMessage: String?
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && runs.isEmpty {
                    VStack(spacing: 12) {
                        OptaLoader(size: 24)
                        Text("Loading history...")
                            .font(.sora(13, weight: .regular))
                            .foregroundColor(.optaTextMuted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if runs.isEmpty {
                    emptyState
                } else {
                    runList
                }
            }
            .background(Color.optaVoid)
            .navigationTitle("Run History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadHistory()
            }
        }
    }

    private var runList: some View {
        List {
            Section {
                ForEach(Array(runs.enumerated()), id: \.element.id) { index, run in
                    RunRow(run: run)
                        .staggeredIgnition(index: index, isVisible: listVisible)
                }
                .listRowBackground(Color.optaSurface)
            } header: {
                Text("\(runs.count) execution\(runs.count == 1 ? "" : "s")")
                    .foregroundColor(.optaTextSecondary)
            }
        }
        .scrollContentBackground(.hidden)
        .onAppear { listVisible = true }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.badge.questionmark")
                .font(.sora(48, weight: .regular))
                .foregroundColor(.optaTextMuted)
            Text("No execution history")
                .font(.soraHeadline)
                .foregroundColor(.optaTextSecondary)
            Text("This job hasn't run yet, or the gateway doesn't store run history.")
                .font(.soraSubhead)
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .optaEntrance()
    }

    private func loadHistory() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let result = try await viewModel.call("cron.status", params: ["jobId": job.id])
            guard let dict = result?.dict else { return }

            // Try multiple possible response shapes
            let rawRuns: [[String: Any]]
            if let history = dict["history"] as? [[String: Any]] {
                rawRuns = history
            } else if let executions = dict["executions"] as? [[String: Any]] {
                rawRuns = executions
            } else if let runs = dict["runs"] as? [[String: Any]] {
                rawRuns = runs
            } else {
                rawRuns = []
            }

            var parsed: [JobRun] = []
            for (index, run) in rawRuns.enumerated() {
                let id = run["id"] as? String ?? run["runId"] as? String ?? "\(index)"

                let startedAt: Date
                if let ts = run["startedAt"] as? Double {
                    startedAt = Date(timeIntervalSince1970: ts / 1000)
                } else if let ts = run["timestamp"] as? Double {
                    startedAt = Date(timeIntervalSince1970: ts / 1000)
                } else if let ts = run["date"] as? Double {
                    startedAt = Date(timeIntervalSince1970: ts / 1000)
                } else {
                    startedAt = Date()
                }

                let durationMs = run["durationMs"] as? Int ?? run["duration"] as? Int
                let succeeded = run["success"] as? Bool ?? run["ok"] as? Bool ?? (run["error"] == nil)
                let error = run["error"] as? String ?? run["errorMessage"] as? String

                parsed.append(JobRun(
                    id: id,
                    startedAt: startedAt,
                    durationMs: durationMs,
                    succeeded: succeeded,
                    errorMessage: error
                ))
            }

            runs = parsed.sorted { $0.startedAt > $1.startedAt }
            listVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { listVisible = true }
        } catch {
            errorMessage = "Failed to load history: \(error.localizedDescription)"
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
                    .font(.sora(11, weight: .regular))
                    .foregroundColor(.optaRed)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }
}
