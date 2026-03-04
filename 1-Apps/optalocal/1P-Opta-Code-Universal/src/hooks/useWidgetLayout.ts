import { useCallback, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { WidgetId, WidgetLayout, WidgetSize, WidgetSlot } from "../types";

const DEFAULT_SLOTS: WidgetSlot[] = [
    { id: "slot-1", widgetId: "atpo", size: "M" },
    { id: "slot-2", widgetId: "cli-stream", size: "T" },
];

function storageKey(projectId: string) {
    return `opta:widget-layout:${projectId}`;
}

export function useWidgetLayout(projectId: string) {
    const [layout, setLayout] = useLocalStorage<WidgetLayout>(
        storageKey(projectId),
        { projectId, slots: DEFAULT_SLOTS },
    );
    const [isEditing, setIsEditing] = useState(false);

    const toggleEditMode = useCallback(() => {
        setIsEditing((prev) => !prev);
    }, []);

    const addWidget = useCallback(
        (widgetId: WidgetId, size: WidgetSize = "M") => {
            const slot: WidgetSlot = {
                id: `slot-${Date.now()}`,
                widgetId,
                size,
            };
            setLayout((prev) => ({
                ...prev,
                slots: [...prev.slots, slot],
            }));
        },
        [setLayout],
    );

    const removeWidget = useCallback(
        (slotId: string) => {
            setLayout((prev) => ({
                ...prev,
                slots: prev.slots.filter((s) => s.id !== slotId),
            }));
        },
        [setLayout],
    );

    const moveWidget = useCallback(
        (fromIndex: number, toIndex: number) => {
            setLayout((prev) => {
                const next = [...prev.slots];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return { ...prev, slots: next };
            });
        },
        [setLayout],
    );

    const hasWidgets = layout.slots.length > 0;

    return {
        layout,
        isEditing,
        toggleEditMode,
        addWidget,
        removeWidget,
        moveWidget,
        hasWidgets,
    };
}
