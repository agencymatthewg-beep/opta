import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CliOperationsPage } from "./CliOperationsPage";

const operationsPageSpy = vi.fn();

vi.mock("./OperationsPage", () => ({
  OperationsPage: (props: unknown) => {
    operationsPageSpy(props);
    return <div>mock-operations-page</div>;
  },
}));

describe("CliOperationsPage", () => {
  it("scopes CLI operations to include models, CEO benchmark, and apps families", () => {
    render(
      <CliOperationsPage
        connection={{ host: "127.0.0.1", port: 8080, token: "token" }}
      />,
    );

    expect(screen.getByText("mock-operations-page")).toBeInTheDocument();
    expect(
      screen.getByText(/Opta CLI remains the primary TUI coding interface/i),
    ).toBeInTheDocument();
    expect(operationsPageSpy).toHaveBeenCalledTimes(1);

    const props = operationsPageSpy.mock.calls[0]?.[0] as {
      scopedOperationIds?: string[];
    };
    expect(props.scopedOperationIds).toEqual(
      expect.arrayContaining(["models.*", "ceo.benchmark", "apps.*"]),
    );
  });
});
