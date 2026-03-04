/**
 * Mutation helpers — typed write operations for all LMX admin endpoints.
 *
 * Each function posts to the LMX API and returns a typed response.
 * Throws LmxError on failure.
 */

import { lmxDelete, lmxFormPost, lmxPost } from './api'
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
    AgentRun,
    AgentRunCreateRequest,
    AutoDownloadResponse,
    BenchmarkRunRequest,
    BenchmarkRunResponse,
    ConfigReloadResponse,
    ConfirmLoadRequest,
    EmbeddingResponse,
    MCPToolCallRequest,
    MCPToolCallResponse,
    PresetListResponse,
    RagIngestRequest,
    RagIngestResponse,
    RagQueryRequest,
    RagQueryResponse,
    SkillExecuteRequest,
    SkillExecuteResponse,
    SpeechRequest,
    TranscriptionResponse,
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

// ── Audio Services (TTS / STT) ───────────────────────────────────────────────

/**
 * Generate speech audio from text via /v1/audio/speech.
 * Returns a Blob (audio/wav by default) that can be played in the browser.
 */
export async function textToSpeech(request: SpeechRequest): Promise<Blob> {
    const { getLmxUrl, getAdminKey } = await import('./api')
    const url = `${getLmxUrl()}/v1/audio/speech`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = getAdminKey()
    if (key) headers['X-Admin-Key'] = key

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    })
    if (!res.ok) {
        throw new Error(`TTS failed: ${res.status} ${res.statusText}`)
    }
    return res.blob()
}

/**
 * Transcribe audio to text via /v1/audio/transcriptions.
 * Accepts a File or Blob as the audio input.
 */
export async function transcribeAudio(
    audioFile: File | Blob,
    model = 'mlx-whisper/base',
    language?: string
): Promise<TranscriptionResponse> {
    const formData = new FormData()
    formData.append('file', audioFile, 'audio.wav')
    formData.append('model', model)
    if (language) formData.append('language', language)
    return lmxFormPost<TranscriptionResponse>('/v1/audio/transcriptions', formData)
}

// ── RAG & Embeddings ─────────────────────────────────────────────────────────

/** Ingest documents into a RAG collection. */
export async function ingestDocuments(
    request: RagIngestRequest
): Promise<RagIngestResponse> {
    return lmxPost<RagIngestResponse>('/v1/rag/ingest', request)
}

/** Semantic search a RAG collection. */
export async function queryRag(
    request: RagQueryRequest
): Promise<RagQueryResponse> {
    return lmxPost<RagQueryResponse>('/v1/rag/query', request)
}

/** Delete a RAG collection and all its documents. */
export async function deleteRagCollection(
    collection: string
): Promise<{ success: boolean; collection: string; documents_deleted: number }> {
    return lmxDelete<{ success: boolean; collection: string; documents_deleted: number }>(
        `/v1/rag/collections/${encodeURIComponent(collection)}`
    )
}

/** Generate vector embeddings for one or more texts. */
export async function generateEmbedding(
    input: string | string[],
    model?: string
): Promise<EmbeddingResponse> {
    return lmxPost<EmbeddingResponse>('/v1/embeddings', {
        input,
        model: model ?? 'text-embedding-ada-002',
    })
}

// ── Skills & MCP ─────────────────────────────────────────────────────────────

/** Execute a skill by name. */
export async function executeSkill(
    skillName: string,
    args: Record<string, unknown>,
    approved = false,
    timeoutSec?: number
): Promise<SkillExecuteResponse> {
    const body: SkillExecuteRequest = {
        arguments: args,
        approved,
        ...(timeoutSec !== undefined ? { timeout_sec: timeoutSec } : {}),
    }
    return lmxPost<SkillExecuteResponse>(
        `/v1/skills/${encodeURIComponent(skillName)}/execute`,
        body
    )
}

/** Call an MCP tool by name. */
export async function callMcpTool(
    name: string,
    args: Record<string, unknown> = {},
    approved = false
): Promise<MCPToolCallResponse> {
    const body: MCPToolCallRequest = { name, arguments: args, approved }
    return lmxPost<MCPToolCallResponse>('/v1/skills/mcp/call', body)
}

// ── Agent Orchestration ───────────────────────────────────────────────────────

/** Create and start an agent run. Returns immediately with initial run state. */
export async function createAgentRun(
    request: AgentRunCreateRequest
): Promise<AgentRun> {
    return lmxPost<AgentRun>('/v1/agents/runs', request)
}

/** Cancel a queued or running agent run. */
export async function cancelAgentRun(runId: string): Promise<AgentRun> {
    return lmxPost<AgentRun>(`/v1/agents/runs/${encodeURIComponent(runId)}/cancel`)
}

