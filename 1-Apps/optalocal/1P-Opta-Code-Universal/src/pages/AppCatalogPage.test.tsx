import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppCatalogPage } from "./AppCatalogPage";

const operationsPageSpy = vi.fn();

vi.mock("./OperationsPage", () => ({
  OperationsPage: (props: unknown) => {
    operationsPageSpy(props);
    return <div>mock-operations-page</div>;
  },
}));

describe("AppCatalogPage", () => {
  it("scopes operations to apps family", () => {
    render(
      <AppCatalogPage
        connection={{ host: "127.0.0.1", port: 9999, token: "test-token" }}
      />,
    );

    expect(screen.getByText("mock-operations-page")).toBeInTheDocument();
    expect(operationsPageSpy).toHaveBeenCalledTimes(1);

    const props = operationsPageSpy.mock.calls[0]?.[0] as {
      scopedOperationIds?: string[];
    };
    expect(props.scopedOperationIds).toEqual(["apps.*"]);
  });
});

