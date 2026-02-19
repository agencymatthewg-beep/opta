//
//  TaskProgressActivity.swift
//  OptaPlusIOS
//
//  Live Activity for showing active task/generation progress on lock screen.
//  ActivityKit, iOS 17+, Dynamic Island support, Cinematic Void design.
//

import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Activity Attributes

struct TaskProgressAttributes: ActivityAttributes {
    /// Static context — set once when activity starts.
    let taskId: String
    let botId: String
    let botName: String
    let botEmoji: String
    
    /// Dynamic state — updated as task progresses.
    struct ContentState: Codable, Hashable {
        let taskName: String
        let progress: Double      // 0.0 → 1.0
        let status: TaskStatus
        let statusText: String
        let startedAt: Date
        let estimatedEnd: Date?
        
        enum TaskStatus: String, Codable, Hashable {
            case running
            case thinking
            case streaming
            case completed
            case failed
            case cancelled
        }
        
        var progressPercent: Int { Int(progress * 100) }
        var isTerminal: Bool { [.completed, .failed, .cancelled].contains(status) }
    }
}

// MARK: - Lock Screen Banner (Expanded View)

struct TaskProgressBannerView: View {
    let context: ActivityViewContext<TaskProgressAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: Bot name + task
            HStack {
                Text(context.attributes.botEmoji)
                    .font(.system(size: 16))
                Text(context.attributes.botName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                statusBadge
            }
            
            // Task name
            Text(context.state.taskName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.8))
                .lineLimit(1)
            
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 6)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(progressColor)
                        .frame(width: geo.size.width * context.state.progress, height: 6)
                }
            }
            .frame(height: 6)
            
            // Footer: percentage + time
            HStack {
                Text("\(context.state.progressPercent)%")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(progressColor)
                Spacer()
                if let estimatedEnd = context.state.estimatedEnd {
                    Text("ETA ")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.4))
                    + Text(estimatedEnd, style: .relative)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
        }
        .padding(14)
        .activityBackgroundTint(Color(hex: "#0A0A0A"))
    }
    
    private var statusBadge: some View {
        Text(context.state.status.rawValue.uppercased())
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(progressColor)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule().fill(progressColor.opacity(0.2))
            )
    }
    
    private var progressColor: Color {
        switch context.state.status {
        case .running, .streaming: Color(hex: "#8B5CF6")
        case .thinking: Color(hex: "#F59E0B")
        case .completed: Color(hex: "#22C55E")
        case .failed: Color(hex: "#EF4444")
        case .cancelled: Color(hex: "#52525B")
        }
    }
}

// MARK: - Dynamic Island

struct TaskProgressDynamicIsland: View {
    let context: ActivityViewContext<TaskProgressAttributes>
    
    var body: some View {
        DynamicIsland {
            // Expanded regions
            DynamicIslandExpandedRegion(.leading) {
                HStack(spacing: 4) {
                    Text(context.attributes.botEmoji)
                        .font(.system(size: 14))
                    Text(context.attributes.botName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            
            DynamicIslandExpandedRegion(.trailing) {
                Text("\(context.state.progressPercent)%")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: "#8B5CF6"))
            }
            
            DynamicIslandExpandedRegion(.center) {
                Text(context.state.taskName)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
            }
            
            DynamicIslandExpandedRegion(.bottom) {
                ProgressView(value: context.state.progress)
                    .tint(Color(hex: "#8B5CF6"))
                    .padding(.horizontal, 4)
            }
        } compactLeading: {
            Text(context.attributes.botEmoji)
                .font(.system(size: 12))
        } compactTrailing: {
            Text("\(context.state.progressPercent)%")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(Color(hex: "#8B5CF6"))
        } minimal: {
            // Minimal: just a progress ring
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.2), lineWidth: 2)
                Circle()
                    .trim(from: 0, to: context.state.progress)
                    .stroke(Color(hex: "#8B5CF6"), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .padding(2)
        }
    }
}

// MARK: - Live Activity Widget Configuration

struct TaskProgressLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskProgressAttributes.self) { context in
            TaskProgressBannerView(context: context)
        } dynamicIsland: { context in
            TaskProgressDynamicIsland(context: context).body
        }
    }
}

// MARK: - Activity Manager

/// Manages starting, updating, and ending Live Activities for task progress.
@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()
    
    private var activeActivities: [String: Activity<TaskProgressAttributes>] = [:]
    
    /// Start a Live Activity for a task.
    func startActivity(
        taskId: String,
        taskName: String,
        botId: String,
        botName: String,
        botEmoji: String,
        estimatedDuration: TimeInterval? = nil
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        
        let attributes = TaskProgressAttributes(
            taskId: taskId,
            botId: botId,
            botName: botName,
            botEmoji: botEmoji
        )
        
        let initialState = TaskProgressAttributes.ContentState(
            taskName: taskName,
            progress: 0.0,
            status: .running,
            statusText: "Starting...",
            startedAt: Date(),
            estimatedEnd: estimatedDuration.map { Date().addingTimeInterval($0) }
        )
        
        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: initialState, staleDate: nil)
            )
            activeActivities[taskId] = activity
        } catch {
            // Silently fail — Live Activities are non-critical
        }
    }
    
    /// Update progress of an existing Live Activity.
    func updateProgress(
        taskId: String,
        progress: Double,
        status: TaskProgressAttributes.ContentState.TaskStatus = .running,
        statusText: String = "",
        estimatedEnd: Date? = nil
    ) {
        guard let activity = activeActivities[taskId] else { return }
        
        let state = TaskProgressAttributes.ContentState(
            taskName: activity.content.state.taskName,
            progress: min(1.0, max(0.0, progress)),
            status: status,
            statusText: statusText,
            startedAt: activity.content.state.startedAt,
            estimatedEnd: estimatedEnd ?? activity.content.state.estimatedEnd
        )
        
        Task {
            await activity.update(.init(state: state, staleDate: nil))
        }
    }
    
    /// End a Live Activity.
    func endActivity(
        taskId: String,
        status: TaskProgressAttributes.ContentState.TaskStatus = .completed,
        statusText: String = "Done"
    ) {
        guard let activity = activeActivities[taskId] else { return }
        
        let finalState = TaskProgressAttributes.ContentState(
            taskName: activity.content.state.taskName,
            progress: status == .completed ? 1.0 : activity.content.state.progress,
            status: status,
            statusText: statusText,
            startedAt: activity.content.state.startedAt,
            estimatedEnd: nil
        )
        
        Task {
            await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .after(.now + 30))
            activeActivities.removeValue(forKey: taskId)
        }
    }
    
    /// End all active activities.
    func endAllActivities() {
        for (taskId, _) in activeActivities {
            endActivity(taskId: taskId, status: .cancelled, statusText: "App closed")
        }
    }
}
