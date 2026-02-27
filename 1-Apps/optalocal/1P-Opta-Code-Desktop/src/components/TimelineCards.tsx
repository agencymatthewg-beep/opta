import type { TimelineItem } from "../types";

interface TimelineCardsProps {
  sessionId: string | null;
  sessionTitle?: string;
  items: TimelineItem[];
}

export function TimelineCards({
  sessionId,
  sessionTitle,
  items,
}: TimelineCardsProps) {
  return (
    <section className="timeline-panel">
      <header>
        <h2>{sessionTitle || "Session timeline"}</h2>
        <p>{sessionId ? `Session ${sessionId}` : "No active session"}</p>
      </header>

      <div className="timeline-feed">
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
              {item.body ? <p>{item.body}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
