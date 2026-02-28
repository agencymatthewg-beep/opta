import { useEffect, useRef } from "react";
import type { TimelineItem } from "../types";

interface TimelineCardsProps {
  sessionId: string | null;
  sessionTitle?: string;
  items: TimelineItem[];
  isStreaming?: boolean;
}

export function TimelineCards({
  sessionId,
  sessionTitle,
  items,
  isStreaming = false,
}: TimelineCardsProps) {
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  return (
    <section className="timeline-panel">
      <header>
        <h2>{sessionTitle || "Session timeline"}</h2>
        <p>{sessionId ? `Session ${sessionId}` : "No active session"}</p>
      </header>

      <div className="timeline-feed" ref={feedRef}>
        {items.length === 0 ? (
          <p className="empty">
            No timeline events yet. Send a prompt to begin.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={`timeline-card kind-${item.kind}`}
            >
              <div className="timeline-meta">
                <span>{item.kind}</span>
                <span>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString()
                    : ""}
                </span>
              </div>
              <h3>{item.title}</h3>
              {item.body ? (
                item.kind === "tool" ? (
                  <pre className="tool-body">{item.body}</pre>
                ) : (
                  <p>{item.body}</p>
                )
              ) : null}
            </article>
          ))
        )}

        {isStreaming ? (
          <div className="streaming-indicator" aria-label="Receiving response">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
    </section>
  );
}
