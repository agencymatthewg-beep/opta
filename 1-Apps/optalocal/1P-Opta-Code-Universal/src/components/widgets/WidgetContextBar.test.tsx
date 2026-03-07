import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { WidgetContextBar } from "./WidgetContextBar";
import type { TimelineItem } from "../../types";

const makeItem = (tokens: number): TimelineItem => ({
  id: "1", kind: "system", title: "turn.done", stats: { tokens, speed: 20, elapsed: 1000, toolCalls: 0 },
});

it("shows token count and progress bar", () => {
  render(<WidgetContextBar timelineItems={[makeItem(8000), makeItem(6000)]} contextLimit={32000} />);
  expect(screen.getByText(/14,000/)).toBeInTheDocument();
  expect(screen.getByText(/32,000/)).toBeInTheDocument();
});

it("shows amber warning at 70% capacity", () => {
  render(<WidgetContextBar timelineItems={[makeItem(23000)]} contextLimit={32000} />);
  expect(screen.getByText("NEAR LIMIT")).toBeInTheDocument();
});
