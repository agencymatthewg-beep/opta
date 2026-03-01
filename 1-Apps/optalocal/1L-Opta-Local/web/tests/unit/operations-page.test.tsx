import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/ConnectionProvider", () => ({
  useConnectionContextSafe: () => null,
}));

vi.mock("@/lib/opta-daemon-client", () => ({
  OptaDaemonClient: class MockOptaDaemonClient {},
}));

import OperationsPage from "@/app/operations/page";

const originalDaemonUrl = process.env.NEXT_PUBLIC_OPTA_DAEMON_URL;
const originalDaemonToken = process.env.NEXT_PUBLIC_OPTA_DAEMON_TOKEN;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_OPTA_DAEMON_URL;
  delete process.env.NEXT_PUBLIC_OPTA_DAEMON_TOKEN;
});

afterEach(() => {
  cleanup();
  process.env.NEXT_PUBLIC_OPTA_DAEMON_URL = originalDaemonUrl;
  process.env.NEXT_PUBLIC_OPTA_DAEMON_TOKEN = originalDaemonToken;
});

describe("OperationsPage", () => {
  it("renders the page header", () => {
    render(<OperationsPage />);
    expect(screen.getByRole("heading", { name: /operations/i })).toBeTruthy();
  });

  it("shows daemon configuration guidance when token/url are missing", () => {
    render(<OperationsPage />);
    expect(screen.getByText(/daemon configuration required/i)).toBeTruthy();
  });
});
