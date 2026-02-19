//
//  ChatExportSheet.swift
//  OptaPlusIOS
//
//  Export conversation as Markdown, JSON, or plain text via share sheet.
//  Uses ChatExporter from OptaMolt shared module.
//

import SwiftUI
import OptaMolt

// MARK: - Export Sheet

struct ChatExportSheet: View {
    let messages: [ChatMessage]
    let botName: String
    @Environment(\.dismiss) private var dismiss
    @State private var selectedFormat: ChatExportFormat = .markdown
    @State private var showShareSheet = false
    @State private var exportURL: URL?
    @State private var previewText: String = ""
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Format picker
                Picker("Format", selection: $selectedFormat) {
                    ForEach(ChatExportFormat.allCases, id: \.self) { format in
                        Text(format.label).tag(format)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                
                // Stats
                HStack(spacing: 16) {
                    Label("\(messages.count) messages", systemImage: "bubble.left.and.bubble.right")
                    if let first = messages.first, let last = messages.last {
                        Label(dateRange(from: first.timestamp, to: last.timestamp), systemImage: "calendar")
                    }
                }
                .font(.system(size: 12))
                .foregroundStyle(Color.optaTextSecondary)
                .padding(.top, 10)
                
                // Preview
                ScrollView {
                    Text(previewText)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Color.optaTextPrimary)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color.optaSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(16)
                
                Spacer()
                
                // Export button
                Button(action: exportAndShare) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Export \(selectedFormat.label)")
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.optaPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .background(Color.optaVoid)
            .navigationTitle("Export Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.optaPrimary)
                }
            }
            .onChange(of: selectedFormat) { _, _ in updatePreview() }
            .onAppear { updatePreview() }
            .sheet(isPresented: $showShareSheet) {
                if let url = exportURL {
                    ShareSheet(activityItems: [url])
                }
            }
        }
    }
    
    private func updatePreview() {
        let full = ChatExporter.export(messages: messages, botName: botName, format: selectedFormat)
        // Show first 2000 chars as preview
        if full.count > 2000 {
            previewText = String(full.prefix(2000)) + "\n\n… (\(full.count) characters total)"
        } else {
            previewText = full
        }
    }
    
    private func exportAndShare() {
        HapticManager.shared.medium()
        exportURL = ChatExporter.temporaryFileURL(messages: messages, botName: botName, format: selectedFormat)
        if exportURL != nil {
            showShareSheet = true
        }
    }
    
    private func dateRange(from start: Date, to end: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        if Calendar.current.isDate(start, inSameDayAs: end) {
            return formatter.string(from: start)
        }
        return "\(formatter.string(from: start)) – \(formatter.string(from: end))"
    }
}

// ShareSheet is defined in ChatView.swift
