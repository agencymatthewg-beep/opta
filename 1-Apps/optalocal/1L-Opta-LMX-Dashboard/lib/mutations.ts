/**
 * Mutation helpers — typed write operations for all LMX admin endpoints.
 *
 * Each function posts to the LMX API and returns a typed response.
 * Throws LmxError on failure.
 */

import { lmxDelete, lmxPost } from './api'
import type {
    AdminAutotuneRequest,
    AdminAutotuneResponse,
    AdminDeleteResponse,
    AdminDownloadRequest,
    AdminDownloadResponse,
    AdminLoadRequest,
    AdminLoadResponse,
    AdminProbeRequest,
    AdminProbeResponse,
    AdminUnloadResponse,
    AutoDownloadResponse,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    ConfigReloadResponse,
    ConfirmLoadRequest,
    PresetListResponse,
} from './types'

// ── Model Lifecycle ─────────────────────────────────────────────────────────

/**
 * Load a model into memory.
 * Returns AdminLoadResponse on immediate load, or AutoDownloadResponse
 * when a download confirmation is needed (202).
 */
export async function loadModel(
    request: AdminLoadRequest
): Promise<AdminLoadResponse | AutoDownloadResponse> {
    return lmxPost<AdminLoadResponse | AutoDownloadResponse>(
        '/admin/models/load',
        request
    )
}

/** Unload a model and free memory. */
export async function unloadModel(modelId: string): Promise<AdminUnloadResponse> {
    return lmxPost<AdminUnloadResponse>('/admin/models/unload', {
        model_id: modelId,
    })
}

/** Delete a model from disk. Must be unloaded first. */
export async function deleteModel(modelId: string): Promise<AdminDeleteResponse> {
    return lmxDelete<AdminDeleteResponse>(
        `/admin/models/${encodeURIComponent(modelId)}`
    )
}

/** Start an async model download from HuggingFace Hub. */
export async function downloadModel(
    request: AdminDownloadRequest
): Promise<AdminDownloadResponse> {
    return lmxPost<AdminDownloadResponse>('/admin/models/download', request)
}

/** Confirm a pending download and start download + auto-load. */
export async function confirmAndLoad(
    request: ConfirmLoadRequest
): Promise<AutoDownloadResponse> {
    return lmxPost<AutoDownloadResponse>('/admin/models/load/confirm', request)
}

/** Probe candidate backends for a model without loading. */
export async function probeModel(
    request: AdminProbeRequest
): Promise<AdminProbeResponse> {
    return lmxPost<AdminProbeResponse>('/admin/models/probe', request)
}

/** Run autotune benchmark and persist best profile. */
export async function autotuneModel(
    request: AdminAutotuneRequest
): Promise<AdminAutotuneResponse> {
    return lmxPost<AdminAutotuneResponse>('/admin/models/autotune', request)
}

// ── System ──────────────────────────────────────────────────────────────────

/** Hot-reload configuration from disk. */
export async function reloadConfig(): Promise<ConfigReloadResponse> {
    return lmxPost<ConfigReloadResponse>('/admin/config/reload')
}

/** Re-read preset files from disk. */
export async function reloadPresets(): Promise<PresetListResponse> {
    return lmxPost<PresetListResponse>('/admin/presets/reload')
}

// ── Benchmark ───────────────────────────────────────────────────────────────

/** Run a performance benchmark against a loaded model. */
export async function runBenchmark(
    request: BenchmarkRunRequest
): Promise<BenchmarkRunResponse> {
    return lmxPost<BenchmarkRunResponse>('/admin/benchmark/run', request)
}

// ── Sessions ────────────────────────────────────────────────────────────────

/** Delete a session by ID. */
export async function deleteSession(
    sessionId: string
): Promise<{ deleted: boolean }> {
    return lmxDelete<{ deleted: boolean }>(`/sessions/${sessionId}`)
}

// ── Quantization ────────────────────────────────────────────────────────────

/** Start a quantization job. */
export async function startQuantize(
    body: { model_id: string; bits?: number; output_path?: string }
): Promise<{ job_id: string; status: string }> {
    return lmxPost<{ job_id: string; status: string }>(
        '/admin/quantize',
        body
    )
}

/** Cancel a quantization job. */
export async function cancelQuantize(
    jobId: string
): Promise<{ cancelled: boolean }> {
    return lmxPost<{ cancelled: boolean }>(`/admin/quantize/${jobId}/cancel`)
}
