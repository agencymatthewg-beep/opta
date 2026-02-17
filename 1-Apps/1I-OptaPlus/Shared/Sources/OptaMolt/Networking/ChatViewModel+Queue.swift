//
//  ChatViewModel+Queue.swift
//  OptaMolt
//
//  Offline queue logic extracted from ChatViewModel.
//  Handles message queueing when disconnected and flushing
//  queued messages when the connection is restored.
//

import Foundation
import os.log

// MARK: - ChatViewModel Offline Queue

extension ChatViewModel {

    // MARK: - Message Queue (Offline Support)

    func enqueueMessage(text: String, attachments: [ChatAttachment], messageId: String) {
        guard let session = activeSession else { return }

        let queuedAttachments: [QueuedAttachment] = attachments.compactMap { att in
            guard let data = att.data else { return nil }
            return QueuedAttachment(
                filename: att.filename,
                mimeType: att.mimeType,
                base64Data: data.base64EncodedString()
            )
        }

        let queued = OfflineQueuedMessage(
            text: text,
            botId: botConfig.id,
            sessionKey: session.sessionKey,
            deliver: session.resolvedShouldDeliver,
            chatMessageId: messageId,
            attachments: queuedAttachments
        )
        offlineQueue.add(queued)
        Self.logger.info("Message queued via OfflineQueue (\(self.offlineQueue.count) in queue)")
    }

    func flushMessageQueue() {
        guard let client = activeClient else { return }

        offlineQueue.flush(
            sender: { message in
                let wireAttachments: [ChatSendAttachment]? = message.attachments.isEmpty
                    ? nil
                    : message.attachments.map {
                        ChatSendAttachment(filename: $0.filename, mimeType: $0.mimeType, base64Data: $0.base64Data)
                    }
                do {
                    _ = try await client.chatSend(
                        sessionKey: message.sessionKey,
                        message: message.text,
                        deliver: message.deliver,
                        attachments: wireAttachments
                    )
                    return true
                } catch {
                    Self.logger.error("Queued message send failed: \(error.localizedDescription)")
                    return false
                }
            },
            onStatusUpdate: { [weak self] chatMessageId, status in
                guard let self else { return }
                if let idx = self.messages.lastIndex(where: { $0.id == chatMessageId }) {
                    self.messages[idx].status = status
                }
                if let session = self.activeSession {
                    self.sessionMessagesCache[session.id] = self.messages
                }
            }
        )
    }
}
