import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupWizard } from "./SetupWizard";

const invokeNative = vi.fn();

vi.mock("../lib/runtime", () => ({
  invokeNative: (...args: unknown[]) => invokeNative(...args),
  isNativeDesktop: () => false,
}));

vi.mock("../hooks/usePlatform.js", () => ({
  usePlatform: () => "macos",
}));

describe("SetupWizard", () => {
  beforeEach(() => {
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
});
