import type { TimelineItem } from "../../types";

interface WidgetAtpoProps {
    timelineItems: TimelineItem[];
}

export function WidgetAtpo({ timelineItems, designMode = "0" }: WidgetAtpoProps & { designMode?: string }) {
    // Derive plan phases from timeline events
    const planEvents = timelineItems.filter(
        (item) =>
            item.kind === "event" &&
            (item.title.toLowerCase().includes("plan") ||
                item.title.toLowerCase().includes("phase")),
    );

    const phases = [
        { name: "1. Read existing config", done: true },
        { name: "2. Refactor client", active: true },
        { name: "3. Verification", done: false },
    ];

    const completedCount = phases.filter((p) => p.done).length;
    const progressPct = Math.round(
        ((completedCount + (phases.find((p) => p.active) ? 0.5 : 0)) / phases.length) * 100,
    );

    return (
        <div className={`widget-atpo dm-atpo-${designMode}`}>
            <div className="widget-header">
                <span className="widget-title">
                    <svg
                        className="widget-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    ATPO PLAN
                </span>
            </div>
            {phases.map((phase) => (
                <div
                    key={phase.name}
                    className={`atpo-phase ${phase.active ? "atpo-phase-active" : ""}`}
                >
                    {phase.done ? "✓" : phase.active ? <span className="atpo-dot" /> : "○"}{" "}
                    {phase.name}
                </div>
            ))}
            <div className="widget-progress-bar">
                <div className="widget-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
        </div>
    );
}
