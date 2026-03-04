import type { WidgetSlot, WidgetId, TimelineItem, DaemonConnectionOptions } from "../types";
import { WidgetAtpo } from "./widgets/WidgetAtpo";
import { WidgetCliStream } from "./widgets/WidgetCliStream";
import { WidgetGitDiff } from "./widgets/WidgetGitDiff";

interface WidgetPaneProps {
    slots: WidgetSlot[];
    isEditing: boolean;
    onToggleEdit: () => void;
    onRemoveWidget: (slotId: string) => void;
    onAddWidget: (widgetId: WidgetId) => void;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
    designMode?: string; // TEMP for prototyping
    openSettings?: (tab: string) => void; // TEMP for prototyping
    connection?: DaemonConnectionOptions;
    sessionId?: string | null;
}

export function WidgetContent(props: {
    widgetId: WidgetId;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
    designMode?: string;
    connection?: DaemonConnectionOptions;
    sessionId?: string | null;
}) {
    const { widgetId, timelineItems, rawEvents, designMode, connection, sessionId } = props;
    switch (widgetId) {
        case "atpo":
            return <WidgetAtpo timelineItems={timelineItems} designMode={designMode} />;
        case "cli-stream":
            return <WidgetCliStream rawEvents={rawEvents} designMode={designMode} />;
        case "git-diff":
            return <WidgetGitDiff connection={connection} sessionId={sessionId} />;
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
    timelineItems,
    rawEvents,
    designMode = "0",
    openSettings,
    connection,
    sessionId,
}: WidgetPaneProps) {
    const hasWidgets = slots.length > 0;

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
                {slots.map((slot) => (
                    <div
                        key={slot.id}
                        className={`wp-tile wp-tile-${slot.size.toLowerCase()} ${designMode === "3" ? "wp-tile-bento" : ""}`}
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
                            />
                        )}
                    </div>
                ))}

                {isEditing && (
                    <>
                        <button
                            className="wp-add-slot"
                            onClick={() => onAddWidget("atpo")}
                            type="button"
                        >
                            + ATPO
                        </button>
                        <button
                            className="wp-add-slot"
                            onClick={() => onAddWidget("git-diff")}
                            type="button"
                        >
                            + DIFF
                        </button>
                        <button
                            className="wp-add-slot wp-add-slot-wide"
                            onClick={() => onAddWidget("cli-stream")}
                            type="button"
                        >
                            + CLI
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
}
