import { useEffect, useRef } from "react";

interface CliEvent {
    timestamp: string;
    source: string;
    message: string;
}

interface WidgetCliStreamProps {
    rawEvents: unknown[];
    designMode?: string;
}

const SOURCE_COLORS: Record<string, string> = {
    daemon: "var(--opta-neon-cyan)",
    "lmx-router": "var(--opta-neon-green)",
    "tool/invoke": "var(--opta-primary)",
    "agent/chunk": "var(--opta-neon-blue, #3b82f6)",
    "fs/watch": "var(--opta-neon-amber)",
};

function parseEvent(raw: unknown): CliEvent {
    if (typeof raw === "string") {
        return { timestamp: "", source: "system", message: raw };
    }
    if (raw && typeof raw === "object" && "event" in raw) {
        const evt = raw as Record<string, unknown>;
        return {
            timestamp: String(evt.ts ?? evt.timestamp ?? ""),
            source: String(evt.event ?? evt.source ?? "system"),
            message: String(evt.data ?? evt.message ?? JSON.stringify(raw)),
        };
    }
    return { timestamp: "", source: "system", message: JSON.stringify(raw) };
}

export function WidgetCliStream({ rawEvents, designMode = "3" }: WidgetCliStreamProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [rawEvents.length]);

    const events = rawEvents.slice(-50).map(parseEvent);

    return (
        <div className={`widget-bento-card widget-bento-card--cli dm-cli-${designMode}`}>
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
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    Opta CLI Logs
                </div>
            </div>

            {/* Mac-style console */}
            <div className="cli-bento-console" ref={scrollRef}>
                <div className="cli-bento-dots">
                    <span className="cli-dot cli-dot--red" />
                    <span className="cli-dot cli-dot--yellow" />
                    <span className="cli-dot cli-dot--green" />
                </div>
                <div className="cli-bento-body">
                    {events.length === 0 ? (
                        <div className="cli-bento-empty">Waiting for events...</div>
                    ) : (
                        events.map((evt, i) => (
                            <div key={i} className="cli-bento-line">
                                {evt.timestamp && (
                                    <span className="cli-bento-time">
                                        {evt.timestamp.slice(11, 19) || evt.timestamp}
                                    </span>
                                )}
                                <span
                                    className="cli-bento-source"
                                    style={{ color: SOURCE_COLORS[evt.source] ?? "var(--opta-text-muted)" }}
                                >
                                    [{evt.source}]
                                </span>
                                <span className="cli-bento-msg">{evt.message}</span>
                            </div>
                        ))
                    )}
                </div>
                <div className="cli-bento-input-row">
                    <span className="cli-bento-prompt">❯</span>
                    <input
                        type="text"
                        className="cli-bento-input"
                        placeholder="Type a CLI command..."
                        readOnly
                    />
                </div>
            </div>
        </div>
    );
}
