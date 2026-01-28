import SwiftUI

struct OptaChatView: View {
    @StateObject private var viewModel = OptaChatViewModel()
    @FocusState private var isInputFocused: Bool
    @State private var showClearConfirmation = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color.optaVoid
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Messages
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 16) {
                                // Welcome message with suggestions
                                if viewModel.messages.count == 1 {
                                    WelcomeSuggestions(onSelect: viewModel.sendQuickAction)
                                        .padding(.bottom, 20)
                                }
                                
                                ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
                                    AnimatedMessageBubble(message: message, index: index)
                                        .id(message.id)
                                        .transition(.asymmetric(
                                            insertion: .scale(scale: 0.9).combined(with: .opacity),
                                            removal: .opacity
                                        ))
                                }
                                
                                if viewModel.isProcessing {
                                    EnhancedTypingIndicator()
                                        .transition(.scale.combined(with: .opacity))
                                }
                            }
                            .padding()
                            .animation(.spring(response: 0.3), value: viewModel.messages.count)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .onChange(of: viewModel.messages.count) { _, _ in
                            if let lastMessage = viewModel.messages.last {
                                withAnimation(.spring(response: 0.3)) {
                                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                                }
                            }
                        }
                    }
                    
                    // Quick Actions (context-aware)
                    if !isInputFocused && viewModel.inputText.isEmpty {
                        QuickActionsBar(onAction: viewModel.sendQuickAction)
                            .padding(.horizontal)
                            .padding(.bottom, 8)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                    
                    // Input
                    chatInputBar
                }
            }
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color.optaPrimary)
                            .frame(width: 8, height: 8)
                            .optaGlow(.optaPrimary, radius: 4)
                        
                        Text("OPTA CHAT")
                            .font(.caption.bold())
                            .foregroundColor(.optaTextSecondary)
                            .tracking(2)
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            showClearConfirmation = true
                        } label: {
                            Label("Clear Chat", systemImage: "trash")
                        }
                        
                        Button {
                            viewModel.exportChat()
                        } label: {
                            Label("Export Chat", systemImage: "square.and.arrow.up")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.optaTextSecondary)
                    }
                }
            }
            .alert("Clear Chat?", isPresented: $showClearConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    viewModel.clearChat()
                }
            } message: {
                Text("This will remove all messages from this conversation.")
            }
        }
    }
    
    private var chatInputBar: some View {
        HStack(spacing: 12) {
            // Voice input button
            Button {
                HapticManager.shared.impact(.light)
                // TODO: Implement voice input
            } label: {
                Image(systemName: "mic.fill")
                    .font(.subheadline)
                    .foregroundColor(.optaTextMuted)
                    .padding(10)
            }
            
            // Text field
            HStack {
                TextField("Message Opta...", text: $viewModel.inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...4)
                    .foregroundColor(.white)
                    .focused($isInputFocused)
                    .onSubmit {
                        if !viewModel.inputText.isEmpty {
                            viewModel.sendMessage()
                        }
                    }
                
                // Clear button
                if !viewModel.inputText.isEmpty {
                    Button {
                        viewModel.inputText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(hex: "121214"))
            .cornerRadius(24)
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(isInputFocused ? Color.optaPrimary.opacity(0.5) : Color.optaGlassBorder, lineWidth: 1)
            )
            .animation(.easeInOut(duration: 0.2), value: isInputFocused)
            
            // Send button
            Button {
                HapticManager.shared.impact(.medium)
                viewModel.sendMessage()
            } label: {
                Image(systemName: viewModel.inputText.isEmpty ? "sparkle" : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(viewModel.inputText.isEmpty ? .optaTextMuted : .optaPrimary)
                    .contentTransition(.symbolEffect(.replace))
            }
            .disabled(viewModel.inputText.isEmpty || viewModel.isProcessing)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(
            Color.optaVoid
                .overlay(
                    Rectangle()
                        .fill(Color.optaGlassBorder)
                        .frame(height: 1),
                    alignment: .top
                )
        )
    }
}

// MARK: - Welcome Suggestions

struct WelcomeSuggestions: View {
    let onSelect: (String) -> Void
    
    let suggestions = [
        ("📋", "What's on my schedule today?"),
        ("✅", "Add a task: Buy groceries"),
        ("📅", "Schedule a meeting tomorrow at 3pm"),
        ("📧", "Do I have any urgent emails?"),
        ("🎯", "What should I focus on today?"),
        ("📊", "Give me my productivity summary")
    ]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Try asking...")
                .font(.caption)
                .foregroundColor(.optaTextMuted)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(suggestions, id: \.1) { emoji, text in
                    Button {
                        HapticManager.shared.selection()
                        onSelect(text)
                    } label: {
                        HStack(spacing: 8) {
                            Text(emoji)
                                .font(.caption)
                            
                            Text(text)
                                .font(.caption)
                                .foregroundColor(.optaTextSecondary)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                            
                            Spacer()
                        }
                        .padding(10)
                        .background(Color.optaGlassBackground)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.optaGlassBorder, lineWidth: 1)
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    @State private var showCopied = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == .assistant {
                // Bot avatar
                ZStack {
                    Circle()
                        .fill(Color.optaPrimary.opacity(0.2))
                        .frame(width: 32, height: 32)
                    
                    Image(systemName: "sparkle")
                        .font(.caption)
                        .foregroundColor(.optaPrimary)
                }
            }
            
            if message.role == .user {
                Spacer(minLength: 40)
            }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .font(.subheadline)
                    .foregroundColor(message.role == .user ? .white : .optaTextSecondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        message.role == .user
                            ? AnyShapeStyle(
                                LinearGradient(
                                    colors: [.optaPrimary, .optaPrimary.opacity(0.8)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                              )
                            : AnyShapeStyle(Color.optaGlassBackground)
                    )
                    .clipShape(
                        RoundedRectangle(
                            cornerRadius: 16,
                            style: .continuous
                        )
                    )
                    .overlay(
                        message.role == .assistant
                            ? RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.optaGlassBorder, lineWidth: 1)
                            : nil
                    )
                    .contextMenu {
                        Button {
                            UIPasteboard.general.string = message.text
                            showCopied = true
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                    }
                
                // Action indicator
                if let actionType = message.actionType {
                    ActionBadge(actionType: actionType)
                }
                
                // Timestamp
                Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }
            .frame(maxWidth: 280, alignment: message.role == .user ? .trailing : .leading)
            
            if message.role == .assistant {
                Spacer(minLength: 40)
            }
            
            if message.role == .user {
                // User avatar
                ZStack {
                    Circle()
                        .fill(Color.optaGlassBackground)
                        .frame(width: 32, height: 32)
                        .overlay(
                            Circle()
                                .stroke(Color.optaGlassBorder, lineWidth: 1)
                        )
                    
                    Image(systemName: "person.fill")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }
        }
        .overlay(
            Group {
                if showCopied {
                    SuccessToast(message: "Copied!")
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                withAnimation { showCopied = false }
                            }
                        }
                }
            },
            alignment: .top
        )
    }
}

struct ActionBadge: View {
    let actionType: String
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(label)
                .font(.caption2)
        }
        .foregroundColor(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color.opacity(0.15))
        .cornerRadius(12)
    }
    
    private var icon: String {
        switch actionType {
        case "CALENDAR": return "calendar.badge.checkmark"
        case "EMAIL": return "envelope.badge.fill"
        case "TASK": return "checkmark.circle.fill"
        case "SEARCH": return "magnifyingglass"
        default: return "sparkle"
        }
    }
    
    private var label: String {
        switch actionType {
        case "CALENDAR": return "Event Created"
        case "EMAIL": return "Draft Saved"
        case "TASK": return "Task Added"
        case "SEARCH": return "Searching..."
        default: return ""
        }
    }
    
    private var color: Color {
        switch actionType {
        case "CALENDAR": return .optaNeonBlue
        case "EMAIL": return .optaNeonGreen
        case "TASK": return .optaNeonAmber
        case "SEARCH": return .optaNeonCyan
        default: return .optaPrimary
        }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var dotIndex = 0
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.optaPrimary.opacity(0.2))
                    .frame(width: 32, height: 32)
                
                Image(systemName: "sparkle")
                    .font(.caption)
                    .foregroundColor(.optaPrimary)
                    .scaleEffect(1.0 + (dotIndex == 1 ? 0.2 : 0))
            }
            
            HStack(spacing: 6) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.optaPrimary.opacity(dotIndex == index ? 1 : 0.3))
                        .frame(width: 8, height: 8)
                        .scaleEffect(dotIndex == index ? 1.2 : 1)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.optaGlassBackground)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
            .onAppear {
                Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                    withAnimation(.spring(response: 0.2)) {
                        dotIndex = (dotIndex + 1) % 3
                    }
                }
            }
            
            Spacer()
        }
    }
}

// MARK: - Quick Actions Bar

struct QuickActionsBar: View {
    let onAction: (String) -> Void
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                QuickActionChip(icon: "plus", label: "Add Event", color: .optaNeonBlue) {
                    onAction("Schedule a new event")
                }
                
                QuickActionChip(icon: "checkmark.circle", label: "Add Task", color: .optaNeonGreen) {
                    onAction("Create a new task")
                }
                
                QuickActionChip(icon: "calendar", label: "Today", color: .optaNeonCyan) {
                    onAction("What's on my schedule today?")
                }
                
                QuickActionChip(icon: "envelope", label: "Emails", color: .optaNeonAmber) {
                    onAction("Check my unread emails")
                }
                
                QuickActionChip(icon: "sparkles", label: "Summary", color: .optaPrimary) {
                    onAction("Give me a summary of my day")
                }
            }
        }
    }
}

struct QuickActionChip: View {
    let icon: String
    let label: String
    var color: Color = .optaPrimary
    let action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button(action: {
            HapticManager.shared.selection()
            action()
        }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundColor(color)
                
                Text(label)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.optaTextSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color.opacity(0.1))
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(color.opacity(0.2), lineWidth: 1)
            )
            .scaleEffect(isPressed ? 0.95 : 1)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .animation(.spring(response: 0.2), value: isPressed)
    }
}

// MARK: - View Model

@MainActor
class OptaChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = [
        ChatMessage(role: .assistant, text: "I am Opta. How can I assist you today?")
    ]
    @Published var inputText = ""
    @Published var isProcessing = false
    @Published var conversationState: [String: Any] = [:]
    
    private let api = APIService.shared
    
    func sendMessage() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        
        let userMessage = inputText
        inputText = ""
        
        messages.append(ChatMessage(role: .user, text: userMessage))
        
        Task {
            await processCommand(userMessage)
        }
    }
    
    func sendQuickAction(_ command: String) {
        messages.append(ChatMessage(role: .user, text: command))
        
        Task {
            await processCommand(command)
        }
    }
    
    func clearChat() {
        HapticManager.shared.notification(.warning)
        withAnimation {
            messages = [
                ChatMessage(role: .assistant, text: "Chat cleared. How can I help you?")
            ]
            conversationState = [:]
        }
    }
    
    func exportChat() {
        let text = messages.map { msg in
            "\(msg.role == .user ? "You" : "Opta"): \(msg.text)"
        }.joined(separator: "\n\n")
        
        UIPasteboard.general.string = text
        HapticManager.shared.notification(.success)
    }
    
    private func processCommand(_ command: String) async {
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            let response = try await api.sendAICommand(command, state: conversationState)
            
            // Update conversation state
            if let newState = response.newState {
                for (key, value) in newState {
                    conversationState[key] = value.value
                }
            }
            
            HapticManager.shared.notification(.success)
            
            messages.append(ChatMessage(
                role: .assistant,
                text: response.message,
                actionType: response.actionType
            ))
            
        } catch {
            HapticManager.shared.notification(.error)
            
            messages.append(ChatMessage(
                role: .assistant,
                text: "I encountered an issue: \(error.localizedDescription). Please try again."
            ))
        }
    }
}

#Preview {
    OptaChatView()
}
