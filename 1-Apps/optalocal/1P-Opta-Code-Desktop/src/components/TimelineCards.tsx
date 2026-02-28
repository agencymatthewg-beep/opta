import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import type { PermissionRequest, TimelineItem, TurnStats } from "../types";

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
  const planState = useMemo(() => detectPlanState(items), [items]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({
      top: feed.scrollHeight,
      behavior: isStreaming ? "instant" : "smooth",
    });
    // items (not items.length) so the effect re-fires on token merges
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isStreaming]);

  return (
    <section className="timeline-panel">
      <header>
        <h2>{sessionTitle || "Session timeline"}</h2>
        <p className="timeline-meta">
          {sessionId ? `Session ${sessionId}` : "No active session"}
        </p>
        {planState ? (
          <p
            className={`plan-state-badge plan-state-${planState}`}
            aria-label={`Plan state: ${planState === "drift" ? "drift risk" : "up to date"}`}
          >
            {planState === "drift" ? "Plan state: drift risk" : "Plan state: up to date"}
          </p>
        ) : null}
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
          <p className="empty">No timeline events yet. Send a prompt to begin.</p>
        ) : (
          items.map((item) => {
            if (item.kind === "thinking") return <ThinkingCard key={item.id} item={item} />;
            if (item.kind === "tool") return <ToolCard key={item.id} item={item} />;
            if (item.kind === "system") return <SystemCard key={item.id} item={item} />;
            if (item.kind === "assistant") return <AssistantCard key={item.id} item={item} />;
            return <GenericCard key={item.id} item={item} />;
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

// ── Card components ────────────────────────────────────────────────────────

function AssistantCard({ item }: { item: TimelineItem }) {
  return (
    <article className="timeline-card kind-assistant">
      <div className="timeline-meta">
        <span>assistant</span>
        <span>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}</span>
      </div>
      {item.body ? (
        <MarkdownMessage content={item.body} />
      ) : (
        <p className="empty-body">…</p>
      )}
    </article>
  );
}

function ToolCard({ item }: { item: TimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = Boolean(item.body);
  const isResult = item.isToolResult === true;

  return (
    <article className={`timeline-card kind-tool ${isResult ? "tool-result" : "tool-call"}`}>
      <button
        type="button"
        className={`tool-header${hasBody ? "" : " tool-header--static"}`}
        onClick={() => hasBody && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <Terminal size={12} aria-hidden="true" className="tool-icon" />
        <span className="tool-name">{item.title}</span>
        {isResult && <span className="tool-badge">result</span>}
        <span className="timeline-meta tool-time">
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}
        </span>
        {hasBody &&
          (expanded ? (
            <ChevronDown size={12} className="tool-chevron" aria-hidden="true" />
          ) : (
            <ChevronRight size={12} className="tool-chevron" aria-hidden="true" />
          ))}
      </button>
      {expanded && hasBody ? (
        <pre className="tool-body">{item.body}</pre>
      ) : null}
    </article>
  );
}

function SystemCard({ item }: { item: TimelineItem }) {
  const isError = item.title === "Turn error";
  const isDone = item.title === "Turn complete";

  return (
    <article className={`timeline-card kind-system ${isError ? "system-error" : isDone ? "system-done" : ""}`}>
      <div className="system-header">
        {isError ? (
          <XCircle size={13} className="system-icon icon-error" aria-hidden="true" />
        ) : isDone ? (
          <CheckCircle size={13} className="system-icon icon-done" aria-hidden="true" />
        ) : (
          <Zap size={13} className="system-icon" aria-hidden="true" />
        )}
        <span className="system-title">{item.title}</span>
        <span className="timeline-meta system-time">
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}
        </span>
      </div>
      {item.body ? <p className="system-body">{item.body}</p> : null}
      {item.stats ? <TurnStatsRow stats={item.stats} /> : null}
    </article>
  );
}

function TurnStatsRow({ stats }: { stats: TurnStats }) {
  return (
    <div className="turn-stats" aria-label="Turn statistics">
      <span title="Total tokens">{stats.tokens.toLocaleString()} tok</span>
      {stats.speed > 0 && (
        <span title="Token speed">{stats.speed.toFixed(0)} tok/s</span>
      )}
      {stats.elapsed > 0 && (
        <span title="Elapsed time">{(stats.elapsed / 1000).toFixed(1)}s</span>
      )}
      {stats.toolCalls > 0 && (
        <span title="Tool calls">{stats.toolCalls} tool{stats.toolCalls !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
}

function GenericCard({ item }: { item: TimelineItem }) {
  return (
    <article className={`timeline-card kind-${item.kind}`}>
      <div className="timeline-meta">
        <span>{item.kind}</span>
        <span>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}</span>
      </div>
      <h3>{item.title}</h3>
      {item.body ? (
        item.kind === "user" ? (
          <p className="user-body">{item.body}</p>
        ) : (
          <pre className="tool-body">{item.body}</pre>
        )
      ) : null}
    </article>
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
        {expanded ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        <span>Thinking...</span>
        <span>
          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : ""}
        </span>
      </button>
      {expanded && item.body ? (
        <p className="thinking-body">{item.body}</p>
      ) : null}
    </article>
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
        <AlertTriangle className="permission-icon" size={16} aria-hidden="true" />
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

// ── Utilities ──────────────────────────────────────────────────────────────

function detectPlanState(items: TimelineItem[]): "fresh" | "drift" | null {
  const lastPlanIndex = findLastIndex(items, (item) => {
    const content = `${item.title} ${item.body ?? ""}`.toLowerCase();
    return item.kind === "tool" && content.includes("update_plan");
  });

  if (lastPlanIndex < 0) return null;

  const activitySincePlan = items
    .slice(lastPlanIndex + 1)
    .filter(
      (item) =>
        item.kind === "user" ||
        item.kind === "assistant" ||
        item.kind === "tool",
    ).length;

  return activitySincePlan >= 3 ? "drift" : "fresh";
}

function findLastIndex<T>(
  list: T[],
  predicate: (item: T, index: number) => boolean,
): number {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (predicate(list[index], index)) return index;
  }
  return -1;
}
