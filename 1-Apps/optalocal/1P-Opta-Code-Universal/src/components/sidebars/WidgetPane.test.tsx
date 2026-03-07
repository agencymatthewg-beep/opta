import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { WidgetPane } from "./WidgetPane";

const slots = [
  { id: "s1", widgetId: "cli-stream" as const, size: "M" as const },
  { id: "s2", widgetId: "atpo" as const, size: "M" as const },
];

it("calls onMoveWidget when tile is dragged and dropped", () => {
  const onMove = vi.fn();
  render(
    <WidgetPane
      slots={slots}
      isEditing={true}
      onToggleEdit={vi.fn()}
      onRemoveWidget={vi.fn()}
      onAddWidget={vi.fn()}
      onMoveWidget={onMove}
      timelineItems={[]}
      rawEvents={[]}
    />
  );
  const tiles = screen.getAllByRole("listitem");
  fireEvent.dragStart(tiles[0]!);
  fireEvent.dragOver(tiles[1]!);
  fireEvent.drop(tiles[1]!);
  expect(onMove).toHaveBeenCalledWith(0, 1);
});
