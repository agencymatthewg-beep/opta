import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationRunner } from "./OperationRunner";
import type { OperationDefinition } from "../hooks/useOperations";

const readOp: OperationDefinition = {
  id: "env.list",
  title: "Environment Profiles List",
  description: "List configured environment profiles.",
  safety: "read",
};

const dangerousOp: OperationDefinition = {
  id: "benchmark",
  title: "Benchmark Suite",
  description: "Generate benchmark suite artifacts.",
  safety: "dangerous",
};

const schemaOp: OperationDefinition = {
  id: "env.create",
  title: "Environment Create",
  description: "Create a profile from schema fields.",
  safety: "write",
  inputSchema: {
    type: "object",
    required: ["name", "enabled"],
    properties: {
      name: { type: "string", title: "name" },
      count: { type: "integer", title: "count" },
      enabled: { type: "boolean", title: "enabled" },
      profile: {
        type: "string",
        title: "profile",
        enum: ["dev", "prod"],
      },
    },
  },
};

describe("OperationRunner", () => {
  it("renders the operation title, description, and safety badge", () => {
    render(
      <OperationRunner
        operation={readOp}
        running={false}
        lastResult={null}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByText("Environment Profiles List")).toBeInTheDocument();
    expect(
      screen.getByText("List configured environment profiles."),
    ).toBeInTheDocument();
    expect(screen.getByText("read")).toBeInTheDocument();
  });

  it("calls onRun with parsed JSON input on submit", async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    render(
      <OperationRunner
        operation={readOp}
        running={false}
        lastResult={null}
        onRun={onRun}
      />,
    );

    const textarea = screen.getByLabelText("Operation input JSON");
    fireEvent.change(textarea, { target: { value: '{"name":"prod"}' } });

    fireEvent.click(screen.getByRole("button", { name: /Run env\.list/ }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith(
        "env.list",
        { name: "prod" },
        undefined,
      ),
    );
  });

  it("shows parse error for invalid JSON and does not call onRun", async () => {
    const onRun = vi.fn();
    render(
      <OperationRunner
        operation={readOp}
        running={false}
        lastResult={null}
        onRun={onRun}
      />,
    );

    const textarea = screen.getByLabelText("Operation input JSON");
    fireEvent.change(textarea, { target: { value: "{bad json}" } });
    fireEvent.click(screen.getByRole("button", { name: /Run/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(onRun).not.toHaveBeenCalled();
  });

  it("renders schema-derived fields for object JSON schema inputs", () => {
    render(
      <OperationRunner
        operation={schemaOp}
        running={false}
        lastResult={null}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("name")).toBeInTheDocument();
    expect(screen.getByLabelText("count")).toBeInTheDocument();
    expect(screen.getByLabelText("enabled")).toBeInTheDocument();
    expect(screen.getByLabelText("profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Use raw JSON input")).toBeInTheDocument();
  });

  it("submits schema form values as structured input", async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    render(
      <OperationRunner
        operation={schemaOp}
        running={false}
        lastResult={null}
        onRun={onRun}
      />,
    );

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "prod-profile" },
    });
    fireEvent.change(screen.getByLabelText("count"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByLabelText("enabled"));
    fireEvent.change(screen.getByLabelText("profile"), {
      target: { value: "prod" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Run env\.create/ }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith(
        "env.create",
        {
          name: "prod-profile",
          count: 3,
          enabled: true,
          profile: "prod",
        },
        undefined,
      ),
    );
  });

  it("falls back to raw JSON input when selected", async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);
    render(
      <OperationRunner
        operation={schemaOp}
        running={false}
        lastResult={null}
        onRun={onRun}
      />,
    );

    fireEvent.click(screen.getByLabelText("Use raw JSON input"));
    fireEvent.change(screen.getByLabelText("Operation input JSON"), {
      target: { value: '{"name":"json","enabled":true}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /Run env\.create/ }));

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith(
        "env.create",
        { name: "json", enabled: true },
        undefined,
      ),
    );
  });

  it("shows dangerous confirm checkbox for dangerous operations", () => {
    render(
      <OperationRunner
        operation={dangerousOp}
        running={false}
        lastResult={null}
        onRun={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Confirm dangerous operation"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Run benchmark/ }),
    ).toBeDisabled();
  });

  it("enables run button after dangerous checkbox is checked", () => {
    render(
      <OperationRunner
        operation={dangerousOp}
        running={false}
        lastResult={null}
        onRun={vi.fn()}
      />,
    );

    const checkbox = screen.getByLabelText("Confirm dangerous operation");
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: /Run benchmark/ })).toBeEnabled();
  });

  it("renders success result panel", () => {
    render(
      <OperationRunner
        operation={readOp}
        running={false}
        lastResult={{
          ok: true,
          id: "env.list",
          safety: "read",
          result: { profiles: [] },
        }}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Operation result")).toBeInTheDocument();
    expect(screen.getByText(/✓ Success/)).toBeInTheDocument();
  });

  it("renders error result panel", () => {
    render(
      <OperationRunner
        operation={dangerousOp}
        running={false}
        lastResult={{
          ok: false,
          id: "benchmark",
          safety: "dangerous",
          error: { code: "dangerous_confirmation_required", message: "Confirm first" },
        }}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByText(/✗ Error/)).toBeInTheDocument();
    expect(screen.getByText(/dangerous_confirmation_required/)).toBeInTheDocument();
  });
});
