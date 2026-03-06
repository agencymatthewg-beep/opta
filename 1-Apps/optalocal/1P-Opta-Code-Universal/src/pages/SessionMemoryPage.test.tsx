import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionMemoryPage } from "./SessionMemoryPage";

vi.mock("../hooks/useSessionsManager", () => ({
  useSessionsManager: () => ({
    results: [],
    totalCount: 0,
    searching: false,
    exporting: false,
    deleting: false,
    error: null,
    search: vi.fn(),
    exportSession: vi.fn(),
    deleteSession: vi.fn(),
    clearResults: vi.fn(),
  }),
}));

describe("SessionMemoryPage", () => {
  it("renders search bar and empty state", () => {
    render(
      <SessionMemoryPage
        connection={{ host: "127.0.0.1", port: 9999, token: "test-token" }}
      />,
    );

    expect(
      screen.getByPlaceholderText(/search sessions/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });
});
