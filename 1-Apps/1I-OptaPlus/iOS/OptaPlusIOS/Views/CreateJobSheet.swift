//
//  CreateJobSheet.swift
//  OptaPlusIOS
//
//  Full-screen sheet for creating or editing a cron job.
//  Supports cron expression, interval, and one-time schedule kinds.
//

import SwiftUI
import OptaPlus
import OptaMolt

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
        NavigationStack {
            Form {
                // Name & Command
                Section("Job Details") {
                    TextField("Job Name", text: $name)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Command")
                            .font(.sora(12, weight: .regular))
                            .foregroundColor(.optaTextSecondary)
                        TextEditor(text: $command)
                            .font(.system(size: 14, design: .monospaced))
                            .frame(minHeight: 80)
                            .scrollContentBackground(.hidden)
                            .background(Color.optaSurface)
                            .cornerRadius(8)
                    }
                }

                // Schedule
                Section {
                    Picker("Schedule Type", selection: $scheduleKind) {
                        ForEach(ScheduleKind.allCases, id: \.self) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)

                    switch scheduleKind {
                    case .cron:
                        TextField("Cron Expression", text: $cronExpression)
                            .font(.soraBody)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Text(cronPreview)
                            .font(.sora(12, weight: .regular))
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
                        DatePicker("Run At", selection: $oneTimeDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    }
                } header: {
                    Text("Schedule")
                }

                // Session Target
                Section {
                    Picker("Session", selection: $sessionTarget) {
                        ForEach(availableSessions, id: \.self) { session in
                            Text(session).tag(session)
                        }
                    }
                } header: {
                    Text("Session Target")
                }

                // Model (optional)
                Section {
                    TextField("Model (optional)", text: $model)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Model Override")
                } footer: {
                    Text("Leave empty to use the bot's default model.")
                        .font(.soraCaption)
                        .foregroundColor(.optaTextMuted)
                }

                // Error
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .font(.soraCaption)
                            .foregroundColor(.optaRed)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle(isEditing ? "Edit Job" : "Create Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Create") {
                        save()
                    }
                    .disabled(!canSave || isSaving)
                }
            }
            .task {
                await loadSessions()
                if let job = existingJob {
                    populateFromJob(job)
                }
            }
        }
    }

    // MARK: - Cron Preview

    private var cronPreview: String {
        let parts = cronExpression.split(separator: " ")
        guard parts.count >= 5 else { return "Invalid cron expression" }
        let min = String(parts[0])
        let hour = String(parts[1])
        if min != "*" && hour != "*" {
            return "Runs daily at \(hour.leftPad(2)):\(min.leftPad(2))"
        }
        if min == "*" && hour == "*" {
            return "Runs every minute"
        }
        if min == "0" && hour == "*" {
            return "Runs every hour"
        }
        return "Custom schedule: \(cronExpression)"
    }

    // MARK: - Actions

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
                    // Edit existing job
                    _ = try await viewModel.call("cron.update", params: [
                        "jobId": job.id,
                        "patch": [
                            "name": name,
                            "schedule": schedule,
                            "payload": payload,
                            "sessionTarget": sessionTarget
                        ] as [String: Any]
                    ])
                } else {
                    // Create new job
                    _ = try await viewModel.call("cron.add", params: [
                        "name": name,
                        "schedule": schedule,
                        "payload": payload,
                        "sessionTarget": sessionTarget,
                        "enabled": true
                    ] as [String: Any])
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                onSaved()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
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
                if !keys.isEmpty {
                    availableSessions = keys
                }
            }
        } catch {
            // Fallback to ["main"]
        }
    }

    private func populateFromJob(_ job: CronJobItem) {
        name = job.name
        sessionTarget = job.sessionTarget
        model = job.model ?? ""

        // Populate command from raw payload
        if let payload = job.rawPayload {
            command = payload["message"] as? String ?? payload["prompt"] as? String ?? ""
        }

        // Populate schedule from raw schedule
        if let schedule = job.rawSchedule {
            let kind = schedule["kind"] as? String ?? ""
            switch kind {
            case "cron":
                scheduleKind = .cron
                cronExpression = schedule["expression"] as? String ?? schedule["expr"] as? String ?? "0 9 * * *"
            case "every":
                scheduleKind = .every
                let ms = schedule["intervalMs"] as? Int ?? schedule["interval"] as? Int ?? 60_000
                if ms >= 3_600_000 {
                    intervalValue = ms / 3_600_000
                    intervalUnit = .hours
                } else if ms >= 60_000 {
                    intervalValue = ms / 60_000
                    intervalUnit = .minutes
                } else {
                    intervalValue = ms / 1000
                    intervalUnit = .seconds
                }
            case "at":
                scheduleKind = .at
                if let ts = schedule["date"] as? Double {
                    oneTimeDate = Date(timeIntervalSince1970: ts / 1000)
                }
            default:
                break
            }
        }
    }
}
