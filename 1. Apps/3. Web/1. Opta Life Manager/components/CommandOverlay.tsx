"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, ArrowRight, Mail, Calendar, Trash2, Search, Send, User, Bot, Plus, CalendarDays, ClipboardList } from "lucide-react";
import { processAiCommand, CommandActionType } from "@/lib/ai-commander";
import { useTasks } from "@/contextsHooks/TaskContext";

interface CommandOverlayProps {
    onNavigate: (id: string) => void;
    onClearCompleted: () => void;
}

type Message = {
    id: string;
    role: "user" | "assistant";
    text: string;
    actionType?: CommandActionType;
};

export function CommandOverlay({ onNavigate, onClearCompleted }: CommandOverlayProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [processing, setProcessing] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: "init", role: "assistant", text: "I am Opta. How can I assist you?" }
    ]);

    // Context state for multi-turn conversations
    // Stores: lastCreatedEvent, lastDeletedEvent, lastAction, pendingAction, etc.
    const [conversationState, setConversationState] = useState<Record<string, unknown>>({});

    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { addTask } = useTasks();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                if (!isOpen) {
                    // Reset or keep history? Let's keep recent history but ensure focus
                }
            }
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            scrollToBottom();
        }
    }, [isOpen, messages]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const addMessage = (role: "user" | "assistant", text: string, actionType?: CommandActionType) => {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role, text, actionType }]);
    };

    const handleQuickAction = async (command: string) => {
        addMessage("user", command);
        setProcessing(true);

        const result = await processAiCommand(command, conversationState);

        // Merge new state with existing state to preserve conversation memory
        if (result.newState) {
            setConversationState(prev => ({ ...prev, ...result.newState }));
        }

        addMessage("assistant", result.message, result.actionType);

        if (result.success && result.actionType) {
            if (result.actionType === "TASK") {
                const title = (result.payload?.title as string) || command;
                addTask(title, "General");
            }
            else if (result.actionType === "NAVIGATE" && result.payload?.target) {
                const target = result.payload.target as string;
                onNavigate(target);
                setTimeout(() => setIsOpen(false), 800);
            }
            else if (result.actionType === "CLEAR_COMPLETED") {
                onClearCompleted();
            }
            else if (result.actionType === "SEARCH" && result.payload?.query) {
                const query = result.payload.query as string;
                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
            }
        }

        setProcessing(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userText = input;
        setInput("");
        addMessage("user", userText);
        setProcessing(true);

        // AI LOGIC
        // We pass the current state + input to the backend
        const result = await processAiCommand(userText, conversationState);

        // Merge new state with existing state to preserve conversation memory
        if (result.newState) {
            setConversationState(prev => ({ ...prev, ...result.newState }));
        }

        addMessage("assistant", result.message, result.actionType);

        // Execute Client-Side Actions based on the FINAL intent
        if (result.success && result.actionType) {
            if (result.actionType === "TASK") {
                const title = (result.payload?.title as string) || userText;
                addTask(title, "General");
            }
            else if (result.actionType === "NAVIGATE" && result.payload?.target) {
                const target = result.payload.target as string;
                onNavigate(target);
                setTimeout(() => setIsOpen(false), 800);
            }
            else if (result.actionType === "CLEAR_COMPLETED") {
                onClearCompleted();
            }
            else if (result.actionType === "SEARCH" && result.payload?.query) {
                const query = result.payload.query as string;
                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
            }
        }

        setProcessing(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-[0_0_80px_rgba(139,92,246,0.25)] overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="h-1 w-full bg-gradient-to-r from-primary via-neon-cyan to-primary animate-gradient-x" />
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/2">
                    <div className="flex items-center gap-2 text-primary">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-semibold tracking-widest uppercase text-white/90">Opta Chat</span>
                    </div>
                    <kbd className="px-2 py-1 text-[10px] font-mono text-white/30 bg-white/5 rounded border border-white/5">ESC</kbd>
                </div>

                {/* Chat Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="mt-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}

                            <div className={`
                        max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed
                        ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-tr-sm'
                                    : 'bg-white/5 text-text-secondary border border-white/10 rounded-tl-sm'}
                    `}>
                                {msg.text}
                                {msg.actionType === 'CALENDAR' && (
                                    <div className="mt-2 text-xs flex items-center gap-1 text-neon-blue">
                                        <Calendar className="w-3 h-3" /> Event Scheduled
                                    </div>
                                )}
                                {msg.actionType === 'EMAIL' && (
                                    <div className="mt-2 text-xs flex items-center gap-1 text-neon-green">
                                        <Mail className="w-3 h-3" /> Email Drafted
                                    </div>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="mt-1 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                                    <User className="w-4 h-4 text-white/70" />
                                </div>
                            )}
                        </div>
                    ))}
                    {processing && (
                        <div className="flex gap-4 justify-start">
                            <div className="mt-1 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-5 py-3 border border-white/10 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex flex-wrap gap-2 justify-center">
                        <QuickAction
                            icon={<Plus className="w-3 h-3" />}
                            label="Add Event"
                            onClick={() => handleQuickAction("Schedule a new event")}
                            disabled={processing}
                        />
                        <QuickAction
                            icon={<CalendarDays className="w-3 h-3" />}
                            label="Next 3 Days"
                            onClick={() => handleQuickAction("What's on my calendar for the next 3 days?")}
                            disabled={processing}
                        />
                        <QuickAction
                            icon={<Trash2 className="w-3 h-3" />}
                            label="Remove Event"
                            onClick={() => handleQuickAction("Help me remove an event from my calendar")}
                            disabled={processing}
                        />
                        <QuickAction
                            icon={<ClipboardList className="w-3 h-3" />}
                            label="Daily Summary"
                            onClick={() => handleQuickAction("Give me a summary of today's schedule")}
                            disabled={processing}
                        />
                        <QuickAction
                            icon={<Calendar className="w-3 h-3" />}
                            label="Monthly Summary"
                            onClick={() => handleQuickAction("Give me a summary of this month's upcoming events")}
                            disabled={processing}
                        />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/5 bg-white/2">
                    <form onSubmit={handleSubmit} className="relative group">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full bg-[#121214] border border-white/10 rounded-xl px-5 py-4 pr-12 text-md text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-light"
                            disabled={processing}
                        />
                        <button
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary hover:text-white transition-all disabled:opacity-0 disabled:scale-90"
                            disabled={!input.trim() || processing}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                    <div className="mt-3 flex justify-center gap-4 text-[10px] text-white/20 font-mono">
                        <span>CMD+K to Toggle</span>
                        <span>Type "Help" for options</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Quick Action Button Component
function QuickAction({
    icon,
    label,
    onClick,
    disabled
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 bg-white/5 border border-white/10 rounded-lg hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {icon}
            {label}
        </button>
    );
}
