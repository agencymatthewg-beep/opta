//
//  ChatViewModel+Events.swift
//  OptaMolt
//
//  Event handling logic extracted from ChatViewModel.
//  Handles gateway events: chat deltas/finals, agent stream events,
//  bot state transitions, and stream finalization.
//

import Foundation
import os.log

// MARK: - ChatViewModel Event Handling

extension ChatViewModel {

    // MARK: - Event Handling

    func handleEvent(_ event: EventFrame) {
        Self.logger.debug("Event received: '\(event.event)' payload keys: \(event.payload?.dict?.keys.sorted().joined(separator: ",") ?? "nil")")
        switch event.event {
        case "chat":
            handleChatEvent(event.payload)
        case "agent":
            handleAgentEvent(event.payload)
        default:
            break
        }
    }

    func handleChatEvent(_ payload: AnyCodable?) {
        guard let dict = payload?.dict else { Self.logger.debug("Chat event: no dict payload"); return }

        // Check if this event belongs to the active session
        // Gateway uses qualified keys like "agent:main:main" while we store "main"
        let eventSessionKey = dict["sessionKey"] as? String
        Self.logger.debug("Chat event: sessionKey=\(eventSessionKey ?? "nil") state=\(dict["state"] as? String ?? "nil") activeSession=\(self.activeSession?.sessionKey ?? "nil")")
        if let eventSessionKey = eventSessionKey,
           let session = activeSession {
            let matches = eventSessionKey == session.sessionKey
                || eventSessionKey.hasSuffix(":\(session.sessionKey)")
                || session.sessionKey.hasSuffix(":\(eventSessionKey)")
            if !matches {
                Self.logger.debug("Chat event for different session (\(eventSessionKey) vs \(session.sessionKey)), ignoring")
                return
            }
        }

        let stateStr = dict["state"] as? String ?? ""

        switch stateStr {
        case "delta":
            // Track time to first streaming byte
            if botState != .typing, let sendTime = lastSendTime {
                messageStats.recordResponseTime(Date().timeIntervalSince(sendTime))
                lastSendTime = nil
                persistStats()
            }
            botState = .typing

            // Extract accumulated message text
            // The "message" field is an object with {role, content, timestamp}
            // Content can be a string or array of blocks [{type:"text", text:"..."}]
            if let message = dict["message"] {
                let text: String
                if let msgDict = message as? [String: Any], let content = msgDict["content"] {
                    text = extractMessageText(content)
                } else {
                    text = extractMessageText(message)
                }
                Self.logger.debug("Delta: \(text.count) chars (was \(self.streamingContent.count))")
                if text.count >= streamingContent.count {
                    streamingContent = text
                }
            } else {
                Self.logger.debug("Delta: no 'message' key in payload. Keys: \(dict.keys.sorted())")
            }

            // Track run ID
            if let runId = dict["runId"] as? String {
                activeRunId = runId
            }

        case "final":
            // Finalize the streaming message
            let finalText: String
            if let message = dict["message"] {
                if let msgDict = message as? [String: Any], let content = msgDict["content"] {
                    finalText = extractMessageText(content)
                } else {
                    finalText = extractMessageText(message)
                }
            } else {
                finalText = streamingContent
            }

            Self.logger.info("Final: \(finalText.count) chars, appending bot message")

            if !finalText.isEmpty {
                let botMessage = ChatMessage(
                    content: finalText,
                    sender: .bot(name: botConfig.name),
                    status: .delivered
                )
                messages.append(botMessage)
                messageStats.recordReceived(at: botMessage.timestamp)
                if let sendTime = lastSendTime {
                    messageStats.recordResponseTime(Date().timeIntervalSince(sendTime))
                    lastSendTime = nil
                }
                persistStats()
                schedulePersist()
                if let session = activeSession {
                    sessionMessages[session.id] = messages
                }
            }

            resetStreamState()

        case "aborted":
            if !streamingContent.isEmpty {
                let partialMessage = ChatMessage(
                    content: streamingContent + "\n\n_(aborted)_",
                    sender: .bot(name: botConfig.name),
                    status: .delivered
                )
                messages.append(partialMessage)
                if let session = activeSession {
                    sessionMessages[session.id] = messages
                }
            }
            resetStreamState()

        case "error":
            let errorMsg = dict["errorMessage"] as? String ?? "Chat error"
            errorMessage = errorMsg
            resetStreamState()

        default:
            break
        }
    }

    func handleAgentEvent(_ payload: AnyCodable?) {
        guard let dict = payload?.dict else { return }

        // Old-style agent state events
        if let state = dict["state"] as? String {
            switch state {
            case "thinking":
                botState = .thinking
            case "responding":
                botState = .typing
            case "idle":
                if activeRunId == nil {
                    botState = .idle
                }
            default:
                break
            }
            return
        }

        // New-style agent stream events
        let stream = dict["stream"] as? String ?? "unknown"
        let data = dict["data"] as? [String: Any] ?? [:]

        let event = AgentStreamEvent(
            stream: stream,
            phase: data["phase"] as? String,
            text: data["text"] as? String,
            delta: data["delta"] as? String,
            toolName: data["name"] as? String ?? data["toolName"] as? String
        )

        // Only keep last 20 events to prevent memory bloat
        if agentEvents.count > 20 {
            agentEvents.removeFirst(agentEvents.count - 15)
        }
        agentEvents.append(event)

        // Update bot state from lifecycle
        if stream == "lifecycle" {
            if let phase = data["phase"] as? String {
                switch phase {
                case "start":
                    botState = .thinking
                    activeRunId = dict["runId"] as? String
                case "end":
                    // Don't reset to idle here - wait for chat final event
                    break
                default:
                    break
                }
            }
        }

        // Update bot state from assistant stream (means it's typing)
        if stream == "assistant" && data["delta"] != nil {
            botState = .typing
        }

        // Track tool calls
        if stream == "tool_call" || stream == "tool" {
            botState = .thinking
        }
    }
}
