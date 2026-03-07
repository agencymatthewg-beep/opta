import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Activity } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

it("renders title and badge", () => {
  render(
    <WidgetShell icon={<Activity size={14} />} title="Active Tool" badge="RUNNING" accentVar="--opta-neon-cyan">
      <span>content</span>
    </WidgetShell>
  );
  expect(screen.getByText("Active Tool")).toBeInTheDocument();
  expect(screen.getByText("RUNNING")).toBeInTheDocument();
  expect(screen.getByText("content")).toBeInTheDocument();
});

it("renders without badge", () => {
  render(
    <WidgetShell icon={<Activity size={14} />} title="Active Tool">
      <span>content</span>
    </WidgetShell>
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
