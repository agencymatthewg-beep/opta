'use client'

import { useCallback, useRef, useState } from 'react'

import { getLmxUrl, getAdminKey, LmxError } from '@/lib/api'
import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatMessage,
} from '@/lib/types'

export interface UseChatOptions {
    model?: string
    temperature?: number
    maxTokens?: number
}

export interface UseChatReturn {
    messages: ChatMessage[]
    isStreaming: boolean
    error: string | null
    sendMessage: (content: string) => void
    clearMessages: () => void
    stopStreaming: () => void
    setSystemPrompt: (prompt: string) => void
}

/**
 * Streaming chat hook using SSE (POST /v1/chat/completions with stream:true).
 *
 * Manages message state, parses SSE chunks incrementally,
 * and supports cancellation via AbortController.
 */
export function useChat(options?: UseChatOptions): UseChatReturn {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const systemPromptRef = useRef<string | null>(null)

    const stopStreaming = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort()
            abortRef.current = null
        }
        setIsStreaming(false)
    }, [])

    const sendMessage = useCallback(
        async (content: string) => {
            const userMessage: ChatMessage = { role: 'user', content }

            setMessages((prev) => [...prev, userMessage])
            setError(null)
            setIsStreaming(true)

            const controller = new AbortController()
            abortRef.current = controller

            try {
                // Build message list for the API
                const apiMessages: ChatMessage[] = []
                if (systemPromptRef.current) {
                    apiMessages.push({
                        role: 'system',
                        content: systemPromptRef.current,
                    })
                }
                // Include all previous messages plus the new one
                setMessages((prev) => {
                    apiMessages.push(...prev)
                    return prev
                })

                const body: ChatCompletionRequest = {
                    model: options?.model ?? 'auto',
                    messages: apiMessages,
                    stream: true,
                    temperature: options?.temperature ?? 0.7,
                    max_tokens: options?.maxTokens,
                }

                const baseUrl = getLmxUrl()
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                }
                const adminKey = getAdminKey()
                if (adminKey) {
                    headers['X-Admin-Key'] = adminKey
                }

                const res = await fetch(`${baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: controller.signal,
                })

                if (!res.ok) {
                    const text = await res.text()
                    throw new LmxError(res.status, text || res.statusText)
                }

                const reader = res.body?.getReader()
                if (!reader) throw new Error('No response body')

                const decoder = new TextDecoder()
                let assistantContent = ''

                // Add placeholder assistant message
                setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: '' },
                ])

                let buffer = ''
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() ?? ''

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || trimmed === 'data: [DONE]') continue
                        if (!trimmed.startsWith('data: ')) continue

                        try {
                            const chunk = JSON.parse(
                                trimmed.slice(6)
                            ) as ChatCompletionChunk
                            const delta = chunk.choices?.[0]?.delta
                            if (delta?.content) {
                                assistantContent += delta.content
                                const updatedContent = assistantContent
                                setMessages((prev) => {
                                    const next = [...prev]
                                    const last = next[next.length - 1]
                                    if (last?.role === 'assistant') {
                                        next[next.length - 1] = {
                                            ...last,
                                            content: updatedContent,
                                        }
                                    }
                                    return next
                                })
                            }
                        } catch {
                            // Skip unparseable SSE lines
                        }
                    }
                }
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    const msg =
                        err instanceof LmxError
                            ? err.message
                            : (err as Error).message
                    setError(msg)
                }
            } finally {
                setIsStreaming(false)
                abortRef.current = null
            }
        },
        [options?.model, options?.temperature, options?.maxTokens]
    )

    const clearMessages = useCallback(() => {
        setMessages([])
        setError(null)
    }, [])

    const setSystemPrompt = useCallback((prompt: string) => {
        systemPromptRef.current = prompt
    }, [])

    return {
        messages,
        isStreaming,
        error,
        sendMessage,
        clearMessages,
        stopStreaming,
        setSystemPrompt,
    }
}
