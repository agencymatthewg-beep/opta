#!/usr/bin/env ruby
require 'xcodeproj'

project_path = 'OptaLMiOS.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.first

# New files to add
new_files = [
  # Models
  'OptaLMiOS/Models/EventSource.swift',
  'OptaLMiOS/Models/TodoistModels.swift',
  'OptaLMiOS/Models/SyncState.swift',
  'OptaLMiOS/Models/HealthModels.swift',

  # Services
  'OptaLMiOS/Services/EventKitService.swift',
  'OptaLMiOS/Services/CalendarSyncService.swift',
  'OptaLMiOS/Services/RemindersSyncService.swift',
  'OptaLMiOS/Services/HealthService.swift',
  'OptaLMiOS/Services/TodoistService.swift',
  'OptaLMiOS/Services/TaskSyncCoordinator.swift',
  'OptaLMiOS/Services/TaskCacheManager.swift',
  'OptaLMiOS/Services/BackgroundSyncManager.swift',

  # Extensions
  'OptaLMiOS/Extensions/Date+Extensions.swift',

  # Views
  'OptaLMiOS/Views/Settings/IntegrationsView.swift',
  'OptaLMiOS/Views/Settings/TodoistAuthSheet.swift',
  'OptaLMiOS/Views/Settings/CalendarSyncSettings.swift',
  'OptaLMiOS/Views/Settings/HealthInsightsView.swift',
  'OptaLMiOS/Views/Settings/SyncStatusView.swift',

  # Intents - Calendar
  'OptaLMiOS/Intents/Calendar/ViewUnifiedCalendarIntent.swift',
  'OptaLMiOS/Intents/Calendar/AddToAppleCalendarIntent.swift',
  'OptaLMiOS/Intents/Calendar/CreateInBothCalendarsIntent.swift',
  'OptaLMiOS/Intents/Calendar/SyncCalendarsIntent.swift',

  # Intents - Reminders
  'OptaLMiOS/Intents/Reminders/ViewRemindersIntent.swift',
  'OptaLMiOS/Intents/Reminders/AddToRemindersIntent.swift',
  'OptaLMiOS/Intents/Reminders/CompleteReminderIntent.swift',
  'OptaLMiOS/Intents/Reminders/ImportRemindersToOptaIntent.swift',

  # Intents - Health
  'OptaLMiOS/Intents/Health/GetSleepInsightIntent.swift',
  'OptaLMiOS/Intents/Health/GetActivityInsightIntent.swift',
  'OptaLMiOS/Intents/Health/GetProductivityCorrelationIntent.swift',
  'OptaLMiOS/Intents/Health/LogWorkoutIntent.swift',

  # Intents - Tasks
  'OptaLMiOS/Intents/Tasks/GetUnifiedTodoListIntent.swift',
  'OptaLMiOS/Intents/Tasks/AddToTodoistIntent.swift',
  'OptaLMiOS/Intents/Tasks/SyncTodoistIntent.swift',

  # Intents - Smart
  'OptaLMiOS/Intents/Smart/SmartEventSuggestionsIntent.swift',
  'OptaLMiOS/Intents/Smart/SmartTimeBlockingIntent.swift',
  'OptaLMiOS/Intents/Smart/OptimizeDayIntent.swift'
]

puts "Adding #{new_files.length} files to #{project_path}..."

added_count = 0
skipped_count = 0

new_files.each do |file_path|
  # Check if file exists
  unless File.exist?(file_path)
    puts "⚠️  File not found: #{file_path}"
    next
  end

  # Check if already in project
  existing_file = project.files.find { |f| f.path == file_path }
  if existing_file
    puts "⏭️  Already in project: #{file_path}"
    skipped_count += 1
    next
  end

  # Add file to project
  file_ref = project.new_file(file_path)
  target.add_file_references([file_ref])
  puts "✅ Added: #{file_path}"
  added_count += 1
end

# Save project
project.save

puts "\n✨ Done! Added #{added_count} files, skipped #{skipped_count} files."
puts "Please build the project again."
