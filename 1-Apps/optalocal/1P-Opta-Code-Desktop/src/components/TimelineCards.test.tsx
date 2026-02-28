import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineCards } from "./TimelineCards";
import type { TimelineItem } from "../types";

function item(partial: Partial<TimelineItem>): TimelineItem {
  return {
    id: partial.id ?? Math.random().toString(36),
    kind: partial.kind ?? "assistant",
    title: partial.title ?? "item",
    body: partial.body,
    createdAt: partial.createdAt,
  };
}

describe("TimelineCards", () => {
  it("shows plan state as up to date when update_plan is recent", () => {
    render(
      <TimelineCards
        sessionId="sess_1"
        items={[
          item({ id: "1", kind: "tool", title: "Tool: update_plan" }),
          item({ id: "2", kind: "assistant", title: "Assistant", body: "ready" }),
        ]}
      />,
    );

    expect(screen.getByText("Plan state: up to date")).toBeInTheDocument();
  });

  it("shows plan drift risk after substantial activity since last plan update", () => {
    render(
      <TimelineCards
        sessionId="sess_2"
        items={[
          item({ id: "1", kind: "tool", title: "Tool: update_plan" }),
          item({ id: "2", kind: "assistant", title: "Assistant", body: "A" }),
          item({ id: "3", kind: "user", title: "Prompt", body: "B" }),
          item({ id: "4", kind: "assistant", title: "Assistant", body: "C" }),
          item({ id: "5", kind: "tool", title: "Tool: shell", body: "D" }),
        ]}
      />,
    );

    expect(screen.getByText("Plan state: drift risk")).toBeInTheDocument();
  });
});
