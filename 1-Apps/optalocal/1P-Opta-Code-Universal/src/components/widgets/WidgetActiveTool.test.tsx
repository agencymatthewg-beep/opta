import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { WidgetActiveTool } from "./WidgetActiveTool";

it("shows tool name when tool is running", () => {
  const rawEvents = [
    { event: "tool.start", data: "read_file", ts: "2026-03-07T00:00:01Z" },
  ];
  render(<WidgetActiveTool rawEvents={rawEvents} />);
  expect(screen.getByText("read_file")).toBeInTheDocument();
  expect(screen.getByText("RUNNING")).toBeInTheDocument();
});

it("shows idle when no active tool", () => {
  const rawEvents = [
    { event: "tool.start", data: "run_command", ts: "2026-03-07T00:00:01Z" },
    { event: "tool.end", data: "run_command", ts: "2026-03-07T00:00:02Z" },
  ];
  render(<WidgetActiveTool rawEvents={rawEvents} />);
  expect(screen.getByText("Idle")).toBeInTheDocument();
  expect(screen.queryByText("RUNNING")).not.toBeInTheDocument();
});
