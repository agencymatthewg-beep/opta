import AppIntents

// MARK: - Ask Opta Intent

struct AskOptaIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Opta"
    static var description = IntentDescription("Ask Opta a question or give a command")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Question")
    var question: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Ask Opta \(\.$question)")
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        do {
            let response = try await api.sendAICommand(question)
            
            // Format response for speech
            var spokenResponse = response.message
            
            // Add action confirmation if applicable
            if let actionType = response.actionType {
                switch actionType {
                case "CALENDAR":
                    spokenResponse += " I've updated your calendar."
                case "TASK":
                    spokenResponse += " I've updated your tasks."
                case "EMAIL":
                    spokenResponse += " I've prepared the email."
                default:
                    break
                }
            }
            
            return .result(dialog: IntentDialog(stringLiteral: spokenResponse))
            
        } catch {
            return .result(dialog: "Sorry, I couldn't process that request. Please try again.")
        }
    }
}

// MARK: - Opta Conversation Intent (Multi-turn)

struct OptaConversationIntent: AppIntent {
    static var title: LocalizedStringResource = "Have Conversation with Opta"
    static var description = IntentDescription("Start a multi-turn conversation with Opta AI")
    
    static var openAppWhenRun: Bool = true
    
    @MainActor
    func perform() async throws -> some IntentResult {
        // Opens app to Opta Chat view
        return .result()
    }
}

// MARK: - Email Draft Intent

struct CreateEmailDraftIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Email Draft in Opta"
    static var description = IntentDescription("Create an email draft")
    
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "To")
    var recipient: String
    
    @Parameter(title: "Subject")
    var subject: String
    
    @Parameter(title: "Body")
    var body: String?
    
    static var parameterSummary: some ParameterSummary {
        Summary("Draft email to \(\.$recipient) about \(\.$subject)") {
            \.$body
        }
    }
    
    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIService.shared
        
        do {
            try await api.createEmailDraft(
                to: recipient,
                subject: subject,
                body: body ?? ""
            )
            
            return .result(dialog: "Created a draft email to \(recipient).")
            
        } catch {
            return .result(dialog: "Sorry, I couldn't create that draft. Please try again.")
        }
    }
}

// MARK: - Focus Filter Intent

struct OptaFocusFilter: SetFocusFilterIntent {
    static var title: LocalizedStringResource = "Opta Focus Mode"
    static var description: IntentDescription? = IntentDescription("Configure Opta for your current focus mode")
    
    @Parameter(title: "Show Notifications")
    var showNotifications: Bool
    
    @Parameter(title: "Mode", default: .work)
    var focusMode: OptaFocusMode
    
    func perform() async throws -> some IntentResult {
        // Configure app based on focus mode
        // In a real implementation, this would update UserDefaults or similar
        return .result()
    }
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "Opta \(focusMode.displayName) Mode",
            subtitle: showNotifications ? "Notifications on" : "Notifications off"
        )
    }
}

enum OptaFocusMode: String, AppEnum {
    case work, personal, sleep
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Focus Mode")
    
    static var caseDisplayRepresentations: [OptaFocusMode: DisplayRepresentation] = [
        .work: DisplayRepresentation(title: "Work"),
        .personal: DisplayRepresentation(title: "Personal"),
        .sleep: DisplayRepresentation(title: "Sleep")
    ]
    
    var displayName: String {
        switch self {
        case .work: return "Work"
        case .personal: return "Personal"
        case .sleep: return "Sleep"
        }
    }
}
