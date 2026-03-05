'use client'

import { MessageSquare, Send, Square, Loader2, Trash2 } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PageHeader } from '@/components/PageHeader'
import { useConnection } from '@/lib/connection'
import { useChat } from '@/hooks/use-chat'
import { useLoadedModels } from '@/hooks/use-models'
import { useState } from 'react'

export default function ChatPage() {
    const { isConnected } = useConnection()
    const { models } = useLoadedModels()
    const [selectedModel, setSelectedModel] = useState('')
    const chat = useChat({ model: selectedModel || undefined })
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chat.messages])

    function handleSend() {
        if (!input.trim() || chat.isStreaming) return
        chat.sendMessage(input.trim())
        setInput('')
    }

    return (
        <DashboardLayout>
            <PageHeader
                title="Chat"
                subtitle="Interactive inference with streaming responses"
                icon={MessageSquare}
                action={
                    <div className="flex items-center gap-3">
                        <select
                            className="holographic-input text-xs py-1.5 px-3 w-60"
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)}
                            disabled={!isConnected}
                        >
                            <option value="">auto</option>
                            {models?.map(m => (
                                <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                            ))}
                        </select>
                        <button onClick={chat.clearMessages}
                            className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                            title="Clear messages">
                            <Trash2 size={14} />
                        </button>
                    </div>
                }
            />

            <div className="flex flex-col h-[calc(100vh-73px)]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 hud-fade-in">
                    {chat.messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare size={32} className="text-text-muted mb-4 opacity-30" />
                            <p className="text-sm text-text-muted">Send a message to start chatting.</p>
                        </div>
                    )}
                    {chat.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] px-4 py-3 rounded-xl text-sm ${msg.role === 'user'
                                    ? 'bg-primary/20 border border-primary/30 text-white'
                                    : 'config-panel text-text-primary'
                                }`}>
                                <pre className="font-mono text-sm whitespace-pre-wrap break-words">{msg.content}</pre>
                            </div>
                        </div>
                    ))}
                    {chat.isStreaming && (
                        <div className="flex items-center gap-2 text-xs text-primary font-mono">
                            <Loader2 size={12} className="animate-spin" /> streaming…
                        </div>
                    )}
                    {chat.error && (
                        <div className="text-xs text-[var(--opta-neon-red)] font-mono">{chat.error}</div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-[var(--opta-border)] px-8 py-4">
                    <div className="flex gap-3">
                        <input
                            className="holographic-input flex-1"
                            placeholder={isConnected ? 'Type a message…' : 'Connect to LMX to chat'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            disabled={!isConnected}
                        />
                        {chat.isStreaming ? (
                            <button onClick={chat.stopStreaming} className="holographic-btn flex items-center gap-2">
                                <Square size={12} /> Stop
                            </button>
                        ) : (
                            <button onClick={handleSend} disabled={!isConnected || !input.trim()} className="holographic-btn flex items-center gap-2">
                                <Send size={12} /> Send
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
