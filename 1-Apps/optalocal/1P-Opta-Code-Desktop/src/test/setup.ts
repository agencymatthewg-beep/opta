import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

if (!("scrollTo" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}
