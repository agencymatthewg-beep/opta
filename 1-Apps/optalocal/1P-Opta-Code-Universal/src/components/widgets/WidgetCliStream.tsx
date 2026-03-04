import { useEffect, useRef } from "react";

interface CliEvent {
    timestamp: string;
    source: string;
    message: string;
    color?: string;
}

interface WidgetCliStreamProps {
    rawEvents: unknown[];
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

export function WidgetCliStream({ rawEvents }: WidgetCliStreamProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [rawEvents.length]);

    const events = rawEvents.slice(-50).map(parseEvent);

    return (
        <div className="widget-cli-stream">
            <div className="widget-header">
                <span className="widget-title">
                    <svg
                        className="widget-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    OPTA CLI LOGS
                </span>
            </div>
            <div className="cli-terminal" ref={scrollRef}>
                {events.length === 0 ? (
                    <div className="cli-empty">Waiting for events...</div>
                ) : (
                    events.map((evt, i) => (
                        <div key={i} className="cli-line">
                            {evt.timestamp && (
                                <span className="cli-time">
                                    {evt.timestamp.slice(11, 19) || evt.timestamp}
                                </span>
                            )}
                            <span
                                className="cli-source"
                                style={{ color: SOURCE_COLORS[evt.source] ?? "var(--opta-text-muted)" }}
                            >
                                [{evt.source}]
                            </span>
                            <span className="cli-msg">{evt.message}</span>
                        </div>
                    ))
                )}
                <div className="cli-prompt">
                    <span className="cli-prompt-char">❯</span>
                    <input
                        type="text"
                        className="cli-prompt-input"
                        placeholder="Type a CLI command..."
                        readOnly
                    />
                </div>
            </div>
        </div>
    );
}
