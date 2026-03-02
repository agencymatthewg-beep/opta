import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelsPage } from "./ModelsPage";
import { useModels, type UseModelsResult } from "../hooks/useModels";

vi.mock("../hooks/useModels", () => ({
  useModels: vi.fn(),
}));

const connection = { host: "127.0.0.1", port: 8080, token: "token" };
const modelId = "mlx-community/Qwen2.5-7B-Instruct-4bit";

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
});
