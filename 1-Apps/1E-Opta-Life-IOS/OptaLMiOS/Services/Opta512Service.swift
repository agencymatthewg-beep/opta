import Foundation
import Combine

// MARK: - Opta512 Personal Assistant Service
// Bridges OptiLife iOS with Opta512's personal assistant data (SCHEDULE.md & PRIORITIES.md)

@MainActor
class Opta512Service: ObservableObject {
    static let shared = Opta512Service()
    
    // MARK: - Published Properties
    
    @Published var schedule: Opta512Schedule?
    @Published var priorities: Opta512Priorities?
    @Published var lastSync: Date?
    @Published var isLoading = false
    @Published var error: Opta512Error?
    
    // MARK: - Paths
    
    private let schedulePath = "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/SCHEDULE.md"
    private let prioritiesPath = "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/PRIORITIES.md"
    
    // MARK: - Init
    
    private init() {
        // Auto-sync on init
        Task {
            await syncAll()
        }
    }
    
    // MARK: - Public Methods
    
    func syncAll() async {
        isLoading = true
        error = nil
        
        do {
            // Read both files
            async let scheduleData = readSchedule()
            async let prioritiesData = readPriorities()
            
            let (sched, prior) = try await (scheduleData, prioritiesData)
            
            self.schedule = sched
            self.priorities = prior
            self.lastSync = Date()
            
        } catch let err as Opta512Error {
            self.error = err
            print("[Opta512Service] Sync failed: \(err.localizedDescription)")
        } catch {
            self.error = .unknown(error.localizedDescription)
            print("[Opta512Service] Unexpected error: \(error)")
        }
        
        isLoading = false
    }
    
    func getTodayEvents() -> [CalendarEvent] {
        guard let schedule = schedule else { return [] }
        return schedule.todayEvents
    }
    
    func getTodayTasks() -> [OptaTask] {
        guard let priorities = priorities else { return [] }
        return priorities.dailyTasks
    }
    
    func getUpcomingEvents(days: Int = 7) -> [CalendarEvent] {
        guard let schedule = schedule else { return [] }
        // Filter events within next N days
        let endDate = Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date()
        return schedule.todayEvents.filter { event in
            guard let start = event.startDate else { return false }
            return start <= endDate
        }
    }
    
    // MARK: - Private Methods
    
    private func readSchedule() async throws -> Opta512Schedule {
        let content = try String(contentsOfFile: schedulePath, encoding: .utf8)
        return try parseSchedule(content)
    }
    
    private func readPriorities() async throws -> Opta512Priorities {
        let content = try String(contentsOfFile: prioritiesPath, encoding: .utf8)
        return try parsePriorities(content)
    }
    
    private func parseSchedule(_ content: String) throws -> Opta512Schedule {
        var events: [CalendarEvent] = []
        var lastUpdated: Date?
        var currentCalendar = ""
        
        let lines = content.components(separatedBy: .newlines)
        
        for line in lines {
            // Parse last updated
            if line.contains("**Last Updated:**") {
                // Extract date if needed
                lastUpdated = Date()
            }
            
            // Parse calendar source headers (e.g., "### 📅 rubymdavidson2005@gmail.com")
            if line.hasPrefix("### 📅") {
                currentCalendar = line.replacingOccurrences(of: "### 📅 ", with: "").trimmingCharacters(in: .whitespaces)
            }
            
            // Parse events (e.g., "- **17:00**: netball")
            if line.hasPrefix("- **") {
                let event = parseEventLine(line, calendar: currentCalendar)
                if let event = event {
                    events.append(event)
                }
            }
        }
        
        return Opta512Schedule(
            lastUpdated: lastUpdated ?? Date(),
            todayEvents: events
        )
    }
    
    private func parseEventLine(_ line: String, calendar: String) -> CalendarEvent? {
        // Examples:
        // - **17:00**: netball
        // - **All Day**: ANNIVERSARY 🌝
        // - **09:00**: netball
        
        guard line.hasPrefix("- **") else { return nil }
        
        // Extract time and summary
        let cleaned = line.replacingOccurrences(of: "- **", with: "")
        let parts = cleaned.components(separatedBy: "**: ")
        guard parts.count == 2 else { return nil }
        
        let timeStr = parts[0]
        let summary = parts[1]
        
        var startDate: Date?
        var isAllDay = false
        
        if timeStr == "All Day" {
            isAllDay = true
            // Set to today at midnight
            startDate = Calendar.current.startOfDay(for: Date())
        } else {
            // Parse time (e.g., "17:00")
            let timeComponents = timeStr.components(separatedBy: ":")
            if timeComponents.count == 2,
               let hour = Int(timeComponents[0]),
               let minute = Int(timeComponents[1]) {
                var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
                components.hour = hour
                components.minute = minute
                startDate = Calendar.current.date(from: components)
            }
        }
        
        guard let start = startDate else { return nil }
        
        let fmt = ISO8601DateFormatter()
        return CalendarEvent(
            id: UUID().uuidString,
            summary: summary,
            description: nil,
            start: fmt.string(from: start),
            end: isAllDay ? nil : fmt.string(from: start.addingTimeInterval(3600)),
            isAllDay: isAllDay,
            location: nil,
            htmlLink: nil
        )
    }
    
    private func parsePriorities(_ content: String) throws -> Opta512Priorities {
        var dailyTasks: [OptaTask] = []
        var weeklyGoals: [String] = []
        var projects: [Opta512Project] = []
        
        let lines = content.components(separatedBy: .newlines)
        var currentSection = ""
        
        for line in lines {
            // Detect sections
            if line.hasPrefix("## A. Daily Task List") {
                currentSection = "daily"
            } else if line.hasPrefix("## B. Weekly Goals") {
                currentSection = "weekly"
            } else if line.hasPrefix("## C. Project Milestones") {
                currentSection = "projects"
            } else if line.hasPrefix("## D.") || line.hasPrefix("## E.") || line.hasPrefix("## F.") || line.hasPrefix("## G.") || line.hasPrefix("## H.") {
                currentSection = ""
            }
            
            // Parse daily tasks
            if currentSection == "daily" && (line.hasPrefix("- [ ]") || line.hasPrefix("- [x]")) {
                let task = parseTaskLine(line)
                if let task = task {
                    dailyTasks.append(task)
                }
            }
            
            // Parse weekly goals
            if currentSection == "weekly" && line.hasPrefix("- [ ]") {
                let goal = line.replacingOccurrences(of: "- [ ] ", with: "").trimmingCharacters(in: .whitespaces)
                weeklyGoals.append(goal)
            }
            
            // Parse project table rows
            if currentSection == "projects" && line.hasPrefix("|") && !line.contains("Project") && !line.contains("---") {
                let project = parseProjectLine(line)
                if let project = project {
                    projects.append(project)
                }
            }
        }
        
        return Opta512Priorities(
            lastUpdated: Date(),
            dailyTasks: dailyTasks,
            weeklyGoals: weeklyGoals,
            projects: projects
        )
    }
    
    private func parseTaskLine(_ line: String) -> OptaTask? {
        // Examples:
        // - [ ] **🔴 OVERNIGHT (by 9:30am):** Build OptiLife iOS app
        // - [x] Personal assistant system setup complete
        
        let isCompleted = line.hasPrefix("- [x]")
        let cleaned = line.replacingOccurrences(of: "- [x] ", with: "").replacingOccurrences(of: "- [ ] ", with: "")
        
        var content = cleaned
        var priority = TaskPriority.normal
        var dueDate: Date?
        
        // Detect priority markers
        if cleaned.contains("🔴") {
            priority = .urgent
            content = content.replacingOccurrences(of: "🔴 ", with: "")
        } else if cleaned.contains("**BEFORE") || cleaned.contains("**BY") {
            priority = .high
        }
        
        // Extract deadline from content
        if let match = content.range(of: "by (\\d+:\\d+[ap]m)", options: .regularExpression) {
            let timeStr = String(content[match])
            // Parse time and set due date
            // Simplified: just flag as high priority for now
            priority = .high
        }
        
        // Clean up markdown bold markers
        content = content.replacingOccurrences(of: "**", with: "")
        
        return OptaTask(
            id: UUID().uuidString,
            content: content,
            description: nil,
            projectId: nil,
            priority: priority,
            due: dueDate != nil ? TaskDue(
                date: dueDate!.isoString,
                string: "Today",
                datetime: dueDate!.isoString,
                timezone: nil,
                isRecurring: false
            ) : nil,
            labels: ["opta512"],
            isCompleted: isCompleted,
            createdAt: Date()
        )
    }
    
    private func parseProjectLine(_ line: String) -> Opta512Project? {
        // Example: | Personal Assistant | System operational | 2026-02-14 | 🔴 In Progress |
        
        let parts = line.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 5 else { return nil }
        
        let name = parts[1]
        let milestone = parts[2]
        let deadline = parts[3]
        let status = parts[4]
        
        guard !name.isEmpty, name != "—" else { return nil }
        
        return Opta512Project(
            name: name,
            milestone: milestone,
            deadline: deadline,
            status: status
        )
    }
}

// MARK: - Models

struct Opta512Schedule {
    let lastUpdated: Date
    let todayEvents: [CalendarEvent]
}

struct Opta512Priorities {
    let lastUpdated: Date
    let dailyTasks: [OptaTask]
    let weeklyGoals: [String]
    let projects: [Opta512Project]
}

struct Opta512Project {
    let name: String
    let milestone: String
    let deadline: String
    let status: String
}

enum Opta512Error: LocalizedError {
    case fileNotFound(String)
    case parseError(String)
    case unknown(String)
    
    var errorDescription: String? {
        switch self {
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .parseError(let msg):
            return "Parse error: \(msg)"
        case .unknown(let msg):
            return "Unknown error: \(msg)"
        }
    }
}

// MARK: - Date Helpers

extension Date {
    var isoString: String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}

