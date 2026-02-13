//
//  SessionViews.swift
//  OptaPlusMacOS
//
//  Session drawer, session rows, new session sheet.
//  Extracted from ContentView.swift for maintainability.
//

import SwiftUI
import OptaMolt

// MARK: - Session Drawer

struct SessionDrawerView: View {
    @ObservedObject var viewModel: ChatViewModel
    @State private var showingNewSession = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Drawer header
            HStack {
                Text("SESSIONS")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
                
                Spacer()
                
                Button(action: { showingNewSession = true }) {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 14))
                        .foregroundColor(.optaTextSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            
            Divider()
                .background(Color.optaBorder)
            
            // Session list
            ScrollView {
                LazyVStack(spacing: 2) {
                    // Pinned sessions first
                    ForEach(viewModel.sessions.filter(\.isPinned)) { session in
                        SessionRow(
                            session: session,
                            isActive: viewModel.activeSession?.id == session.id,
                            onTap: { viewModel.switchSession(session) },
                            onDelete: { viewModel.deleteSession(session) },
                            onTogglePin: { viewModel.togglePin(session) }
                        )
                    }
                    
                    // Unpinned sessions
                    ForEach(viewModel.sessions.filter { !$0.isPinned }) { session in
                        SessionRow(
                            session: session,
                            isActive: viewModel.activeSession?.id == session.id,
                            onTap: { viewModel.switchSession(session) },
                            onDelete: { viewModel.deleteSession(session) },
                            onTogglePin: { viewModel.togglePin(session) }
                        )
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            }
            
            Spacer()
        }
        .background(
            ZStack {
                Color.optaSurface.opacity(0.4)
                    .background(.ultraThinMaterial)
                // Subtle top highlight
                VStack {
                    LinearGradient(
                        colors: [Color.white.opacity(0.03), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 1)
                    Spacer()
                }
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 0))
        .sheet(isPresented: $showingNewSession) {
            NewSessionSheet(viewModel: viewModel)
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let session: ChatSession
    let isActive: Bool
    let onTap: () -> Void
    let onDelete: () -> Void
    let onTogglePin: () -> Void
    
    @State private var isHovering = false
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 8) {
                // Mode icon
                Image(systemName: session.mode.icon)
                    .font(.system(size: 11))
                    .foregroundColor(sessionModeColor(session.mode))
                    .frame(width: 16)
                
                VStack(alignment: .leading, spacing: 1) {
                    Text(session.name)
                        .font(.system(size: 12, weight: isActive ? .semibold : .regular))
                        .foregroundColor(isActive ? .optaTextPrimary : .optaTextSecondary)
                        .lineLimit(1)
                    
                    Text(session.mode.label)
                        .font(.system(size: 9))
                        .foregroundColor(.optaTextMuted)
                }
                
                Spacer()
                
                if session.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: 8))
                        .foregroundColor(.optaTextMuted)
                        .rotationEffect(.degrees(45))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isActive ? Color.optaPrimary.opacity(0.15) : (isHovering ? Color.optaSurface.opacity(0.5) : Color.clear))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isActive ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .contextMenu {
            Button(action: onTogglePin) {
                Label(session.isPinned ? "Unpin" : "Pin", systemImage: session.isPinned ? "pin.slash" : "pin")
            }
            
            Divider()
            
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

// MARK: - New Session Sheet

struct NewSessionSheet: View {
    @ObservedObject var viewModel: ChatViewModel
    @Environment(\.dismiss) var dismiss
    
    @State private var name = ""
    @State private var selectedMode: SessionMode = .direct
    
    var body: some View {
        VStack(spacing: 20) {
            Text("New Session")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.optaTextPrimary)
            
            // Name field
            LabeledField("Name", text: $name, placeholder: "e.g., Research, Coding, Quick Chat")
            
            // Mode picker
            VStack(alignment: .leading, spacing: 8) {
                Text("Mode")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.optaTextMuted)
                
                ForEach(SessionMode.allCases, id: \.self) { mode in
                    SessionModeOption(
                        mode: mode,
                        isSelected: selectedMode == mode,
                        onTap: { selectedMode = mode }
                    )
                }
            }
            
            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Create") {
                    let session = viewModel.createSession(
                        name: name.isEmpty ? selectedMode.label : name,
                        mode: selectedMode
                    )
                    viewModel.switchSession(session)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
                .tint(.optaPrimary)
            }
        }
        .padding(24)
        .frame(width: 360)
        .background(
            ZStack {
                Color.optaSurface.opacity(0.7)
                    .background(.ultraThinMaterial)
                Color.optaPrimary.opacity(0.02)
            }
        )
        .preferredColorScheme(.dark)
    }
}

// MARK: - Session Mode Option

struct SessionModeOption: View {
    let mode: SessionMode
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: mode.icon)
                    .font(.system(size: 14))
                    .foregroundColor(sessionModeColor(mode))
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.optaTextPrimary)
                    
                    Text(mode.description)
                        .font(.system(size: 11))
                        .foregroundColor(.optaTextMuted)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.optaPrimary)
                        .font(.system(size: 16))
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.optaPrimary.opacity(0.1) : Color.optaElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? Color.optaPrimary.opacity(0.4) : Color.optaBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Color Helpers

func sessionModeColor(_ mode: SessionMode) -> Color {
    switch mode {
    case .synced: return .optaBlue
    case .direct: return .optaGreen
    case .isolated: return .optaPrimary
    }
}
