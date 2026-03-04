import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionMemoryPage } from "./SessionMemoryPage";

const operationsPageSpy = vi.fn();

vi.mock("./OperationsPage", () => ({
  OperationsPage: (props: unknown) => {
    operationsPageSpy(props);
    return <div>mock-operations-page</div>;
  },
}));

describe("SessionMemoryPage", () => {
  it("scopes operations to sessions family", () => {
    render(
      <SessionMemoryPage
        connection={{ host: "127.0.0.1", port: 9999, token: "test-token" }}
      />,
    );

    expect(screen.getByText("mock-operations-page")).toBeInTheDocument();
    expect(operationsPageSpy).toHaveBeenCalledTimes(1);

    const props = operationsPageSpy.mock.calls[0]?.[0] as {
      scopedOperationIds?: string[];
    };
    expect(props.scopedOperationIds).toEqual(["sessions.*"]);
  });
});

