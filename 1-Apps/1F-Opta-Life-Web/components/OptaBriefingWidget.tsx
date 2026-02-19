"use client";

import { useEffect, useState } from "react";
import { Sparkles, Calendar, Mail, CheckCircle2, Clock } from "lucide-react";
import { getCalendarEventsForDays, getUnreadEmails } from "@/lib/actions";
import { useTasks } from "@/contextsHooks/TaskContext";

type BriefingData = {
    tasksPending: number;
    tasksCompleted: number;
    upcomingEvents: { summary: string; time: string }[];
    unreadEmails: number;
    timeOfDay: "morning" | "afternoon" | "evening";
};

export function OptaBriefingWidget() {
    const [briefing, setBriefing] = useState<BriefingData | null>(null);
    const [loading, setLoading] = useState(true);
    const { tasks } = useTasks();

    useEffect(() => {
        async function loadBriefing() {
            setLoading(true);

            const hour = new Date().getHours();
            const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

            // Fetch calendar and email data
            const [calendarResult, emailResult] = await Promise.all([
                getCalendarEventsForDays(3).catch(() => null),
                getUnreadEmails().catch(() => null),
            ]);

            const upcomingEvents: { summary: string; time: string }[] = [];
            if (calendarResult && "success" in calendarResult) {
                calendarResult.events.slice(0, 3).forEach((event) => {
                    const startTime = event.start?.dateTime || event.start?.date;
                    const time = startTime
                        ? new Date(startTime).toLocaleDateString("en-US", {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit",
                          })
                        : "TBD";
                    upcomingEvents.push({
                        summary: event.summary || "Untitled",
                        time,
                    });
                });
            }

            const unreadEmails =
                emailResult && "success" in emailResult ? emailResult.emails.length : 0;

            const tasksPending = tasks.filter((t) => !t.completed).length;
            const tasksCompleted = tasks.filter((t) => t.completed).length;

            setBriefing({
                tasksPending,
                tasksCompleted,
                upcomingEvents,
                unreadEmails,
                timeOfDay,
            });
            setLoading(false);
        }

        loadBriefing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks.length]);

    const getGreeting = () => {
        if (!briefing) return "";
        const greetings = {
            morning: "Good morning",
            afternoon: "Good afternoon",
            evening: "Good evening",
        };
        return greetings[briefing.timeOfDay];
    };

    const getPriorityInsight = () => {
        if (!briefing) return "";

        if (briefing.tasksPending === 0 && briefing.upcomingEvents.length === 0) {
            return "Your day is clear. Time for deep work or new goals.";
        }

        if (briefing.tasksPending > 5) {
            return `High task load detected. Consider prioritizing your ${briefing.tasksPending} pending items.`;
        }

        if (briefing.upcomingEvents.length > 0) {
            return `Next up: ${briefing.upcomingEvents[0].summary} on ${briefing.upcomingEvents[0].time}`;
        }

        if (briefing.unreadEmails > 3) {
            return `${briefing.unreadEmails} unread emails await your attention.`;
        }

        return "All systems nominal. You're in control.";
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-primary/20" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 bg-white/10 rounded w-3/4" />
                        <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Greeting Header */}
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold bg-gradient-to-br from-white to-primary/50 bg-clip-text text-transparent tracking-tight">
                        {getGreeting()}, Matthew
                    </h3>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed font-light">
                        {getPriorityInsight()}
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                {/* Tasks */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 text-text-muted mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Tasks</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-mono text-neon-green">{briefing?.tasksCompleted || 0}</span>
                        <span className="text-xs text-text-muted">/ {(briefing?.tasksCompleted || 0) + (briefing?.tasksPending || 0)}</span>
                    </div>
                </div>

                {/* Events */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-neon-blue/20 transition-colors">
                    <div className="flex items-center gap-2 text-text-muted mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Events</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-mono text-neon-blue">{briefing?.upcomingEvents.length || 0}</span>
                        <span className="text-xs text-text-muted">upcoming</span>
                    </div>
                </div>

                {/* Emails */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-neon-amber/20 transition-colors">
                    <div className="flex items-center gap-2 text-text-muted mb-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Inbox</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-mono text-neon-amber">{briefing?.unreadEmails || 0}</span>
                        <span className="text-xs text-text-muted">unread</span>
                    </div>
                </div>
            </div>

            {/* Upcoming Events List */}
            {briefing && briefing.upcomingEvents.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Coming Up</span>
                    </div>
                    <div className="space-y-1.5">
                        {briefing.upcomingEvents.slice(0, 3).map((event, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between py-2 px-3 bg-white/[0.03] rounded-lg border border-white/5"
                            >
                                <span className="text-sm text-text-primary truncate flex-1 mr-2">
                                    {event.summary}
                                </span>
                                <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                                    {event.time}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Status Indicator */}
            <div className="flex items-center gap-2 pt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                    Opta Intelligence • Active
                </span>
            </div>
        </div>
    );
}
