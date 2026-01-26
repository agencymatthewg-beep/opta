import AppIntents

// MARK: - Get Briefing Intent

struct GetBriefingIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Opta Briefing"
    static var description = IntentDescription("Get your daily briefing from Opta")
    
    static var openAppWhenRun: Bool = false
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let api = APIService.shared
        
        do {
            let briefing = try await api.fetchBriefing()
            
            // Create spoken response
            var spokenResponse = "Good \(briefing.greeting). "
            spokenResponse += "You have \(briefing.stats.tasksToday) task\(briefing.stats.tasksToday == 1 ? "" : "s") for today. "
            
            if briefing.stats.upcomingEvents > 0 {
                spokenResponse += "\(briefing.stats.upcomingEvents) upcoming event\(briefing.stats.upcomingEvents == 1 ? "" : "s"). "
            }
            
            if briefing.stats.unreadEmails > 0 {
                spokenResponse += "\(briefing.stats.unreadEmails) unread email\(briefing.stats.unreadEmails == 1 ? "" : "s"). "
            }
            
            // Add first event if available
            if let firstEvent = briefing.nextEvents.first {
                spokenResponse += "Next up: \(firstEvent.summary)."
            }
            
            return .result(
                dialog: IntentDialog(stringLiteral: spokenResponse),
                view: BriefingSnippetView(briefing: briefing)
            )
            
        } catch {
            return .result(
                dialog: "Sorry, I couldn't get your briefing right now.",
                view: ErrorSnippetView(message: "Unable to load briefing")
            )
        }
    }
}

// MARK: - Get Quick Status Intent

struct GetQuickStatusIntent: AppIntent {
    static var title: LocalizedStringResource = "Opta Quick Status"
    static var description = IntentDescription("Get a quick status update from Opta")
    
    static var openAppWhenRun: Bool = false
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        do {
            let status = try await api.fetchQuickStatus()
            return .result(dialog: IntentDialog(stringLiteral: status.spokenResponse))
            
        } catch {
            return .result(dialog: "Sorry, I couldn't get your status right now.")
        }
    }
}

// MARK: - Snippet Views

import SwiftUI

struct BriefingSnippetView: View {
    let briefing: Briefing
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.purple)
                Text("Opta Briefing")
                    .font(.headline)
            }
            
            // Stats
            HStack(spacing: 20) {
                StatView(icon: "checkmark.circle", value: "\(briefing.stats.tasksToday)", label: "Tasks", color: .green)
                StatView(icon: "calendar", value: "\(briefing.stats.upcomingEvents)", label: "Events", color: .blue)
                StatView(icon: "envelope", value: "\(briefing.stats.unreadEmails)", label: "Unread", color: .orange)
            }
            
            // Next event
            if let nextEvent = briefing.nextEvents.first {
                HStack {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                    Text(nextEvent.summary)
                        .font(.subheadline)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .padding()
    }
}

struct StatView: View {
    let icon: String
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(label)
                    .font(.caption2)
            }
            .foregroundColor(.secondary)
            
            Text(value)
                .font(.title2.bold().monospacedDigit())
                .foregroundColor(color)
        }
    }
}

struct ErrorSnippetView: View {
    let message: String
    
    var body: some View {
        VStack {
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundColor(.orange)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
