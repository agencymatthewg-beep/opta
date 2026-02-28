import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsPage } from "./OperationsPage";
import { useOperations, type UseOperationsState } from "../hooks/useOperations";

vi.mock("../hooks/useOperations", () => ({
  useOperations: vi.fn(),
}));

vi.mock("../components/OperationRunner", () => ({
  OperationRunner: () => <div>OperationRunner</div>,
}));

const connection = { host: "127.0.0.1", port: 9999, token: "test" };

const baseState: UseOperationsState = {
  operations: [],
  loading: false,
  error: null,
  running: false,
  lastResult: null,
  runOperation: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
};

describe("OperationsPage", () => {
  beforeEach(() => {
    vi.mocked(useOperations).mockReturnValue({
      ...baseState,
      operations: [
        {
          id: "doctor",
          title: "Doctor",
          description: "Diagnostics",
          safety: "read",
        },
        {
          id: "env.list",
          title: "Environment List",
          description: "List envs",
          safety: "read",
        },
        {
          id: "env.save",
          title: "Environment Save",
          description: "Save env",
          safety: "write",
        },
      ],
    });
  });

  it("groups operations by family and shows safety counts", () => {
    render(<OperationsPage connection={connection} />);

    expect(screen.getByText("doctor (1)")).toBeInTheDocument();
    expect(screen.getByText("env (2)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "all (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "read (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "write (1)" })).toBeInTheDocument();
  });

  it("filters operations by search query", () => {
    render(<OperationsPage connection={connection} />);

    fireEvent.change(screen.getByLabelText("Search operations"), {
      target: { value: "save" },
    });

    expect(screen.getByText("env.save")).toBeInTheDocument();
    expect(screen.queryByText("env.list")).not.toBeInTheDocument();
    expect(screen.queryByText("doctor")).not.toBeInTheDocument();
  });
});
