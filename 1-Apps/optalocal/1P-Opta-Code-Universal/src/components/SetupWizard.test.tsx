import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

const invokeNative = vi.fn();
const runtimeState = { native: false };

vi.mock("../lib/runtime", () => ({
  invokeNative: (...args: unknown[]) => invokeNative(...args),
  isNativeDesktop: () => runtimeState.native,
}));

vi.mock("../hooks/usePlatform.js", () => ({
  usePlatform: () => "macos",
}));

describe("SetupWizard", () => {
  beforeEach(() => {
    runtimeState.native = false;
    invokeNative.mockReset();
    invokeNative.mockRejectedValue(new Error("not available"));
  });

  it("walks through steps and completes launch", async () => {
    const onComplete = vi.fn();

    render(<SetupWizard onComplete={onComplete} />);

    expect(screen.getByText(/your local ai/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/choose a provider/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /cloud api/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/preferences/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    expect(screen.getByText(/you're all set/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /launch opta/i }));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });

  it("blocks completion when native save fails and allows retry", async () => {
    runtimeState.native = true;
    invokeNative.mockImplementation((command: string) => {
      if (command === "get_config_dir") return Promise.resolve("/tmp/opta");
      if (command === "save_setup_config") {
        return Promise.reject(new Error("write failed"));
      }
      return Promise.reject(new Error(`unexpected command: ${command}`));
    });

    const onComplete = vi.fn();
    render(<SetupWizard onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));

    const launchButton = screen.getByRole("button", { name: /launch opta/i });
    fireEvent.click(launchButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(/write failed/i);
    expect(onComplete).not.toHaveBeenCalled();

    await waitFor(() => expect(launchButton).not.toBeDisabled());
    fireEvent.click(launchButton);
    await waitFor(() => {
      expect(invokeNative).toHaveBeenCalledWith(
        "save_setup_config",
        expect.any(Object),
      );
    });
    expect(invokeNative).toHaveBeenCalledTimes(3);
  });
});
