import SwiftUI

struct CalendarListView: View {
    @StateObject private var viewModel = CalendarListViewModel()
    @State private var showAddEvent = false
    @State private var selectedRange: CalendarRange = .today
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Range Selector
                    rangeSelector
                    
                    // Events List
                    if viewModel.isLoading {
                        Spacer()
                        ProgressView()
                            .tint(.optaPrimary)
                        Spacer()
                    } else if viewModel.events.isEmpty {
                        emptyState
                    } else {
                        eventsList
                    }
                }
            }
            .navigationTitle("Schedule")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddEvent = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.optaPrimary)
                    }
                }
            }
            .sheet(isPresented: $showAddEvent) {
                AddEventSheet { summary, startTime, endTime in
                    Task {
                        await viewModel.createEvent(
                            summary: summary,
                            startTime: startTime,
                            endTime: endTime
                        )
                    }
                }
                .presentationDetents([.medium])
            }
            .refreshable {
                await viewModel.loadEvents(range: selectedRange)
            }
            .onChange(of: selectedRange) { _, newValue in
                Task {
                    await viewModel.loadEvents(range: newValue)
                }
            }
        }
        .task {
            await viewModel.loadEvents(range: selectedRange)
        }
    }
    
    // MARK: - Range Selector
    
    private var rangeSelector: some View {
        HStack(spacing: 12) {
            ForEach(CalendarRange.allCases, id: \.self) { range in
                Button {
                    withAnimation(.optaSpring) {
                        selectedRange = range
                    }
                } label: {
                    Text(range.title)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            selectedRange == range
                                ? Color.optaNeonBlue.opacity(0.2)
                                : Color.optaGlassBackground
                        )
                        .foregroundColor(
                            selectedRange == range
                                ? .optaNeonBlue
                                : .optaTextSecondary
                        )
                        .cornerRadius(12)
                }
            }
            
            Spacer()
        }
        .padding()
    }
    
    // MARK: - Events List
    
    private var eventsList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(viewModel.events) { event in
                    EventRow(event: event) {
                        Task {
                            await viewModel.deleteEvent(eventId: event.id)
                        }
                    }
                }
            }
            .padding()
        }
    }
    
    // MARK: - Empty State
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            
            Image(systemName: "calendar")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)
            
            Text("Timeline clear")
                .font(.headline)
                .foregroundColor(.optaTextSecondary)
            
            Text("Tap + to add a new event")
                .font(.caption)
                .foregroundColor(.optaTextMuted)
            
            Spacer()
        }
    }
}

// MARK: - Event Row

struct EventRow: View {
    let event: CalendarEvent
    let onDelete: () -> Void
    
    @State private var showActions = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Time indicator
            VStack(alignment: .trailing, spacing: 2) {
                if event.isAllDay {
                    Text("All Day")
                        .font(.caption2)
                        .foregroundColor(.optaNeonBlue)
                } else if let date = event.startDate {
                    Text(date.timeString)
                        .font(.subheadline.bold().monospacedDigit())
                        .foregroundColor(.optaTextPrimary)
                    
                    if date.isToday {
                        Text("Today")
                            .font(.caption2)
                            .foregroundColor(.optaNeonBlue)
                    } else if date.isTomorrow {
                        Text("Tomorrow")
                            .font(.caption2)
                            .foregroundColor(.optaNeonCyan)
                    } else {
                        Text(date.shortDateString)
                            .font(.caption2)
                            .foregroundColor(.optaTextMuted)
                    }
                }
            }
            .frame(width: 70, alignment: .trailing)
            
            // Divider
            Rectangle()
                .fill(Color.optaNeonBlue)
                .frame(width: 3)
                .cornerRadius(1.5)
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(event.summary)
                    .font(.subheadline)
                    .foregroundColor(.optaTextPrimary)
                
                if let location = event.location, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "location")
                            .font(.caption2)
                        Text(location)
                            .font(.caption)
                    }
                    .foregroundColor(.optaTextMuted)
                }
                
                if let description = event.description, !description.isEmpty {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(2)
                }
            }
            
            Spacer()
            
            // Actions
            Menu {
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Label("Delete", systemImage: "trash")
                }
                
                if let link = event.htmlLink, let url = URL(string: link) {
                    Link(destination: url) {
                        Label("Open in Calendar", systemImage: "calendar")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundColor(.optaTextMuted)
                    .padding(8)
            }
        }
        .padding()
        .background(Color.optaGlassBackground)
        .glassPanel(cornerRadius: 12)
    }
}

// MARK: - Add Event Sheet

struct AddEventSheet: View {
    @Environment(\.dismiss) var dismiss
    
    let onAdd: (String, String, String?) -> Void
    
    @State private var summary = ""
    @State private var startDate = Date()
    @State private var endDate = Date().addingTimeInterval(3600)
    @State private var isAllDay = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                VStack(spacing: 20) {
                    // Summary field
                    TextField("Event Title", text: $summary)
                        .textFieldStyle(.plain)
                        .font(.headline)
                        .padding()
                        .background(Color.optaGlassBackground)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.optaPrimary.opacity(0.5), lineWidth: 1)
                        )
                    
                    // All day toggle
                    Toggle(isOn: $isAllDay) {
                        Text("All Day")
                            .foregroundColor(.optaTextSecondary)
                    }
                    .tint(.optaPrimary)
                    
                    // Start time
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Start")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                        
                        DatePicker(
                            "",
                            selection: $startDate,
                            displayedComponents: isAllDay ? .date : [.date, .hourAndMinute]
                        )
                        .datePickerStyle(.compact)
                        .labelsHidden()
                        .tint(.optaPrimary)
                    }
                    
                    if !isAllDay {
                        // End time
                        VStack(alignment: .leading, spacing: 8) {
                            Text("End")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                            
                            DatePicker(
                                "",
                                selection: $endDate,
                                displayedComponents: [.date, .hourAndMinute]
                            )
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .tint(.optaPrimary)
                        }
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Add Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.optaTextSecondary)
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add") {
                        let formatter = ISO8601DateFormatter()
                        let startString = formatter.string(from: startDate)
                        let endString = isAllDay ? nil : formatter.string(from: endDate)
                        onAdd(summary, startString, endString)
                        dismiss()
                    }
                    .disabled(summary.trimmingCharacters(in: .whitespaces).isEmpty)
                    .foregroundColor(.optaPrimary)
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

enum CalendarRange: CaseIterable {
    case today, week, month
    
    var title: String {
        switch self {
        case .today: return "Today"
        case .week: return "Week"
        case .month: return "Month"
        }
    }
    
    var apiValue: String {
        switch self {
        case .today: return "today"
        case .week: return "week"
        case .month: return "month"
        }
    }
}

// MARK: - View Model

@MainActor
class CalendarListViewModel: ObservableObject {
    @Published var events: [CalendarEvent] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let api = APIService.shared
    
    func loadEvents(range: CalendarRange) async {
        isLoading = true
        defer { isLoading = false }

        do {
            events = try await api.fetchCalendarEvents(range: range.apiValue)

            // Schedule notification reminders for upcoming events
            for event in events {
                await MainActor.run {
                    NotificationManager.shared.scheduleEventReminder(for: event)
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func createEvent(summary: String, startTime: String, endTime: String?) async {
        do {
            try await api.createCalendarEvent(
                summary: summary,
                startTime: startTime,
                endTime: endTime
            )
            // Refresh list
            await loadEvents(range: .today)
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func deleteEvent(eventId: String) async {
        do {
            try await api.deleteCalendarEvent(eventId: eventId)
            // Optimistically remove from list
            events.removeAll { $0.id == eventId }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    CalendarListView()
}
