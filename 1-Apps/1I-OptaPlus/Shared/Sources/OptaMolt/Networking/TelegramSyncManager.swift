//
//  TelegramSyncManager.swift
//  OptaMolt
//
//  Manages Telegram client authentication and messaging via TDLibKit.
//  Handles the full auth flow (phone → code → 2FA → ready), message send/receive,
//  and bot chat discovery for bidirectional sync with the OpenClaw gateway.
//

#if canImport(TDLibKit)
import Foundation
import TDLibKit
import Combine

// MARK: - Auth State

/// Telegram authentication lifecycle states.
public enum TelegramAuthState: Equatable, Sendable {
    case uninitialized
    case awaitingPhoneNumber
    case awaitingCode
    case awaitingPassword
    case ready
    case loggingOut
    case error(String)

    public static func == (lhs: TelegramAuthState, rhs: TelegramAuthState) -> Bool {
        switch (lhs, rhs) {
        case (.uninitialized, .uninitialized),
             (.awaitingPhoneNumber, .awaitingPhoneNumber),
             (.awaitingCode, .awaitingCode),
             (.awaitingPassword, .awaitingPassword),
             (.ready, .ready),
             (.loggingOut, .loggingOut):
            return true
        case (.error(let a), .error(let b)):
            return a == b
        default:
            return false
        }
    }
}

// MARK: - Incoming Message

/// A message received from Telegram (from the bot chat).
public struct TelegramIncomingMessage: Sendable {
    public let messageId: Int64
    public let text: String
    public let date: Date
    public let isBot: Bool
    public let senderUserId: Int64
}

// MARK: - TelegramSyncManager

@MainActor
public final class TelegramSyncManager: ObservableObject {

    // MARK: - Published State

    @Published public var authState: TelegramAuthState = .uninitialized
    @Published public var isReady: Bool = false
    @Published public var connectedPhone: String?

    // MARK: - Callbacks

    /// Called when a message arrives in the bot chat.
    public var onBotMessage: ((TelegramIncomingMessage) -> Void)?

    /// Called when an outgoing message is confirmed delivered.
    public var onMessageDelivered: ((Int64) -> Void)?

    // MARK: - Configuration

    /// Telegram API credentials (from https://my.telegram.org).
    /// These are per-app, not per-user secrets.
    private let apiId: Int32
    private let apiHash: String

    /// The bot username to discover and sync with.
    private let botUsername: String

    /// Owner's Telegram user ID for message origin detection.
    private let ownerUserId: Int64

    // MARK: - Private

    private var api: TdApi?
    private var botChatId: Int64?

    /// TDLib database directory in the app sandbox.
    private var databasePath: String {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = support.appendingPathComponent("OptaPlus/tdlib", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.path
    }

    // MARK: - Init

    /// Create a TelegramSyncManager.
    ///
    /// - Parameters:
    ///   - apiId: Telegram API application ID.
    ///   - apiHash: Telegram API application hash.
    ///   - botUsername: The bot to sync with (without @). Defaults to "Opta_Bot".
    ///   - ownerUserId: The owner's Telegram user ID. Defaults to Matthew's ID.
    public init(
        apiId: Int32,
        apiHash: String,
        botUsername: String = "Opta_Bot",
        ownerUserId: Int64 = 7799095654
    ) {
        self.apiId = apiId
        self.apiHash = apiHash
        self.botUsername = botUsername
        self.ownerUserId = ownerUserId
    }

    // MARK: - Lifecycle

    /// Initialize TDLib and start the authentication flow.
    public func initialize() async {
        let api = TdApi(client: TdClientImpl())

        api.client.run { [weak self] data in
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                do {
                    let update = try api.decoder.decode(Update.self, from: data)
                    self.handleUpdate(update)
                } catch {
                    NSLog("[TG] Failed to decode update: \(error)")
                }
            }
        }

        self.api = api

        // Set TDLib parameters
        do {
            let params = SetTdlibParameters(
                apiHash: apiHash,
                apiId: apiId,
                applicationVersion: "0.1.0",
                databaseDirectory: databasePath,
                databaseEncryptionKey: Data(),
                deviceModel: deviceModel,
                enableStorageOptimizer: true,
                filesDirectory: databasePath + "/files",
                ignoreFileNames: false,
                systemLanguageCode: Locale.current.language.languageCode?.identifier ?? "en",
                systemVersion: systemVersion,
                useChatInfoDatabase: true,
                useFileDatabase: true,
                useMessageDatabase: true,
                useSecretChats: false,
                useTestDc: false
            )
            try await api.setTdlibParameters(params)
            NSLog("[TG] TDLib parameters set, database at: \(databasePath)")
        } catch {
            NSLog("[TG] Failed to set TDLib parameters: \(error)")
            authState = .error("Failed to initialize: \(error.localizedDescription)")
        }
    }

    /// Disconnect, log out, and close the TDLib client.
    public func disconnect() async {
        let wasReady = isReady
        authState = .loggingOut

        if wasReady {
            do {
                try await api?.logOut()
            } catch {
                NSLog("[TG] Logout error: \(error)")
            }
        }

        api?.client.close()
        api = nil
        authState = .uninitialized
        isReady = false
        connectedPhone = nil
        botChatId = nil
    }

    // MARK: - Authentication

    /// Submit phone number to begin auth.
    public func setPhoneNumber(_ phone: String) async throws {
        guard let api = api else { throw TelegramError.notInitialized }
        let settings = PhoneNumberAuthenticationSettings(
            allowFlashCall: false,
            allowMissedCall: false,
            allowSmsRetrieverApi: false,
            firebaseAuthenticationSettings: nil,
            hasUnknownPhoneNumber: false,
            isCurrentPhoneNumber: false
        )
        try await api.setAuthenticationPhoneNumber(
            phoneNumber: phone,
            settings: settings
        )
        NSLog("[TG] Phone number submitted: \(phone.prefix(4))***")
    }

    /// Submit the verification code.
    public func submitCode(_ code: String) async throws {
        guard let api = api else { throw TelegramError.notInitialized }
        try await api.checkAuthenticationCode(code: code)
        NSLog("[TG] Auth code submitted")
    }

    /// Submit 2FA password.
    public func submitPassword(_ password: String) async throws {
        guard let api = api else { throw TelegramError.notInitialized }
        try await api.checkAuthenticationPassword(password: password)
        NSLog("[TG] 2FA password submitted")
    }

    // MARK: - Messaging

    /// Send a text message to the bot chat.
    /// Returns the Telegram message ID.
    @discardableResult
    public func sendMessage(_ text: String) async throws -> Int64 {
        guard let api = api, let chatId = botChatId else {
            throw TelegramError.botChatNotFound
        }

        let content = InputMessageContent.inputMessageText(
            InputMessageText(
                clearDraft: true,
                linkPreviewOptions: nil,
                text: FormattedText(entities: [], text: text)
            )
        )

        let result = try await api.sendMessage(
            chatId: chatId,
            inputMessageContent: content,
            messageThreadId: 0,
            options: nil,
            replyMarkup: nil,
            replyTo: nil
        )

        NSLog("[TG] Message sent, id: \(result.id)")
        return result.id
    }

    // MARK: - Update Handler

    private func handleUpdate(_ update: Update) {
        switch update {
        case .updateAuthorizationState(let state):
            handleAuthState(state.authorizationState)

        case .updateNewMessage(let msg):
            handleNewMessage(msg.message)

        case .updateMessageSendSucceeded(let succeeded):
            onMessageDelivered?(succeeded.message.id)

        default:
            break
        }
    }

    private func handleAuthState(_ state: AuthorizationState) {
        NSLog("[TG] Auth state: \(state)")
        switch state {
        case .authorizationStateWaitPhoneNumber:
            authState = .awaitingPhoneNumber

        case .authorizationStateWaitCode:
            authState = .awaitingCode

        case .authorizationStateWaitPassword:
            authState = .awaitingPassword

        case .authorizationStateReady:
            authState = .ready
            isReady = true
            NSLog("[TG] Authenticated! Discovering bot chat...")
            Task { await discoverBotChat() }

        case .authorizationStateLoggingOut:
            authState = .loggingOut

        case .authorizationStateClosed:
            authState = .uninitialized
            isReady = false

        default:
            break
        }
    }

    // MARK: - Bot Chat Discovery

    private func discoverBotChat() async {
        guard let api = api else { return }
        do {
            let chat = try await api.searchPublicChat(username: botUsername)
            botChatId = chat.id
            NSLog("[TG] Bot chat discovered: \(botUsername), chatId: \(chat.id)")

            // Open the chat to receive updates
            try await api.openChat(chatId: chat.id)
        } catch {
            NSLog("[TG] Failed to discover bot chat '\(botUsername)': \(error)")
            authState = .error("Bot @\(botUsername) not found")
        }
    }

    // MARK: - Message Handling

    private func handleNewMessage(_ message: Message) {
        // Only process messages from the bot chat
        guard message.chatId == botChatId else { return }

        // Extract text content
        let text: String
        switch message.content {
        case .messageText(let msg):
            text = msg.text.text
        default:
            return // Skip non-text messages for now
        }

        // Determine sender
        let senderUserId: Int64
        let isBot: Bool
        switch message.senderId {
        case .messageSenderUser(let user):
            senderUserId = user.userId
            isBot = senderUserId != ownerUserId
        case .messageSenderChat:
            senderUserId = 0
            isBot = true
        }

        let incoming = TelegramIncomingMessage(
            messageId: message.id,
            text: text,
            date: Date(timeIntervalSince1970: Double(message.date)),
            isBot: isBot,
            senderUserId: senderUserId
        )

        NSLog("[TG] New message from \(isBot ? "bot" : "user"): '\(text.prefix(50))'")
        onBotMessage?(incoming)
    }

    // MARK: - Platform Helpers

    private var deviceModel: String {
        #if os(macOS)
        return "Mac"
        #elseif os(iOS)
        return "iPhone"
        #else
        return "Unknown"
        #endif
    }

    private var systemVersion: String {
        ProcessInfo.processInfo.operatingSystemVersionString
    }
}

// MARK: - Errors

public enum TelegramError: LocalizedError, Sendable {
    case notInitialized
    case botChatNotFound
    case sendFailed(String)

    public var errorDescription: String? {
        switch self {
        case .notInitialized: return "Telegram client not initialized"
        case .botChatNotFound: return "Bot chat not found — authenticate first"
        case .sendFailed(let msg): return "Send failed: \(msg)"
        }
    }
}

#endif
