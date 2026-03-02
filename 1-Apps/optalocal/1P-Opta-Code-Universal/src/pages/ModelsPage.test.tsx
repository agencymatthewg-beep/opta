import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "./ModelsPage";
import { useModels, type UseModelsResult } from "../hooks/useModels";

vi.mock("../hooks/useModels", () => ({
  useModels: vi.fn(),
}));

const connection = { host: "127.0.0.1", port: 8080, token: "token" };
const modelId = "mlx-community/Qwen2.5-7B-Instruct-4bit";
const trackedDownloadsStorage =
  "opta:lmx:tracked-downloads:http://127.0.0.1:8080";
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

function createUseModelsState(
  overrides: Partial<UseModelsResult> = {},
): UseModelsResult {
  return {
    lmxStatus: null,
    loadedModels: [],
    availableModels: [{ model_id: modelId, size_bytes: 1024 }],
    memory: null,
    lmxReachable: true,
    loading: false,
    error: null,
    loadModel: vi.fn().mockResolvedValue(null),
    confirmLoad: vi.fn().mockResolvedValue(null),
    downloadProgress: vi.fn().mockResolvedValue(null),
    listDownloads: vi.fn().mockResolvedValue([]),
    unloadModel: vi.fn().mockResolvedValue(undefined),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    downloadModel: vi.fn().mockResolvedValue(null),
    refreshLmx: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ModelsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    storageBacking.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
    window.localStorage.removeItem(trackedDownloadsStorage);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("confirms download-required loads, polls progress, and refreshes on completion", async () => {
    const loadModel = vi.fn().mockResolvedValue({
      model_id: modelId,
      status: "download_required",
      confirmation_token: "confirm-token-123",
      message: "Model requires download. Continue?",
    });
    const confirmLoad = vi.fn().mockResolvedValue({
      model_id: modelId,
      status: "downloading",
      download_id: "download-123",
      message: "Download started",
    });
    const downloadProgress = vi
      .fn()
      .mockResolvedValue({
        download_id: "download-123",
        repo_id: modelId,
        status: "completed",
        progress_percent: 100,
        downloaded_bytes: 1000,
        total_bytes: 1000,
        files_completed: 4,
        files_total: 4,
      });
    const refreshLmx = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useModels).mockReturnValue(
      createUseModelsState({
        loadModel,
        confirmLoad,
        downloadProgress,
        refreshLmx,
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ModelsPage connection={connection} />);

    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        "Model requires download. Continue?",
      );
    });
    await waitFor(() => {
      expect(confirmLoad).toHaveBeenCalledWith("confirm-token-123");
    });
    await waitFor(() => {
      expect(downloadProgress).toHaveBeenCalledWith("download-123");
    });

    await waitFor(() => {
      expect(
        screen.getByText(`Download complete · ${modelId}`),
      ).toBeInTheDocument();
    });
    expect(refreshLmx).toHaveBeenCalledTimes(1);
  });

  it("shows cancellation notice and does not confirm when user rejects download confirmation", async () => {
    const loadModel = vi.fn().mockResolvedValue({
      model_id: modelId,
      status: "download_required",
      confirmation_token: "confirm-token-123",
      message: "Model requires download. Continue?",
    });
    const confirmLoad = vi.fn().mockResolvedValue(null);
    const downloadProgress = vi.fn().mockResolvedValue(null);

    vi.mocked(useModels).mockReturnValue(
      createUseModelsState({
        loadModel,
        confirmLoad,
        downloadProgress,
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ModelsPage connection={connection} />);

    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        "Model requires download. Continue?",
      );
    });
    expect(confirmLoad).not.toHaveBeenCalled();
    expect(downloadProgress).not.toHaveBeenCalled();
    expect(
      await screen.findByText(`Download cancelled for ${modelId}`),
    ).toBeInTheDocument();
  });

  it("rehydrates tracked downloads and reconciles completion when model appears on disk", async () => {
    window.localStorage.setItem(
      trackedDownloadsStorage,
      JSON.stringify({
        "download-restore-1": {
          download_id: "download-restore-1",
          model_id: modelId,
          repo_id: modelId,
          status: "downloading",
          progress_percent: 52,
          downloaded_bytes: 520,
          total_bytes: 1000,
          files_completed: 5,
          files_total: 10,
        },
      }),
    );

    const downloadProgress = vi.fn().mockResolvedValue(null);
    const refreshLmx = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useModels).mockReturnValue(
      createUseModelsState({
        downloadProgress,
        refreshLmx,
        availableModels: [{ model_id: modelId, size_bytes: 1024 }],
      }),
    );

    render(<ModelsPage connection={connection} />);

    await waitFor(() => {
      expect(downloadProgress).toHaveBeenCalledWith("download-restore-1");
    });
    await waitFor(() => {
      expect(
        screen.getByText(`Download complete · ${modelId}`),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(window.localStorage.getItem(trackedDownloadsStorage)).toBe("{}");
    });
    expect(refreshLmx).toHaveBeenCalled();
  });

  it("merges server active downloads with local tracked state and prefers server values", async () => {
    window.localStorage.setItem(
      trackedDownloadsStorage,
      JSON.stringify({
        "download-conflict": {
          download_id: "download-conflict",
          model_id: modelId,
          repo_id: modelId,
          status: "pending",
          progress_percent: 10,
          downloaded_bytes: 100,
          total_bytes: 1000,
          files_completed: 1,
          files_total: 10,
        },
        "download-local-only": {
          download_id: "download-local-only",
          model_id: "mlx-community/local-only",
          repo_id: "mlx-community/local-only",
          status: "downloading",
          progress_percent: 21,
          downloaded_bytes: 210,
          total_bytes: 1000,
          files_completed: 2,
          files_total: 10,
        },
      }),
    );

    const listDownloads = vi.fn().mockResolvedValue([
      {
        download_id: "download-conflict",
        repo_id: modelId,
        status: "downloading",
        progress_percent: 68,
        downloaded_bytes: 680,
        total_bytes: 1000,
        files_completed: 7,
        files_total: 10,
      },
      {
        download_id: "download-server-only",
        repo_id: "mlx-community/server-only",
        status: "downloading",
        progress_percent: 15,
        downloaded_bytes: 150,
        total_bytes: 1000,
        files_completed: 1,
        files_total: 10,
      },
    ]);
    const downloadProgress = vi.fn().mockImplementation(async (downloadId: string) => {
      if (downloadId === "download-conflict") {
        return {
          download_id: "download-conflict",
          repo_id: modelId,
          status: "downloading",
          progress_percent: 68,
          downloaded_bytes: 680,
          total_bytes: 1000,
          files_completed: 7,
          files_total: 10,
        };
      }
      if (downloadId === "download-server-only") {
        return {
          download_id: "download-server-only",
          repo_id: "mlx-community/server-only",
          status: "downloading",
          progress_percent: 15,
          downloaded_bytes: 150,
          total_bytes: 1000,
          files_completed: 1,
          files_total: 10,
        };
      }
      if (downloadId === "download-local-only") {
        return {
          download_id: "download-local-only",
          repo_id: "mlx-community/local-only",
          status: "downloading",
          progress_percent: 21,
          downloaded_bytes: 210,
          total_bytes: 1000,
          files_completed: 2,
          files_total: 10,
        };
      }
      return null;
    });

    vi.mocked(useModels).mockReturnValue(
      createUseModelsState({
        availableModels: [],
        listDownloads,
        downloadProgress,
      }),
    );

    render(<ModelsPage connection={connection} />);

    await waitFor(() => {
      expect(listDownloads).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const tracked = JSON.parse(
        window.localStorage.getItem(trackedDownloadsStorage) ?? "{}",
      ) as Record<string, { progress_percent: number; status: string }>;
      expect(Object.keys(tracked)).toEqual(
        expect.arrayContaining([
          "download-conflict",
          "download-local-only",
          "download-server-only",
        ]),
      );
      expect(tracked["download-conflict"].progress_percent).toBe(68);
      expect(tracked["download-conflict"].status).toBe("downloading");
    });
    await waitFor(() => {
      expect(downloadProgress).toHaveBeenCalledWith("download-conflict");
      expect(downloadProgress).toHaveBeenCalledWith("download-local-only");
      expect(downloadProgress).toHaveBeenCalledWith("download-server-only");
    });
  });
});
