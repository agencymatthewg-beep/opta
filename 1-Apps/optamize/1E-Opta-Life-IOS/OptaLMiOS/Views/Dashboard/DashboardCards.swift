import SwiftUI

// MARK: - Tasks Card

struct TasksCard: View {
    let tasks: [OptaTask]
    var isLoading: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "checklist")
                        .font(.caption)
                        .foregroundColor(.optaNeonGreen)
                    
                    Text("TASKS")
                        .font(.caption.bold())
                        .foregroundColor(.optaTextMuted)
                        .tracking(2)
                }
                
                Spacer()
                
                if !tasks.isEmpty {
                    Text("\(tasks.count)")
                        .font(.caption.bold().monospacedDigit())
                        .foregroundColor(.optaNeonGreen)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.optaNeonGreen.opacity(0.15))
                        .cornerRadius(8)
                }
            }
            
            if isLoading {
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { _ in
                        TaskRowSkeleton()
                    }
                }
            } else if tasks.isEmpty {
                EmptyStateView(
                    icon: "checkmark.circle",
                    title: "All clear!",
                    subtitle: "No tasks for today"
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            } else {
                VStack(spacing: 8) {
                    ForEach(tasks.prefix(5)) { task in
                        TaskRowCompact(task: task)
                            .transition(.asymmetric(
                                insertion: .move(edge: .leading).combined(with: .opacity),
                                removal: .move(edge: .trailing).combined(with: .opacity)
                            ))
                            .staggeredAppear(index: 0)
                    }
                    
                    if tasks.count > 5 {
                        HStack {
                            Spacer()
                            Text("+\(tasks.count - 5) more tasks")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundColor(.optaTextMuted)
                            Spacer()
                        }
                        .padding(.top, 4)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

struct TaskRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .stroke(Color.optaGlassBorder, lineWidth: 2)
                .frame(width: 20, height: 20)
            
            VStack(alignment: .leading, spacing: 4) {
                SkeletonView(width: 160, height: 14)
                SkeletonView(width: 80, height: 10)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct TaskRowCompact: View {
    let task: OptaTask
    
    var body: some View {
        HStack(spacing: 12) {
            // Priority indicator
            Circle()
                .stroke(priorityColor, lineWidth: 2)
                .frame(width: 20, height: 20)
                .overlay(
                    task.priority == .urgent ?
                    Circle()
                        .fill(priorityColor.opacity(0.3))
                        .frame(width: 10, height: 10)
                    : nil
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(task.content)
                    .font(.subheadline)
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    // Source badge (Opta512 indicator)
                    if task.labels.contains("opta512") {
                        HStack(spacing: 3) {
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 8))
                            Text("512")
                                .font(.system(size: 9, weight: .semibold))
                        }
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.optaPrimary.opacity(0.15))
                        .cornerRadius(6)
                    }
                    
                    if let due = task.due {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.system(size: 9))
                            Text(due.string)
                                .font(.caption)
                        }
                        .foregroundColor(isDueSoon ? .optaNeonAmber : .optaTextMuted)
                    }
                    
                    // Show other labels (non-opta512)
                    if let firstNonOpta512Label = task.labels.first(where: { $0 != "opta512" }) {
                        TagPill(text: firstNonOpta512Label, color: .optaNeonBlue)
                    }
                }
            }
            
            Spacer()
            
            if task.priority == .urgent || task.priority == .high {
                Image(systemName: "flag.fill")
                    .font(.caption)
                    .foregroundColor(priorityColor)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var priorityColor: Color {
        switch task.priority {
        case .urgent: return .optaNeonRed
        case .high: return .optaNeonAmber
        case .medium: return .optaNeonBlue
        case .normal: return .optaTextMuted
        }
    }
    
    private var isDueSoon: Bool {
        guard let date = task.due?.displayDate else { return false }
        return date.timeIntervalSinceNow < 3600 && date.timeIntervalSinceNow > 0
    }
}

// MARK: - Calendar Card

struct CalendarCard: View {
    let events: [CalendarEvent]
    var isLoading: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "calendar")
                        .font(.caption)
                        .foregroundColor(.optaNeonBlue)
                    
                    Text("SCHEDULE")
                        .font(.caption.bold())
                        .foregroundColor(.optaTextMuted)
                        .tracking(2)
                }
                
                Spacer()
            }
            
            if isLoading {
                VStack(spacing: 8) {
                    ForEach(0..<2, id: \.self) { _ in
                        HStack(spacing: 10) {
                            Circle()
                                .fill(Color.optaGlassBackground)
                                .frame(width: 6, height: 6)
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonView(width: 80, height: 12)
                                SkeletonView(width: 50, height: 10)
                            }
                            Spacer()
                        }
                    }
                }
            } else if events.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar")
                        .font(.title2)
                        .foregroundColor(.optaTextMuted)
                    
                    Text("Timeline clear")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(events.prefix(3).enumerated()), id: \.element.id) { index, event in
                        EventRowCompact(event: event)
                            .staggeredAppear(index: index)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

struct EventRowCompact: View {
    let event: CalendarEvent
    
    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(sourceColor)
                .frame(width: 6, height: 6)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(event.summary)
                    .font(.caption)
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
                
                HStack(spacing: 6) {
                    // Source badge (Opta512 indicator)
                    if true {
                        HStack(spacing: 2) {
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 7))
                            Text("512")
                                .font(.system(size: 8, weight: .semibold))
                        }
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(Color.optaPrimary.opacity(0.15))
                        .cornerRadius(4)
                    }
                    
                    if event.startDate?.isToday ?? false {
                        Text(event.displayTime)
                            .font(.caption2)
                            .foregroundColor(sourceColor)
                            .fontDesign(.monospaced)
                    } else {
                        Text(event.displayDate)
                            .font(.caption2)
                            .foregroundColor(.optaTextMuted)
                    }
                    
                    // Countdown for upcoming events
                    if let start = event.startDate, start.timeIntervalSinceNow > 0 && start.timeIntervalSinceNow < 3600 {
                        CountdownView(targetDate: start)
                    }
                }
            }
            
            Spacer()
        }
    }
    
    private var sourceColor: Color {
        .optaNeonBlue
    }
}

// MARK: - Email Card

struct EmailCard: View {
    let emails: [Email]
    var isLoading: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "envelope")
                        .font(.caption)
                        .foregroundColor(.optaNeonAmber)
                    
                    Text("INBOX")
                        .font(.caption.bold())
                        .foregroundColor(.optaTextMuted)
                        .tracking(2)
                }
                
                Spacer()
                
                if !emails.isEmpty {
                    Text("\(emails.count)")
                        .font(.caption.bold().monospacedDigit())
                        .foregroundColor(.optaNeonAmber)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.optaNeonAmber.opacity(0.15))
                        .cornerRadius(8)
                }
            }
            
            if isLoading {
                VStack(spacing: 8) {
                    ForEach(0..<2, id: \.self) { _ in
                        HStack(spacing: 10) {
                            Circle()
                                .fill(Color.optaGlassBackground)
                                .frame(width: 6, height: 6)
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonView(width: 90, height: 12)
                                SkeletonView(width: 60, height: 10)
                            }
                            Spacer()
                        }
                    }
                }
            } else if emails.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "envelope.open")
                        .font(.title2)
                        .foregroundColor(.optaTextMuted)
                    
                    Text("Inbox zero! 🎉")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(emails.prefix(3).enumerated()), id: \.element.id) { index, email in
                        EmailRowCompact(email: email)
                            .staggeredAppear(index: index)
                    }
                }
            }
        }
        .padding()
        .glassPanel()
    }
}

struct EmailRowCompact: View {
    let email: Email
    
    var body: some View {
        HStack(spacing: 10) {
            // Sender avatar
            Circle()
                .fill(Color.optaNeonAmber.opacity(0.2))
                .frame(width: 24, height: 24)
                .overlay(
                    Text(email.from.initials)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.optaNeonAmber)
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(email.subject)
                    .font(.caption)
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(1)
                
                Text(email.from.displayName)
                    .font(.caption2)
                    .foregroundColor(.optaTextMuted)
            }
            
            Spacer()
            
            if !email.displayDate.isEmpty {
                Text(email.displayDate)
                    .font(.system(size: 9))
                    .foregroundColor(.optaTextMuted)
            }
        }
    }
}

// MARK: - Briefing Card (Full)

struct BriefingCard: View {
    let briefing: Briefing?
    var isLoading: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.optaPrimary)
                
                Text("OPTA BRIEFING")
                    .font(.caption.bold())
                    .foregroundColor(.optaTextMuted)
                    .tracking(2)
                
                Spacer()
                
                Circle()
                    .fill(Color.optaPrimary)
                    .frame(width: 8, height: 8)
            }
            
            if isLoading {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonView(width: 180, height: 18)
                    SkeletonView(width: 250, height: 14)
                    SkeletonView(width: 200, height: 14)
                }
            } else if let briefing = briefing {
                // Greeting
                Text("Good \(briefing.greeting), Matthew")
                    .font(.headline)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, .optaPrimaryGlow],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                
                // Summary
                Text(briefing.summary)
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
                
                // Stats
                HStack(spacing: 20) {
                    StatBadge(
                        icon: "checkmark.circle",
                        value: "\(briefing.stats.tasksToday)",
                        label: "Tasks",
                        color: .optaNeonGreen
                    )
                    
                    StatBadge(
                        icon: "calendar",
                        value: "\(briefing.stats.upcomingEvents)",
                        label: "Events",
                        color: .optaNeonBlue
                    )
                    
                    StatBadge(
                        icon: "envelope",
                        value: "\(briefing.stats.unreadEmails)",
                        label: "Unread",
                        color: .optaNeonAmber
                    )
                }
            } else {
                Text("Tap to load briefing")
                    .font(.subheadline)
                    .foregroundColor(.optaTextMuted)
            }
        }
        .padding()
        .glassPanel()
    }
}

struct StatBadge: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundColor(.optaTextMuted)

                Text(label.uppercased())
                    .font(.system(size: 8, weight: .medium))
                    .foregroundColor(.optaTextMuted)
                    .tracking(1)
            }

            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.optaGlassBackground)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.optaGlassBorder, lineWidth: 1)
        )
    }
}

// MARK: - Health Card (temporarily disabled - HealthService excluded from build)
/*
struct HealthCard: View {
    let sleepData: SleepData?
    let activityData: ActivityData?
    var isLoading: Bool = false
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button {
            HapticManager.shared.impact(.light)
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "heart.text.square")
                            .font(.caption)
                            .foregroundColor(.optaNeonCyan)

                        Text("HEALTH")
                            .font(.caption.bold())
                            .foregroundColor(.optaTextMuted)
                            .tracking(2)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundColor(.optaTextMuted)
                }

                if isLoading {
                    VStack(spacing: 8) {
                        SkeletonView(width: 120, height: 16)
                        SkeletonView(width: 80, height: 12)
                    }
                } else if let sleepData = sleepData, let activityData = activityData {
                    // Sleep Quality
                    HStack(spacing: 8) {
                        Text(sleepData.qualityEmoji)
                            .font(.title2)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(String(format: "%.1f hours", sleepData.totalHours))
                                .font(.subheadline.bold())
                                .foregroundColor(.optaTextPrimary)

                            Text("\(sleepData.quality.displayName) sleep")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }

                        Spacer()
                    }

                    Divider()
                        .background(Color.optaGlassBorder)
                        .padding(.vertical, 4)

                    // Activity Summary
                    HStack(spacing: 16) {
                        VStack(spacing: 4) {
                            Text("\(activityData.steps.formatted())")
                                .font(.caption.bold().monospacedDigit())
                                .foregroundColor(.optaNeonGreen)

                            Text("Steps")
                                .font(.caption2)
                                .foregroundColor(.optaTextMuted)
                        }

                        VStack(spacing: 4) {
                            Text("\(Int(activityData.activeEnergyBurned))")
                                .font(.caption.bold().monospacedDigit())
                                .foregroundColor(.optaNeonAmber)

                            Text("kcal")
                                .font(.caption2)
                                .foregroundColor(.optaTextMuted)
                        }

                        Spacer()

                        Text(activityData.activityLevel.emoji)
                            .font(.title3)
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "heart.text.square")
                            .font(.title2)
                            .foregroundColor(.optaTextMuted)

                        Text("Tap to connect")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
            }
            .padding()
            .glassPanel()
        }
        .buttonStyle(PlainButtonStyle())
    }
}
*/

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            TasksCard(tasks: [], isLoading: true)
            
            HStack(spacing: 16) {
                CalendarCard(events: [], isLoading: false)
                EmailCard(emails: [], isLoading: false)
            }
        }
        .padding()
    }
    .background(Color.optaVoid)
}
