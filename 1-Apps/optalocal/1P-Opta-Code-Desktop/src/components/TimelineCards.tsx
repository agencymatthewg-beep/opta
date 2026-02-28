import { useEffect, useRef, useState } from "react";
import type { PermissionRequest, TimelineItem } from "../types";

interface TimelineCardsProps {
  sessionId: string | null;
  sessionTitle?: string;
  items: TimelineItem[];
  isStreaming?: boolean;
  pendingPermissions?: PermissionRequest[];
  onResolvePermission?: (requestId: string, decision: "allow" | "deny") => void;
}

export function TimelineCards({
  sessionId,
  sessionTitle,
  items,
  isStreaming = false,
  pendingPermissions = [],
  onResolvePermission,
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

      {pendingPermissions.length > 0 && (
        <div className="permission-queue" aria-label="Pending permissions">
          {pendingPermissions.map((req) => (
            <PermissionCard
              key={req.requestId}
              permission={req}
              onResolve={onResolvePermission}
            />
          ))}
        </div>
      )}

      <div className="timeline-feed" ref={feedRef}>
        {items.length === 0 ? (
          <p className="empty">
            No timeline events yet. Send a prompt to begin.
          </p>
        ) : (
          items.map((item) => {
            if (item.kind === "thinking") {
              return <ThinkingCard key={item.id} item={item} />;
            }
            return (
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
            );
          })
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

function PermissionCard({
  permission,
  onResolve,
}: {
  permission: PermissionRequest;
  onResolve?: (requestId: string, decision: "allow" | "deny") => void;
}) {
  return (
    <div className="permission-card" role="alert">
      <div className="permission-header">
        <span className="permission-icon">⚠</span>
        <strong>Permission Required</strong>
      </div>
      <dl className="permission-details">
        <div>
          <dt>Tool</dt>
          <dd>{permission.toolName || "unknown"}</dd>
        </div>
        {Object.keys(permission.args).length > 0 && (
          <div>
            <dt>Args</dt>
            <dd>
              <pre>{JSON.stringify(permission.args, null, 2).slice(0, 300)}</pre>
            </dd>
          </div>
        )}
      </dl>
      {onResolve && (
        <div className="permission-actions">
          <button
            type="button"
            className="permission-allow"
            onClick={() => onResolve(permission.requestId, "allow")}
          >
            Allow
          </button>
          <button
            type="button"
            className="permission-deny"
            onClick={() => onResolve(permission.requestId, "deny")}
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}

function ThinkingCard({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="timeline-card kind-thinking">
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span>Thinking...</span>
        <span>
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}
        </span>
      </button>
      {expanded && item.body ? <p className="thinking-body">{item.body}</p> : null}
    </article>
  );
}
