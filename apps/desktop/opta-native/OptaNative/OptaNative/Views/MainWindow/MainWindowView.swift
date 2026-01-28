//
//  MainWindowView.swift
//  OptaNative
//
//  Main Dashboard view with Premium "Void" Aesthetic.
//  Matching the 'Opta Life Manager' reference design.
//  Created for Opta Native macOS - Plan 101-01 (v12.0)
//

import SwiftUI

struct MainWindowView: View {
    @Environment(TelemetryViewModel.self) private var telemetry
    
    // Quick Actions
    let quickActions = [
        ("New Task", "plus"),
        ("Schedule", "calendar"),
        ("Email", "envelope"),
        ("More", "ellipsis")
    ]
    
    var body: some View {
        // Dashboard Content
        VStack(spacing: 24) {

            // Header (Simplified)
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Dashboard")
                        .font(.opta(size: 32, weight: .bold))
                        .foregroundStyle(.white)
                    Text(Date().formatted(date: .complete, time: .omitted))
                        .font(.opta(size: 15))
                        .foregroundStyle(Color.optaTextSecondary)
                }
                Spacer()
            }
            .padding(.horizontal)

            ScrollView {
                VStack(spacing: 24) {
                    // Today's Focus
                    VStack(alignment: .leading, spacing: 20) {
                        HStack {
                            Text("Today's Focus")
                                .font(.opta(size: 20, weight: .bold))
                                .foregroundStyle(Color.optaTextPrimary)
                            Spacer()
                            Button("+ ADD TASK") {}
                                .font(.opta(size: 11, weight: .medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.optaNeonPurple.opacity(0.1))
                                .foregroundStyle(Color.optaNeonPurple)
                                .cornerRadius(4)
                        }

                        // Mock Tasks
                        TaskRow(title: "Review Project Opta Plan", time: "10:00 AM", tag: "PLANNING", isCompleted: true)
                        TaskRow(title: "Implement Dark Mode Aesthetics", time: "Now", tag: "DEV", isCompleted: false)
                    }
                    .glassPanel()

                    // Split Widgets
                    HStack(spacing: 24) {
                        // Inbox
                        VStack(alignment: .leading, spacing: 16) {
                            WidgetHeader(title: "INBOX", color: .optaNeonAmber)
                            VStack(alignment: .leading, spacing: 12) {
                                InboxItem(sender: "Apple Support", subject: "Your receipt from...", time: "2m ago")
                                InboxItem(sender: "Linear", subject: "New issue assigned", time: "15m ago")
                                InboxItem(sender: "Claude", subject: "Thinking process complete", time: "1h ago")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .glassPanel()

                        // Schedule
                        VStack(alignment: .leading, spacing: 16) {
                            WidgetHeader(title: "SCHEDULE", color: .optaElectricBlue)
                            Text("Connection Interrupted")
                                .font(.subheadline)
                                .foregroundStyle(Color.optaTextMuted)
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .glassPanel()
                    }
                }
                .padding()
            }
        }
        .optaBackground()
    }
}

// MARK: - Subviews

struct TaskRow: View {
    let title: String
    let time: String
    let tag: String
    let isCompleted: Bool
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(isCompleted ? Color.optaNeonPurple : Color.optaTextMuted)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.opta(size: 15, weight: .medium))
                    .foregroundStyle(isCompleted ? Color.optaTextMuted : Color.optaTextPrimary)
                    .strikethrough(isCompleted)
                
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(time)
                        .font(.opta(size: 12))
                }
                .foregroundStyle(Color.optaTextMuted)
            }
            
            Spacer()
            
            Text(tag)
                .font(.opta(size: 10, weight: .bold))
                .foregroundStyle(Color.optaTextSecondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.05))
                .cornerRadius(4)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isCompleted ? Color.clear : Color.white.opacity(0.03))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(isCompleted ? Color.clear : Color.optaNeonPurple.opacity(0.3), lineWidth: isCompleted ? 0 : 1)
        )
    }
}

struct WidgetHeader: View {
    let title: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(Color.optaTextMuted)
                .tracking(1.5)
            Spacer()
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
                .shadow(color: color.opacity(0.5), radius: 4)
        }
    }
}

struct InboxItem: View {
    let sender: String
    let subject: String
    let time: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(Color.optaNeonAmber)
                .frame(width: 4, height: 4)
                .padding(.top, 6)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(sender)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.optaTextPrimary)
                    Spacer()
                    Text(time)
                        .font(.caption2)
                        .foregroundStyle(Color.optaTextMuted)
                }
                Text(subject)
                    .font(.caption)
                    .foregroundStyle(Color.optaTextSecondary)
                    .lineLimit(1)
            }
        }
    }
}

#Preview {
    MainWindowView()
        .frame(width: 1280, height: 800)
}
