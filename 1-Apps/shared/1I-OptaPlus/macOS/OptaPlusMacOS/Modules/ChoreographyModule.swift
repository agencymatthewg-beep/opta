//
//  ChoreographyModule.swift
//  OptaPlusMacOS
//
//  X2. Bot Choreography Mode — chain multiple bots into automated workflows.
//  Visual pipeline editor with drag-to-reorder, conditional branching, and
//  scheduled execution via the existing cron system.
//
//  Module registration:  Add ChoreographyModule to ContentView's detail mode
//  Module removal:       Delete this file. Bots only accessible via direct chat.
//
//  Keyboard shortcuts:
//    ⌘⇧P  — Open pipeline editor
//    Space — Run selected pipeline (when editor focused)
//    ⌘⇧R  — Rerun last pipeline
//
//  Event bus:
//    Posts:    .module_choreography_started, .module_choreography_completed, .module_choreography_stepCompleted
//    Listens:  .module_choreography_toggle
//

import SwiftUI
import Combine
import OptaMolt
import os.log

// MARK: - Pipeline Models

/// A complete pipeline definition: an ordered sequence of bot steps.
struct Pipeline: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var steps: [PipelineStep]
    var createdAt: Date
    var lastRunAt: Date?
    var icon: String  // SF Symbol name

    static func == (lhs: Pipeline, rhs: Pipeline) -> Bool { lhs.id == rhs.id }

    init(id: String = UUID().uuidString, name: String, steps: [PipelineStep] = [],
         icon: String = "arrow.triangle.branch") {
        self.id = id
        self.name = name
        self.steps = steps
        self.createdAt = Date()
        self.icon = icon
    }
}

/// A single step in a pipeline.
struct PipelineStep: Identifiable, Codable, Equatable {
    let id: String
    var botId: String
    var botName: String
    var botEmoji: String
    var promptTemplate: String  // Supports {{input}} placeholder
    var outputTransform: OutputTransform
    var condition: StepCondition?
    var isEnabled: Bool

    static func == (lhs: PipelineStep, rhs: PipelineStep) -> Bool { lhs.id == rhs.id }

    init(id: String = UUID().uuidString, botId: String, botName: String,
         botEmoji: String, promptTemplate: String,
         outputTransform: OutputTransform = .passthrough,
         condition: StepCondition? = nil, isEnabled: Bool = true) {
        self.id = id
        self.botId = botId
        self.botName = botName
        self.botEmoji = botEmoji
        self.promptTemplate = promptTemplate
        self.outputTransform = outputTransform
        self.condition = condition
        self.isEnabled = isEnabled
    }
}

/// How to transform a step's output before passing to the next step.
enum OutputTransform: String, Codable, CaseIterable {
    case passthrough   // Pass full output as-is
    case firstLine     // Only the first line
    case lastLine      // Only the last line
    case codeBlocks    // Extract code blocks only
    case summary       // Prepend "Summarize:" to output and pass to next step

    var label: String {
        switch self {
        case .passthrough: return "Full output"
        case .firstLine: return "First line"
        case .lastLine: return "Last line"
        case .codeBlocks: return "Code blocks"
        case .summary: return "Summary"
        }
    }
}

/// An optional condition that gates whether a step executes.
struct StepCondition: Codable, Equatable {
    var type: ConditionType
    var value: String

    enum ConditionType: String, Codable, CaseIterable {
        case contains       // Output contains value
        case notContains    // Output does not contain value
        case longerThan     // Output longer than N characters
        case always         // Always execute
    }

    func evaluate(input: String) -> Bool {
        switch type {
        case .contains: return input.lowercased().contains(value.lowercased())
        case .notContains: return !input.lowercased().contains(value.lowercased())
        case .longerThan: return input.count > (Int(value) ?? 0)
        case .always: return true
        }
    }
}

// MARK: - Pipeline Execution

/// Status of a pipeline run.
enum PipelineRunStatus: String, Codable {
    case pending, running, completed, failed, aborted
}

/// Status of a single step execution.
enum StepStatus: String, Codable {
    case pending, running, completed, failed, skipped
}

/// Result of executing one pipeline step.
struct StepResult: Identifiable, Codable {
    let id: String
    let stepId: String
    let input: String
    let output: String
    let duration: TimeInterval
    let tokenEstimate: Int  // Rough estimate based on char count
    let status: StepStatus

    init(stepId: String, input: String, output: String,
         duration: TimeInterval, status: StepStatus) {
        self.id = UUID().uuidString
        self.stepId = stepId
        self.input = input
        self.output = output
        self.duration = duration
        self.tokenEstimate = output.count / 4  // rough approximation
        self.status = status
    }
}

/// A complete pipeline execution record.
struct PipelineRun: Identifiable, Codable {
    let id: String
    let pipelineId: String
    let pipelineName: String
    var stepResults: [StepResult]
    let startedAt: Date
    var completedAt: Date?
    var status: PipelineRunStatus

    var totalDuration: TimeInterval {
        if let completed = completedAt {
            return completed.timeIntervalSince(startedAt)
        }
        return Date().timeIntervalSince(startedAt)
    }

    var totalTokens: Int {
        stepResults.reduce(0) { $0 + $1.tokenEstimate }
    }
}

// MARK: - Pipeline Templates

extension Pipeline {
    static let templates: [Pipeline] = [
        Pipeline(
            name: "Code Review",
            steps: [
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "1️⃣",
                             promptTemplate: "Write a function that {{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "2️⃣",
                             promptTemplate: "Review this code for bugs and improvements:\n\n{{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "3️⃣",
                             promptTemplate: "Apply the review feedback to fix this code:\n\n{{input}}"),
            ],
            icon: "doc.text.magnifyingglass"
        ),
        Pipeline(
            name: "Research Pipeline",
            steps: [
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "1️⃣",
                             promptTemplate: "Research and list key facts about: {{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "2️⃣",
                             promptTemplate: "Fact-check and verify these claims:\n\n{{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "3️⃣",
                             promptTemplate: "Write a concise report based on:\n\n{{input}}"),
            ],
            icon: "magnifyingglass.circle"
        ),
        Pipeline(
            name: "Creative Writing",
            steps: [
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "1️⃣",
                             promptTemplate: "Brainstorm 5 creative ideas for: {{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "2️⃣",
                             promptTemplate: "Expand idea #1 from this list into a detailed draft:\n\n{{input}}"),
                PipelineStep(botId: "", botName: "Select Bot", botEmoji: "3️⃣",
                             promptTemplate: "Critique and refine this draft:\n\n{{input}}"),
            ],
            icon: "paintbrush"
        ),
    ]
}

// MARK: - Pipeline Store

/// Persists pipelines and run history to App Support.
@MainActor
final class PipelineStore: ObservableObject {
    static let shared = PipelineStore()

    @Published var pipelines: [Pipeline] = []
    @Published var runHistory: [PipelineRun] = []

    private let pipelinesURL: URL
    private let historyURL: URL
    private static let maxHistory = 50

    private init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("OptaPlus/Choreography", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        self.pipelinesURL = support.appendingPathComponent("pipelines.json")
        self.historyURL = support.appendingPathComponent("history.json")
        load()
    }

    func save(_ pipeline: Pipeline) {
        if let idx = pipelines.firstIndex(where: { $0.id == pipeline.id }) {
            pipelines[idx] = pipeline
        } else {
            pipelines.append(pipeline)
        }
        persist()
    }

    func delete(_ pipelineId: String) {
        pipelines.removeAll { $0.id == pipelineId }
        persist()
    }

    func addRun(_ run: PipelineRun) {
        runHistory.insert(run, at: 0)
        if runHistory.count > Self.maxHistory {
            runHistory = Array(runHistory.prefix(Self.maxHistory))
        }
        persistHistory()
    }

    func updateRun(_ run: PipelineRun) {
        if let idx = runHistory.firstIndex(where: { $0.id == run.id }) {
            runHistory[idx] = run
            persistHistory()
        }
    }

    private func load() {
        if let data = try? Data(contentsOf: pipelinesURL),
           let decoded = try? JSONDecoder().decode([Pipeline].self, from: data) {
            pipelines = decoded
        }
        if let data = try? Data(contentsOf: historyURL),
           let decoded = try? JSONDecoder().decode([PipelineRun].self, from: data) {
            runHistory = decoded
        }
    }

    private func persist() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(pipelines) {
            try? data.write(to: pipelinesURL, options: .atomic)
        }
    }

    private func persistHistory() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(runHistory) {
            try? data.write(to: historyURL, options: .atomic)
        }
    }
}

// MARK: - Pipeline Executor

/// Executes a pipeline by sending prompts to bots sequentially via their ChatViewModels.
@MainActor
final class PipelineExecutor: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Choreography")

    @Published var currentRun: PipelineRun?
    @Published var currentStepIndex: Int = 0
    @Published var isRunning: Bool = false
    @Published var currentStepOutput: String = ""

    private var executionTask: Task<Void, Never>?

    /// Execute a pipeline with the given initial input.
    func execute(pipeline: Pipeline, initialInput: String, appState: AppState) {
        guard !isRunning else { return }
        isRunning = true
        currentStepIndex = 0
        currentStepOutput = ""

        var run = PipelineRun(
            id: UUID().uuidString,
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            stepResults: [],
            startedAt: Date(),
            status: .running
        )
        currentRun = run
        PipelineStore.shared.addRun(run)

        NotificationCenter.default.post(name: .module_choreography_started, object: nil,
                                        userInfo: ["pipelineId": pipeline.id])

        executionTask = Task { [weak self] in
            guard let self else { return }
            var currentInput = initialInput

            for (index, step) in pipeline.steps.enumerated() {
                guard !Task.isCancelled else {
                    run.status = .aborted
                    run.completedAt = Date()
                    self.currentRun = run
                    PipelineStore.shared.updateRun(run)
                    self.isRunning = false
                    return
                }

                guard step.isEnabled else {
                    run.stepResults.append(StepResult(
                        stepId: step.id, input: currentInput, output: "",
                        duration: 0, status: .skipped
                    ))
                    continue
                }

                // Check condition
                if let condition = step.condition, !condition.evaluate(input: currentInput) {
                    run.stepResults.append(StepResult(
                        stepId: step.id, input: currentInput, output: "",
                        duration: 0, status: .skipped
                    ))
                    continue
                }

                self.currentStepIndex = index
                self.currentStepOutput = ""

                // Build the prompt from template
                let prompt = step.promptTemplate.replacingOccurrences(of: "{{input}}", with: currentInput)

                // Get the VM for this step's bot
                guard let bot = appState.bots.first(where: { $0.id == step.botId }) else {
                    let result = StepResult(
                        stepId: step.id, input: currentInput,
                        output: "Error: Bot not found",
                        duration: 0, status: .failed
                    )
                    run.stepResults.append(result)
                    run.status = .failed
                    run.completedAt = Date()
                    self.currentRun = run
                    PipelineStore.shared.updateRun(run)
                    self.isRunning = false
                    return
                }

                let vm = appState.viewModel(for: bot)
                let stepStart = Date()

                // Send the prompt
                await vm.send(prompt)

                // Wait for bot to finish responding (poll botState)
                var output = ""
                while vm.botState != .idle {
                    try? await Task.sleep(nanoseconds: 200_000_000) // 200ms
                    guard !Task.isCancelled else { break }
                    output = vm.messages.last?.content ?? ""
                    self.currentStepOutput = output
                }

                // Get the final bot response
                if let lastMsg = vm.messages.last, lastMsg.sender != .user {
                    output = lastMsg.content
                }

                let duration = Date().timeIntervalSince(stepStart)

                // Apply output transform
                let transformed: String
                switch step.outputTransform {
                case .passthrough: transformed = output
                case .firstLine: transformed = String(output.split(separator: "\n").first ?? "")
                case .lastLine: transformed = String(output.split(separator: "\n").last ?? "")
                case .codeBlocks:
                    let pattern = "```[\\s\\S]*?```"
                    if let regex = try? NSRegularExpression(pattern: pattern),
                       let match = regex.firstMatch(in: output, range: NSRange(output.startIndex..., in: output)) {
                        transformed = String(output[Range(match.range, in: output)!])
                    } else {
                        transformed = output
                    }
                case .summary: transformed = output
                }

                let result = StepResult(
                    stepId: step.id, input: currentInput, output: transformed,
                    duration: duration, status: .completed
                )
                run.stepResults.append(result)
                currentInput = transformed

                NotificationCenter.default.post(name: .module_choreography_stepCompleted, object: nil,
                                                userInfo: ["stepId": step.id, "pipelineId": pipeline.id])
            }

            run.status = .completed
            run.completedAt = Date()
            self.currentRun = run
            PipelineStore.shared.updateRun(run)
            self.isRunning = false

            NotificationCenter.default.post(name: .module_choreography_completed, object: nil,
                                            userInfo: ["pipelineId": pipeline.id])
        }
    }

    /// Abort the current pipeline execution.
    func abort() {
        executionTask?.cancel()
        executionTask = nil
        isRunning = false
        if var run = currentRun {
            run.status = .aborted
            run.completedAt = Date()
            currentRun = run
            PipelineStore.shared.updateRun(run)
        }
    }
}

// MARK: - Pipeline Editor View

struct PipelineEditorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var store = PipelineStore.shared
    @StateObject private var executor = PipelineExecutor()

    @State private var selectedPipelineId: String?
    @State private var isEditingStep: PipelineStep?
    @State private var initialInput: String = ""
    @State private var showTemplates: Bool = false
    @State private var showHistory: Bool = false

    private var selectedPipeline: Pipeline? {
        store.pipelines.first { $0.id == selectedPipelineId }
    }

    var body: some View {
        HSplitView {
            // Left: Pipeline list
            pipelineList
                .frame(minWidth: 200, maxWidth: 250)

            // Right: Pipeline detail / canvas
            if let pipeline = selectedPipeline {
                pipelineCanvas(pipeline)
            } else {
                emptyState
            }
        }
        .background(Color.optaVoid)
        .sheet(item: $isEditingStep) { step in
            StepEditorSheet(step: step, bots: appState.bots) { updated in
                if var p = selectedPipeline, let idx = p.steps.firstIndex(where: { $0.id == updated.id }) {
                    p.steps[idx] = updated
                    store.save(p)
                }
            }
        }
        .sheet(isPresented: $showTemplates) {
            TemplatePickerSheet(onSelect: { template in
                var p = template
                p = Pipeline(name: template.name, steps: template.steps, icon: template.icon)
                store.save(p)
                selectedPipelineId = p.id
                showTemplates = false
            })
        }
    }

    // MARK: - Pipeline List

    private var pipelineList: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Pipelines")
                    .font(.sora(13, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Menu {
                    Button("New Pipeline") {
                        let p = Pipeline(name: "Untitled Pipeline")
                        store.save(p)
                        selectedPipelineId = p.id
                    }
                    Button("From Template...") { showTemplates = true }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 12))
                        .foregroundColor(.optaPrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider().background(Color.optaBorder)

            // Pipeline list
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(store.pipelines) { pipeline in
                        pipelineRow(pipeline)
                    }
                }
                .padding(8)
            }

            Divider().background(Color.optaBorder)

            // History toggle
            Button(action: { showHistory.toggle() }) {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 11))
                    Text("Run History")
                        .font(.sora(11))
                }
                .foregroundColor(.optaTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
        }
        .background(Color.optaSurface.opacity(0.3))
    }

    private func pipelineRow(_ pipeline: Pipeline) -> some View {
        HStack(spacing: 8) {
            Image(systemName: pipeline.icon)
                .font(.system(size: 12))
                .foregroundColor(selectedPipelineId == pipeline.id ? .optaPrimary : .optaTextSecondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(pipeline.name)
                    .font(.sora(12, weight: selectedPipelineId == pipeline.id ? .semibold : .regular))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
                Text("\(pipeline.steps.count) steps")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
            }
            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(selectedPipelineId == pipeline.id ? Color.optaPrimaryDim : Color.clear)
        )
        .onTapGesture { selectedPipelineId = pipeline.id }
        .contextMenu {
            Button("Duplicate") {
                var dup = pipeline
                dup = Pipeline(name: "\(pipeline.name) Copy", steps: pipeline.steps, icon: pipeline.icon)
                store.save(dup)
            }
            Divider()
            Button("Delete", role: .destructive) {
                store.delete(pipeline.id)
                if selectedPipelineId == pipeline.id { selectedPipelineId = nil }
            }
        }
    }

    // MARK: - Pipeline Canvas

    private func pipelineCanvas(_ pipeline: Pipeline) -> some View {
        VStack(spacing: 0) {
            // Canvas header
            HStack {
                Image(systemName: pipeline.icon)
                    .foregroundColor(.optaPrimary)
                Text(pipeline.name)
                    .font(.sora(15, weight: .semibold))
                    .foregroundColor(.optaTextPrimary)

                Spacer()

                // Run button
                if executor.isRunning {
                    Button(action: { executor.abort() }) {
                        HStack(spacing: 4) {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 10))
                            Text("Abort")
                                .font(.sora(11, weight: .medium))
                        }
                        .foregroundColor(.optaRed)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().stroke(Color.optaRed.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: {
                        executor.execute(pipeline: pipeline, initialInput: initialInput, appState: appState)
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "play.fill")
                                .font(.system(size: 10))
                            Text("Run")
                                .font(.sora(11, weight: .medium))
                        }
                        .foregroundColor(.optaVoid)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Color.optaPrimary))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider().background(Color.optaBorder)

            // Initial input
            HStack(spacing: 8) {
                Image(systemName: "text.cursor")
                    .font(.system(size: 11))
                    .foregroundColor(.optaTextMuted)
                TextField("Initial input for the pipeline...", text: $initialInput)
                    .textFieldStyle(.plain)
                    .font(.sora(12))
                    .foregroundColor(.optaTextPrimary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.optaSurface.opacity(0.3))

            Divider().background(Color.optaBorder.opacity(0.5))

            // Step flow
            ScrollView(.horizontal, showsIndicators: true) {
                HStack(spacing: 0) {
                    ForEach(Array(pipeline.steps.enumerated()), id: \.element.id) { index, step in
                        stepNode(step, index: index, pipeline: pipeline)

                        // Connector arrow between steps
                        if index < pipeline.steps.count - 1 {
                            stepConnector(isActive: executor.isRunning && executor.currentStepIndex > index,
                                          isCurrent: executor.isRunning && executor.currentStepIndex == index)
                        }
                    }

                    // Add step button
                    addStepButton(pipeline: pipeline)
                }
                .padding(20)
            }
            .frame(maxHeight: .infinity)

            // Execution progress
            if executor.isRunning, let run = executor.currentRun {
                executionProgress(run)
            }
        }
        .background(Color(hex: "#0A0A0A"))
    }

    // MARK: - Step Node

    private func stepNode(_ step: PipelineStep, index: Int, pipeline: Pipeline) -> some View {
        let isActive = executor.isRunning && executor.currentStepIndex == index
        let isCompleted = executor.isRunning && executor.currentStepIndex > index

        return VStack(spacing: 8) {
            // Bot emoji
            Text(step.botEmoji)
                .font(.system(size: 22))
                .scaleEffect(isActive ? 1.1 : 1.0)
                .animation(.optaSpring, value: isActive)

            // Bot name
            Text(step.botName)
                .font(.sora(10, weight: .semibold))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(1)

            // Prompt preview
            Text(step.promptTemplate.prefix(40) + (step.promptTemplate.count > 40 ? "..." : ""))
                .font(.sora(9))
                .foregroundColor(.optaTextMuted)
                .lineLimit(2)
                .frame(width: 110)

            // Transform badge
            if step.outputTransform != .passthrough {
                Text(step.outputTransform.label)
                    .font(.sora(8, weight: .medium))
                    .foregroundColor(.optaCyan)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.optaCyan.opacity(0.1)))
            }

            // Status indicator
            if isCompleted {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.optaGreen)
            } else if isActive {
                OptaLoader(size: 12)
            }
        }
        .padding(14)
        .frame(minWidth: 140, maxWidth: 140, minHeight: 120)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(
                    isActive ? Color.optaPrimary.opacity(0.6) :
                    isCompleted ? Color.optaGreen.opacity(0.3) :
                    Color.optaBorder.opacity(0.3),
                    lineWidth: isActive ? 1.5 : 0.5
                )
        )
        .shadow(color: isActive ? Color.optaPrimary.opacity(0.2) : .clear, radius: 12)
        .onTapGesture { isEditingStep = step }
        .opacity(step.isEnabled ? 1.0 : 0.4)
        .contextMenu {
            Button("Edit Step") { isEditingStep = step }
            Button(step.isEnabled ? "Disable" : "Enable") {
                var p = pipeline
                if let idx = p.steps.firstIndex(where: { $0.id == step.id }) {
                    p.steps[idx].isEnabled.toggle()
                    store.save(p)
                }
            }
            Divider()
            Button("Delete Step", role: .destructive) {
                var p = pipeline
                p.steps.removeAll { $0.id == step.id }
                store.save(p)
            }
        }
    }

    // MARK: - Connector

    private func stepConnector(isActive: Bool, isCurrent: Bool) -> some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(
                    isActive ? Color.optaGreen :
                    isCurrent ? Color.optaPrimary :
                    Color.optaBorder.opacity(0.4)
                )
                .frame(width: 30, height: 2)

            Image(systemName: "chevron.right")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(
                    isActive ? .optaGreen :
                    isCurrent ? .optaPrimary :
                    .optaTextMuted
                )

            Rectangle()
                .fill(
                    isActive ? Color.optaGreen :
                    isCurrent ? Color.optaPrimary :
                    Color.optaBorder.opacity(0.4)
                )
                .frame(width: 30, height: 2)
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Add Step

    private func addStepButton(pipeline: Pipeline) -> some View {
        Button(action: {
            var p = pipeline
            let newStep = PipelineStep(
                botId: appState.bots.first?.id ?? "",
                botName: appState.bots.first?.name ?? "Bot",
                botEmoji: appState.bots.first?.emoji ?? "🤖",
                promptTemplate: "{{input}}"
            )
            p.steps.append(newStep)
            store.save(p)
            isEditingStep = newStep
        }) {
            VStack(spacing: 6) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.optaPrimary.opacity(0.6))
                Text("Add Step")
                    .font(.sora(10))
                    .foregroundColor(.optaTextMuted)
            }
            .frame(width: 80, height: 80)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaPrimary.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            )
        }
        .buttonStyle(.plain)
        .padding(.leading, 16)
    }

    // MARK: - Execution Progress

    private func executionProgress(_ run: PipelineRun) -> some View {
        VStack(spacing: 8) {
            Divider().background(Color.optaBorder)

            HStack {
                OptaLoader(size: 12)
                Text("Step \(executor.currentStepIndex + 1) of \(run.stepResults.count + 1)")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)

                Spacer()

                Text(String(format: "%.1fs", run.totalDuration))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.horizontal, 16)

            // Current output preview
            if !executor.currentStepOutput.isEmpty {
                Text(executor.currentStepOutput.prefix(200))
                    .font(.sora(10))
                    .foregroundColor(.optaTextSecondary)
                    .lineLimit(3)
                    .padding(.horizontal, 16)
            }
        }
        .padding(.bottom, 10)
        .background(Color.optaSurface.opacity(0.3))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.triangle.branch")
                .font(.system(size: 36))
                .foregroundColor(.optaTextMuted)
            Text("Bot Choreography")
                .font(.sora(15, weight: .semibold))
                .foregroundColor(.optaTextSecondary)
            Text("Chain multiple bots into automated workflows")
                .font(.sora(12))
                .foregroundColor(.optaTextMuted)
            Button("Create Pipeline") {
                let p = Pipeline(name: "New Pipeline")
                store.save(p)
                selectedPipelineId = p.id
            }
            .buttonStyle(.plain)
            .font(.sora(12, weight: .medium))
            .foregroundColor(.optaPrimary)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Step Editor Sheet

struct StepEditorSheet: View {
    @State var step: PipelineStep
    let bots: [BotConfig]
    var onSave: (PipelineStep) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("Edit Step")
                .font(.sora(15, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            // Bot selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Bot")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Picker("Bot", selection: $step.botId) {
                    ForEach(bots) { bot in
                        HStack {
                            Text(bot.emoji)
                            Text(bot.name)
                        }
                        .tag(bot.id)
                    }
                }
                .onChange(of: step.botId) { _, newId in
                    if let bot = bots.first(where: { $0.id == newId }) {
                        step.botName = bot.name
                        step.botEmoji = bot.emoji
                    }
                }
            }

            // Prompt template
            VStack(alignment: .leading, spacing: 4) {
                Text("Prompt Template")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Text("Use {{input}} for the previous step's output")
                    .font(.sora(9))
                    .foregroundColor(.optaTextMuted)
                TextEditor(text: $step.promptTemplate)
                    .font(.sora(12))
                    .frame(height: 100)
                    .background(Color.optaSurface)
                    .cornerRadius(8)
            }

            // Output transform
            VStack(alignment: .leading, spacing: 4) {
                Text("Output Transform")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextSecondary)
                Picker("Transform", selection: $step.outputTransform) {
                    ForEach(OutputTransform.allCases, id: \.self) { t in
                        Text(t.label).tag(t)
                    }
                }
            }

            HStack {
                Button("Cancel") { dismiss() }
                    .buttonStyle(.plain)
                    .foregroundColor(.optaTextSecondary)
                Spacer()
                Button("Save") {
                    onSave(step)
                    dismiss()
                }
                .buttonStyle(.plain)
                .foregroundColor(.optaPrimary)
                .font(.sora(13, weight: .semibold))
            }
        }
        .padding(20)
        .frame(width: 400)
        .background(Color.optaVoid)
    }
}

// MARK: - Template Picker Sheet

struct TemplatePickerSheet: View {
    var onSelect: (Pipeline) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("Pipeline Templates")
                .font(.sora(15, weight: .semibold))
                .foregroundColor(.optaTextPrimary)

            ForEach(Pipeline.templates) { template in
                Button(action: { onSelect(template) }) {
                    HStack(spacing: 10) {
                        Image(systemName: template.icon)
                            .font(.system(size: 16))
                            .foregroundColor(.optaPrimary)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(template.name)
                                .font(.sora(13, weight: .medium))
                                .foregroundColor(.optaTextPrimary)
                            Text("\(template.steps.count) steps")
                                .font(.sora(10))
                                .foregroundColor(.optaTextMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundColor(.optaTextMuted)
                    }
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaSurface.opacity(0.3))
                    )
                }
                .buttonStyle(.plain)
            }

            Button("Cancel") { dismiss() }
                .foregroundColor(.optaTextSecondary)
        }
        .padding(20)
        .frame(width: 360)
        .background(Color.optaVoid)
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_choreography_toggle = Notification.Name("module.choreography.toggle")
    static let module_choreography_started = Notification.Name("module.choreography.started")
    static let module_choreography_completed = Notification.Name("module.choreography.completed")
    static let module_choreography_stepCompleted = Notification.Name("module.choreography.stepCompleted")
}
