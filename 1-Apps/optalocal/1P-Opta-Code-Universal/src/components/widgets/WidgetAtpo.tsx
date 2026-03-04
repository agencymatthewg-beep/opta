import type { TimelineItem } from "../../types";

interface WidgetAtpoProps {
    timelineItems: TimelineItem[];
    designMode?: string;
}

export function WidgetAtpo({ timelineItems, designMode = "3" }: WidgetAtpoProps) {
    const phases = (() => {
        const planItems = timelineItems.filter(
            (item) =>
                item.kind === "event" &&
                (item.title.toLowerCase().includes("plan") ||
                    item.title.toLowerCase().includes("phase")),
        );

        // If we have real timeline items, derive phases from them
        if (planItems.length > 0) {
            return planItems.slice(0, 3).map((item, i) => ({
                name: item.title,
                done: i < planItems.length - 1,
                active: i === planItems.length - 1,
                shortName: item.title.split(" ").slice(0, 2).join(" "),
            }));
        }

        // Default demo phases
        return [
            { name: "Read existing config", done: true, active: false, shortName: "Read Config" },
            { name: "Refactor client", done: false, active: true, shortName: "Refactor" },
            { name: "Verification", done: false, active: false, shortName: "Verify" },
        ];
    })();

    const activeIndex = phases.findIndex((p) => p.active);
    const fillPercent = phases.length > 1
        ? (activeIndex / (phases.length - 1)) * 100
        : 0;

    return (
        <div className={`widget-bento-card dm-atpo-${designMode}`}>
            {/* Bento Header */}
            <div className="bento-card-header">
                <div className="bento-card-title">
                    <svg
                        className="bento-card-icon"
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
                    ATPO Plan
                </div>
                {phases.some((p) => p.active) && (
                    <span className="bento-badge">IN PROGRESS</span>
                )}
            </div>

            {/* Horizontal Stepper */}
            <div className="atpo-bento-stepper">
                <div className="atpo-bento-line" />
                <div
                    className="atpo-bento-line-fill"
                    style={{ width: `${fillPercent}%` }}
                />
                {phases.map((phase, i) => (
                    <div
                        key={phase.name}
                        className={`atpo-bento-step ${phase.done ? "done" : ""} ${phase.active ? "active" : ""}`}
                    >
                        {phase.done ? "✓" : i + 1}
                    </div>
                ))}
            </div>
            <div className="atpo-bento-labels">
                {phases.map((phase) => (
                    <span key={phase.name} className={phase.active ? "atpo-label-active" : ""}>
                        {phase.shortName}
                    </span>
                ))}
            </div>
        </div>
    );
}
