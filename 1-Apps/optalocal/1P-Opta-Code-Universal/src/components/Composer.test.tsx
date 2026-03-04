import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

function renderComposer(
  overrides?: Partial<{
    value: string;
    disabled: boolean;
    isStreaming: boolean;
    onCancel: () => void;
  }>,
) {
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  const onModeChange = vi.fn();
  render(
    <Composer
      value="run this task"
      onChange={onChange}
      onSubmit={onSubmit}
      mode="chat"
      onModeChange={onModeChange}
      {...overrides}
    />,
  );
  return { onSubmit, onChange, onModeChange };
}

describe("Composer", () => {
  it("submits undefined overrides when no turn controls are set", () => {
    const { onSubmit } = renderComposer();
    fireEvent.click(screen.getByTitle("Send (Cmd+Enter)"));
    expect(onSubmit).toHaveBeenCalledWith(undefined);
  });

  it("submits all extended turn overrides when controls are enabled", () => {
    const { onSubmit } = renderComposer();

    // Open the advanced overrides panel first
    fireEvent.click(screen.getByTitle("Override model, provider, autonomy"));

    // Select overrides using the new (shorter) title strings
    fireEvent.change(screen.getByTitle("Override provider"), {
      target: { value: "anthropic" },
    });
    fireEvent.change(screen.getByTitle("Override model"), {
      target: { value: "gpt-4o" },
    });
    fireEvent.change(screen.getByTitle("Override output format"), {
      target: { value: "json" },
    });

    // Toggle flag buttons (exact text as rendered in Composer.tsx)
    fireEvent.click(screen.getByText("Auto (skip edit approvals)"));
    fireEvent.click(screen.getByText("No Commit"));
    fireEvent.click(screen.getByText("No Checkpoints"));
    fireEvent.click(screen.getByText("⚡ L4 Autonomy"));

    fireEvent.click(screen.getByTitle("Send (Cmd+Enter)"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        model: "gpt-4o",
        format: "json",
        auto: true,
        noCommit: true,
        noCheckpoints: true,
        dangerous: true,
      }),
    );
  });
});
