"use client";

import { useEffect, useState } from "react";
import { createEvent, getCalendarEvents } from "@/lib/actions";
import { Plus } from "lucide-react";

type CalendarEvent = {
    id?: string | null;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null };
};

export function CalendarWidget() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newTime, setNewTime] = useState("");

    const loadEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getCalendarEvents();
            if ("error" in result) {
                setError(result.error);
                setEvents([]);
            } else {
                setEvents(result.events);
            }
        } catch (e) {
            setError("Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle || !newTime) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const dateTime = new Date(`${today}T${newTime}`);

            await createEvent(newTitle, dateTime.toISOString());
            setIsCreating(false);
            setNewTitle("");
            setNewTime("");
            loadEvents();
        } catch (e) {
            console.error("Failed to create", e);
        }
    };

    if (error === "Not authenticated") return (
        <div className="text-sm text-text-muted">
            Sign in to view schedule.
        </div>
    );

    if (!loading && error) return <div className="text-sm text-neon-red">Connection interrupted.</div>;

    return (
        <div className="space-y-4">
            {/* Header / Actions */}
            <div className="flex justify-end">
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    aria-label={isCreating ? "Cancel adding event" : "Add new event"}
                    aria-expanded={isCreating}
                    className="text-xs text-primary hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wider font-medium"
                >
                    <Plus className="w-3 h-3" /> {isCreating ? "Cancel" : "Add Event"}
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="bg-white/5 p-3 rounded-lg space-y-2 animate-in slide-in-from-top-2 border border-white/5">
                    <input
                        type="text"
                        placeholder="Event Title"
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-2 text-sm text-white focus:border-primary/50 outline-none placeholder:text-white/20"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        autoFocus
                    />
                    <input
                        type="time"
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-2 text-sm text-white focus:border-primary/50 outline-none placeholder:text-white/20"
                        value={newTime}
                        onChange={e => setNewTime(e.target.value)}
                    />
                    <button type="submit" className="w-full bg-primary/20 hover:bg-primary/40 text-primary text-xs py-2 rounded transition-colors font-medium">
                        Confirm Schedule
                    </button>
                </form>
            )}

            {/* List */}
            {loading ? (
                <div className="text-sm text-text-muted animate-pulse">Scanning timeline...</div>
            ) : events.length === 0 ? (
                <div className="text-sm text-text-muted italic">Timeline clear.</div>
            ) : (
                <div className="space-y-1">
                    {events.map((event) => {
                        const startTime = event.start?.dateTime
                            ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                            : "All Day";

                        return (
                            <div key={event.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded px-2 -mx-2 group">
                                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue group-hover:shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-shadow" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-text-primary truncate">{event.summary || "Untitled Event"}</p>
                                    <p className="text-xs text-text-muted font-mono">{startTime}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
