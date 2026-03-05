import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEY,
  loadStoredConnection,
  saveConnection,
} from "./connectionStorage";

const originalLocalStorage = window.localStorage;
const storageBacking = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storageBacking.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storageBacking.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storageBacking.delete(key);
  }),
};

describe("connectionStorage daemon endpoint guardrails", () => {
  beforeEach(() => {
    storageBacking.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("migrates legacy daemon endpoint on LMX port 1234 to local daemon fallback", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        host: "127.0.0.1",
        port: 1234,
        token: "legacy-token",
        protocol: "http",
      }),
    );

    const connection = loadStoredConnection();

    expect(connection.host).toBe("127.0.0.1");
    expect(connection.port).toBe(9999);
    expect(connection.token).toBe("legacy-token");
    expect(connection.protocol).toBe("http");
  });

  it("rejects persisting daemon endpoint 1234 and stores fallback endpoint instead", () => {
    saveConnection(
      {
        host: "localhost",
        port: 1234,
        token: "token",
        protocol: "http",
      },
      true,
    );

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? "{}");

    expect(stored.host).toBe("127.0.0.1");
    expect(stored.port).toBe(9999);
    expect(stored.token).toBe("token");
  });
});
