/**
 * SSE event bus client for /admin/events stream.
 *
 * Subscribes to real-time LMX server events and distributes them
 * to registered handlers. Auto-reconnects on disconnect.
 */

import { lmxEventSource } from './api'
import type { ServerEvent, ServerEventType } from './types'

export type EventHandler = (event: ServerEvent) => void

export class LmxEventBus {
    private cleanup: (() => void) | null = null
    private handlers = new Map<string, Set<EventHandler>>()
    private wildcardHandlers = new Set<EventHandler>()
    private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private _isRunning = false

    /** Start listening to SSE events. */
    start() {
        if (this._isRunning) return
        this._isRunning = true
        this._connect()
    }

    /** Stop listening and clean up. */
    stop() {
        this._isRunning = false
        if (this.cleanup) {
            this.cleanup()
            this.cleanup = null
        }
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer)
            this._reconnectTimer = null
        }
    }

    /** Subscribe to a specific event type, or '*' for all events. */
    subscribe(type: ServerEventType | '*', handler: EventHandler) {
        if (type === '*') {
            this.wildcardHandlers.add(handler)
        } else {
            let set = this.handlers.get(type)
            if (!set) {
                set = new Set()
                this.handlers.set(type, set)
            }
            set.add(handler)
        }
    }

    /** Unsubscribe a handler. */
    unsubscribe(type: ServerEventType | '*', handler: EventHandler) {
        if (type === '*') {
            this.wildcardHandlers.delete(handler)
        } else {
            this.handlers.get(type)?.delete(handler)
        }
    }

    private _connect() {
        if (!this._isRunning) return

        this.cleanup = lmxEventSource('/admin/events', {
            onMessage: ({ type, data }) => {
                const event: ServerEvent = {
                    event_type: type as ServerEventType,
                    data: (data as Record<string, unknown>) ?? {},
                }
                this._dispatch(event)
            },
            onError: () => {
                // Auto-reconnect after 5s
                if (this._isRunning && !this._reconnectTimer) {
                    if (this.cleanup) {
                        this.cleanup()
                        this.cleanup = null
                    }
                    this._reconnectTimer = setTimeout(() => {
                        this._reconnectTimer = null
                        this._connect()
                    }, 5_000)
                }
            },
            onOpen: () => {
                // Clear any pending reconnect
                if (this._reconnectTimer) {
                    clearTimeout(this._reconnectTimer)
                    this._reconnectTimer = null
                }
            },
        })
    }

    private _dispatch(event: ServerEvent) {
        // Typed handlers
        const handlers = this.handlers.get(event.event_type)
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(event)
                } catch {
                    // Don't crash the event bus on handler errors
                }
            }
        }
        // Wildcard handlers
        for (const handler of this.wildcardHandlers) {
            try {
                handler(event)
            } catch {
                // Don't crash the event bus on handler errors
            }
        }
    }
}

/** Singleton event bus instance. */
export const eventBus = new LmxEventBus()
