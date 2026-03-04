import type { WidgetSlot, WidgetId, TimelineItem } from "../types";
import { WidgetAtpo } from "./widgets/WidgetAtpo";
import { WidgetCliStream } from "./widgets/WidgetCliStream";

interface WidgetPaneProps {
    slots: WidgetSlot[];
    isEditing: boolean;
    onToggleEdit: () => void;
    onRemoveWidget: (slotId: string) => void;
    onAddWidget: (widgetId: WidgetId) => void;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
}

function WidgetContent({
    widgetId,
    timelineItems,
    rawEvents,
}: {
    widgetId: WidgetId;
    timelineItems: TimelineItem[];
    rawEvents: unknown[];
}) {
    switch (widgetId) {
        case "atpo":
            return <WidgetAtpo timelineItems={timelineItems} />;
        case "cli-stream":
            return <WidgetCliStream rawEvents={rawEvents} />;
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
}: WidgetPaneProps) {
    const hasWidgets = slots.length > 0;

    if (!hasWidgets && !isEditing) {
        return null; // Collapsed — chat takes full width
    }

    return (
        <aside className={`widget-pane ${!hasWidgets && !isEditing ? "widget-pane-collapsed" : ""}`}>
            <div className="wp-controls">
                <button
                    className={`wp-edit-btn ${isEditing ? "wp-edit-active" : ""}`}
                    onClick={onToggleEdit}
                    type="button"
                >
                    {isEditing ? "DONE EDITING" : "Customise Tiles"}
                </button>
            </div>

            <div className={`wp-grid ${isEditing ? "wp-grid-editing" : ""}`}>
                {slots.map((slot) => (
                    <div
                        key={slot.id}
                        className={`wp-tile wp-tile-${slot.size.toLowerCase()}`}
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
                            +
                        </button>
                        <button
                            className="wp-add-slot wp-add-slot-wide"
                            onClick={() => onAddWidget("cli-stream")}
                            type="button"
                        >
                            +
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
}
