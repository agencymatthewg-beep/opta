import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SystemOperationsPage } from "./SystemOperationsPage";

const operationsPageSpy = vi.fn();
const daemonPanelSpy = vi.fn();

vi.mock("./OperationsPage", () => ({
  OperationsPage: (props: unknown) => {
    operationsPageSpy(props);
    return <div>mock-operations-page</div>;
  },
}));

vi.mock("../components/sidebars/DaemonPanel", () => ({
  DaemonPanel: (props: unknown) => {
    daemonPanelSpy(props);
    return <div>mock-daemon-panel</div>;
  },
}));

describe("SystemOperationsPage", () => {
  it("renders daemon panel and scopes system operation families", () => {
    const onOpenCliBridge = vi.fn();
    render(
      <SystemOperationsPage
        connection={{ host: "127.0.0.1", port: 9999, token: "test-token" }}
        connectionState="connected"
        onOpenCliBridge={onOpenCliBridge}
      />,
    );

    expect(screen.getByText("mock-daemon-panel")).toBeInTheDocument();
    expect(screen.getByText("mock-operations-page")).toBeInTheDocument();
    expect(daemonPanelSpy).toHaveBeenCalledTimes(1);
    expect(operationsPageSpy).toHaveBeenCalledTimes(1);

    const daemonProps = daemonPanelSpy.mock.calls[0]?.[0] as {
      onOpenDaemonOperations?: () => void;
    };
    expect(daemonProps.onOpenDaemonOperations).toBe(onOpenCliBridge);

    const operationProps = operationsPageSpy.mock.calls[0]?.[0] as {
      scopedOperationIds?: string[];
    };
    expect(operationProps.scopedOperationIds).toEqual(
      expect.arrayContaining([
        "doctor",
        "version.check",
        "completions.generate",
        "daemon.*",
        "serve.*",
        "browser.*",
        "init.run",
        "update.run",
        "onboard.apply",
        "keychain.*",
      ]),
    );
  });
});
