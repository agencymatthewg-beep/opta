import { useRef, useState } from "react";
import type { WidgetSlot, WidgetId, TimelineItem, DaemonConnectionOptions } from "../../types";
import type { ConnectionHealthState } from "../../hooks/useConnectionHealth";
import { WIDGET_REGISTRY } from "../widgets/WIDGET_REGISTRY";
import { WidgetAtpo } from "../widgets/WidgetAtpo";
import { WidgetCliStream } from "../widgets/WidgetCliStream";
import { WidgetGitDiff } from "../widgets/WidgetGitDiff";
import { WidgetLmxStatus } from "../widgets/WidgetLmxStatus";
import { WidgetContextBar } from "../widgets/WidgetContextBar";
import { WidgetActiveTool } from "../widgets/WidgetActiveTool";
import { WidgetSessionMemory } from "../widgets/WidgetSessionMemory";
import { WidgetModelSwitcher } from "../widgets/WidgetModelSwitcher";
import { WidgetLatencySparkline } from "../widgets/WidgetLatencySparkline";
import { WidgetDaemonRing } from "../widgets/WidgetDaemonRing";
import { WidgetCommandBar } from "../widgets/WidgetCommandBar";

interface WidgetPaneProps {
    slots: WidgetSlot[];
    isEditing: boolean;
    onToggleEdit: () => void;
    onRemoveWidget: (slotId: string) => void;
    onAddWidget: (widgetId: WidgetId) => void;
    onMoveWidget: (fromIndex: number, toIndex: number) => void;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
    designMode?: string; // TEMP for prototyping
    openSettings?: (tab: string) => void; // TEMP for prototyping
    connection?: DaemonConnectionOptions;
    sessionId?: string | null;
    connectionHealth?: ConnectionHealthState | null;
    projectCwd?: string | null;
}

export function WidgetContent(props: {
    widgetId: WidgetId;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
    designMode?: string;
    connection?: DaemonConnectionOptions;
    sessionId?: string | null;
    connectionHealth?: ConnectionHealthState | null;
    projectCwd?: string | null;
}) {
    const { widgetId, timelineItems, rawEvents, designMode, connection, sessionId, connectionHealth, projectCwd } = props;
    switch (widgetId) {
        case "atpo":
            return <WidgetAtpo timelineItems={timelineItems} designMode={designMode} />;
        case "cli-stream":
            return <WidgetCliStream rawEvents={rawEvents} designMode={designMode} />;
        case "git-diff":
            return <WidgetGitDiff connection={connection} sessionId={sessionId} />;
        case "lmx-status":
            return <WidgetLmxStatus connection={connection ?? null} />;
        case "context-bar":
            return <WidgetContextBar timelineItems={timelineItems} />;
        case "active-tool":
            return <WidgetActiveTool rawEvents={rawEvents} />;
        case "session-memory":
            return <WidgetSessionMemory timelineItems={timelineItems} />;
        case "model-switcher":
            return <WidgetModelSwitcher connection={connection ?? null} />;
        case "latency-sparkline":
            return <WidgetLatencySparkline timelineItems={timelineItems} />;
        case "daemon-ring":
            return <WidgetDaemonRing health={connectionHealth ?? null} />;
        case "command-bar":
            return <WidgetCommandBar />;
        default:
            return (
                <div className="widget-placeholder">
                    <span className="widget-header">
                        <span className="widget-title">{widgetId.toUpperCase()}</span>
                    </span>
                    <span className="widget-placeholder-text">Coming soon</span>
                </div>
            );
    }
}

export function WidgetPane({
    slots,
    isEditing,
    onToggleEdit,
    onRemoveWidget,
    onAddWidget,
    onMoveWidget,
    timelineItems,
    rawEvents,
    designMode = "0",
    openSettings,
    connection,
    sessionId,
    connectionHealth,
    projectCwd,
}: WidgetPaneProps) {
    const hasWidgets = slots.length > 0;

    const dragSourceRef = useRef<number | null>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        dragSourceRef.current = index;
        setDraggingIndex(index);
    };
    const handleDragEnd = () => {
        setDraggingIndex(null);
        setDragOverIndex(null);
        dragSourceRef.current = null;
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    const handleDragEnter = (index: number) => {
        setDragOverIndex(index);
    };
    const handleDragLeave = () => {
        setDragOverIndex(null);
    };
    const handleDrop = (toIndex: number) => {
        if (dragSourceRef.current !== null && dragSourceRef.current !== toIndex) {
            onMoveWidget(dragSourceRef.current, toIndex);
        }
        dragSourceRef.current = null;
        setDraggingIndex(null);
        setDragOverIndex(null);
    };

    if (!hasWidgets && !isEditing) {
        return null; // Collapsed — chat takes full width
    }

    return (
        <aside className={`widget-pane ${!hasWidgets && !isEditing ? "widget-pane-collapsed" : ""}`}>
            <div className="wp-controls">
                {/* Concept 2 puts accounts here */}
                {designMode === "2" && openSettings && (
                    <button type="button" className="v1-app-btn" onClick={() => openSettings("connection")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--opta-primary-glow)" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>ACCOUNTS</span>
                    </button>
                )}

                {/* Default, Concept 2 have Customise Tiles here. Concept 1 and 3 move it elsewhere. */}
                {(designMode === "0" || designMode === "2") && (
                    <button
                        className={`wp-edit-btn ${isEditing ? "wp-edit-active" : ""}`}
                        onClick={onToggleEdit}
                        type="button"
                    >
                        {isEditing ? "DONE EDITING" : "Customise Tiles"}
                    </button>
                )}
            </div>

            <div className={`wp-grid ${isEditing ? "wp-grid-editing" : ""}`}>
                {slots.map((slot, index) => (
                    <div
                        key={slot.id}
                        className={`wp-tile wp-tile-${slot.size.toLowerCase()} ${designMode === "3" ? "wp-tile-bento" : ""} ${draggingIndex === index ? "wp-tile-dragging" : ""} ${dragOverIndex === index && draggingIndex !== index ? "wp-tile-drag-over" : ""}`}
                        role="listitem"
                        draggable={isEditing}
                        onDragStart={() => handleDragStart(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(index)}
                    >
                        {isEditing && (
                            <button
                                className="wp-tile-remove"
                                onClick={() => onRemoveWidget(slot.id)}
                                type="button"
                            >
                                ✕
                            </button>
                        )}
                        {slot.widgetId && (
                            <WidgetContent
                                widgetId={slot.widgetId}
                                timelineItems={timelineItems}
                                rawEvents={rawEvents}
                                designMode={designMode}
                                connection={connection}
                                sessionId={sessionId}
                                connectionHealth={connectionHealth}
                                projectCwd={projectCwd}
                            />
                        )}
                    </div>
                ))}

                {isEditing && (
                    <div className="wp-catalog">
                        <div className="wp-catalog-label">ADD WIDGET</div>
                        {WIDGET_REGISTRY.map((meta) => {
                            const alreadyAdded = slots.some((s) => s.widgetId === meta.id);
                            return (
                                <button
                                    key={meta.id}
                                    className={`wp-catalog-btn ${alreadyAdded ? "wp-catalog-btn--added" : ""}`}
                                    onClick={() => onAddWidget(meta.id)}
                                    type="button"
                                    title={meta.description}
                                    disabled={alreadyAdded}
                                >
                                    <span className="wp-catalog-btn-name">{meta.label}</span>
                                    {alreadyAdded && <span className="wp-catalog-btn-check">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}
