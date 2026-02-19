"use client";

import { useEffect, useState } from "react";
import {
    Lightbulb,
    Calendar,
    Target,
    Coffee,
    Moon,
    Sun,
    Zap,
    Brain,
    TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
}

function getTimeBasedInsights(): Insight[] {
    const hour = new Date().getHours();
    const insights: Insight[] = [];

    // Morning insights (5-12)
    if (hour >= 5 && hour < 12) {
        insights.push({
            id: "morning-focus",
            icon: <Sun className="w-4 h-4" />,
            title: "Peak Focus Time",
            description: "Morning hours are ideal for deep work. Tackle your most challenging tasks now.",
            color: "neon-amber"
        });
        if (hour < 9) {
            insights.push({
                id: "morning-routine",
                icon: <Coffee className="w-4 h-4" />,
                title: "Morning Routine",
                description: "Start your day right. Review your calendar and set top 3 priorities.",
                color: "neon-amber"
            });
        }
    }

    // Afternoon insights (12-17)
    if (hour >= 12 && hour < 17) {
        insights.push({
            id: "afternoon-slump",
            icon: <Zap className="w-4 h-4" />,
            title: "Energy Management",
            description: "Afternoon dip is normal. Take a short walk or switch to lighter tasks.",
            color: "neon-cyan"
        });
        if (hour >= 14 && hour < 16) {
            insights.push({
                id: "meeting-time",
                icon: <Calendar className="w-4 h-4" />,
                title: "Collaboration Window",
                description: "Mid-afternoon is great for meetings and collaborative work.",
                color: "neon-blue"
            });
        }
    }

    // Evening insights (17-22)
    if (hour >= 17 && hour < 22) {
        insights.push({
            id: "evening-review",
            icon: <Target className="w-4 h-4" />,
            title: "Daily Review",
            description: "Reflect on today's accomplishments and prep tomorrow's priorities.",
            color: "neon-purple"
        });
    }

    // Night insights (22-5)
    if (hour >= 22 || hour < 5) {
        insights.push({
            id: "wind-down",
            icon: <Moon className="w-4 h-4" />,
            title: "Wind Down Time",
            description: "Quality rest improves tomorrow's productivity. Consider wrapping up.",
            color: "neon-purple"
        });
    }

    return insights;
}

function getDayOfWeekInsights(): Insight[] {
    const day = new Date().getDay();
    const insights: Insight[] = [];

    if (day === 1) {
        insights.push({
            id: "monday-planning",
            icon: <Calendar className="w-4 h-4" />,
            title: "Week Planning",
            description: "Set your weekly goals and review what's ahead.",
            color: "neon-blue"
        });
    }

    if (day === 5) {
        insights.push({
            id: "friday-review",
            icon: <TrendingUp className="w-4 h-4" />,
            title: "Week in Review",
            description: "Celebrate wins from this week. Clear the deck for next week.",
            color: "neon-green"
        });
    }

    if (day === 0 || day === 6) {
        insights.push({
            id: "weekend-recharge",
            icon: <Brain className="w-4 h-4" />,
            title: "Recharge Mode",
            description: "Weekend rest fuels weekday productivity. Balance work and life.",
            color: "neon-purple"
        });
    }

    return insights;
}

export function SmartInsightsWidget() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showSeconds, setShowSeconds] = useState(false);

    useEffect(() => {
        // Update time every second
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Update insights based on time
        const updateInsights = () => {
            const timeInsights = getTimeBasedInsights();
            const dayInsights = getDayOfWeekInsights();
            setInsights([...timeInsights, ...dayInsights].slice(0, 3));
        };

        updateInsights();
        // Refresh insights every 15 minutes
        const insightInterval = setInterval(updateInsights, 15 * 60 * 1000);

        return () => {
            clearInterval(timeInterval);
            clearInterval(insightInterval);
        };
    }, []);

    // Format time parts separately for animation
    const hours = currentTime.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).split(" ")[0];
    const minutes = currentTime.toLocaleTimeString("en-US", { minute: "2-digit" }).padStart(2, "0");
    const seconds = currentTime.toLocaleTimeString("en-US", { second: "2-digit" }).padStart(2, "0");
    const ampm = currentTime.getHours() >= 12 ? "PM" : "AM";

    const dateString = currentTime.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric"
    });

    return (
        <div className="space-y-4">
            {/* Current Time Display - Opta Hero Typography with Animated Seconds */}
            <div
                className="text-center py-3 cursor-default select-none"
                onMouseEnter={() => setShowSeconds(true)}
                onMouseLeave={() => setShowSeconds(false)}
            >
                <div className="inline-flex items-baseline justify-center">
                    <span className="text-4xl font-bold tracking-[0.15em] bg-gradient-to-br from-white to-primary-glow bg-clip-text text-transparent">
                        {hours}:{minutes}
                    </span>
                    {/* Animated seconds container */}
                    <span
                        className={cn(
                            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                            showSeconds
                                ? "max-w-[5rem] opacity-100"
                                : "max-w-0 opacity-0"
                        )}
                    >
                        <span className="text-4xl font-bold tracking-[0.15em] bg-gradient-to-br from-white to-primary-glow bg-clip-text text-transparent">
                            :{seconds}
                        </span>
                    </span>
                    <span className="ml-1.5 text-lg font-bold tracking-[0.15em] bg-gradient-to-br from-white/70 to-primary-glow/70 bg-clip-text text-transparent">
                        {ampm}
                    </span>
                </div>
                <p className="text-xs text-text-muted mt-1 uppercase tracking-[0.2em]">{dateString}</p>
            </div>

            {/* Smart Insights */}
            <div className="space-y-2">
                {insights.map((insight) => (
                    <div
                        key={insight.id}
                        className={cn(
                            "p-3 rounded-lg border transition-colors",
                            `bg-${insight.color}/5 border-${insight.color}/20`
                        )}
                        style={{
                            backgroundColor: `var(--${insight.color}, hsl(var(--primary))) / 0.05`,
                            borderColor: `var(--${insight.color}, hsl(var(--primary))) / 0.2`
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "p-1.5 rounded-md",
                                insight.color === "neon-amber" && "bg-neon-amber/20 text-neon-amber",
                                insight.color === "neon-cyan" && "bg-neon-cyan/20 text-neon-cyan",
                                insight.color === "neon-blue" && "bg-neon-blue/20 text-neon-blue",
                                insight.color === "neon-purple" && "bg-neon-purple/20 text-neon-purple",
                                insight.color === "neon-green" && "bg-neon-green/20 text-neon-green"
                            )}>
                                {insight.icon}
                            </div>
                            <div>
                                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                                    {insight.title}
                                </h4>
                                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                                    {insight.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Productivity Tip */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-neon-purple/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em]">
                        Pro Tip
                    </span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                    Use the AI assistant to quickly create events and tasks. Just describe what you need in natural language.
                </p>
            </div>
        </div>
    );
}
