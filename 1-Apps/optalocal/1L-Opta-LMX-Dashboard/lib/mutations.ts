/**
 * Mutation helpers — typed write operations for all LMX admin endpoints.
 *
 * Each function posts to the LMX API and returns a typed response.
 * Throws LmxError on failure.
 */

import {
    enqueueDeviceCommand,
    getDeviceCommandStatus,
    type DeviceCommandMethod,
    type DeviceCommandPayload,
    type DeviceCommandStatus,
} from './accounts-control-plane'
import { LmxError, lmxDelete, lmxFormPost, lmxPost } from './api'
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
    MCPPromptGetRequest,
    MCPPromptGetResponse,
    MCPResourceReadRequest,
    MCPResourceReadResponse,
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

const STORAGE_KEY_PAIRED_STATE = 'opta-lmx-paired-state'
const COMMAND_POLL_INTERVAL_MS = 1_200
const COMMAND_POLL_TIMEOUT_MS = 90_000

type PersistedPairedState = {
    mode?: 'paired' | 'direct'
    session?: {
        id?: string
        deviceId?: string | null
    } | null
    bridgeToken?: string | null
    bridgeStatus?: {
        status?: string
    } | null
}

interface CommandChannelContext {
    sessionId: string
    deviceId: string
    bridgeToken: string | null
}

function readRecord(value: unknown): Record<string, unknown> | null {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }
    return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readCommandChannelContext(): CommandChannelContext | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_PAIRED_STATE)
        if (!raw) return null
        const parsed = JSON.parse(raw) as PersistedPairedState
        if (parsed.mode !== 'paired') return null
        if (parsed.bridgeStatus?.status !== 'connected') return null
        const sessionId = parsed.session?.id
        const deviceId = parsed.session?.deviceId
        if (!sessionId || !deviceId) return null
        return {
            sessionId,
            deviceId,
            bridgeToken: parsed.bridgeToken ?? null,
        }
    } catch {
        return null
    }
}

function normalizeCommandState(status: string): string {
    return status.trim().toLowerCase()
}

function isCommandComplete(status: string): boolean {
    return status === 'completed' || status === 'succeeded' || status === 'success'
}

function isCommandFailed(status: string): boolean {
    return [
        'failed',
        'error',
        'cancelled',
        'canceled',
        'expired',
        'timeout',
        'timed_out',
        'aborted',
        'rejected',
    ].includes(status)
}

function parseCommandResponsePayload<T>(command: DeviceCommandStatus): T {
    const candidates = [
        command.result,
        command.response,
        command.output,
        command.data,
    ]

    for (const candidate of candidates) {
        if (candidate === undefined) continue
        const obj = readRecord(candidate)
        if (obj && 'body' in obj) return obj.body as T
        if (obj && 'response' in obj) {
            const response = obj.response
            const responseObj = readRecord(response)
            if (responseObj && 'body' in responseObj) {
                return responseObj.body as T
            }
            return response as T
        }
        return candidate as T
    }

    throw new LmxError(500, 'Device command completed without a response payload', 'command_empty')
}

function toCommandError(command: DeviceCommandStatus, status: string): LmxError {
    const responseObj = readRecord(command.response)
    const responseBodyObj = readRecord(responseObj?.body)
    const responseErrorObj = readRecord(responseBodyObj?.error)

    const message =
        command.error
        ?? readString(responseErrorObj?.message)
        ?? readString(responseBodyObj?.message)
        ?? `Device command ${command.id} ${status}`

    const code =
        command.errorCode
        ?? readString(responseErrorObj?.code)
        ?? `command_${status}`

    const httpStatus =
        command.httpStatus
        ?? readNumber(responseObj?.status)
        ?? 500

    return new LmxError(httpStatus, message, code)
}

async function sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}

async function pollCommandUntilTerminal(
    commandId: string,
    bridgeToken: string | null
): Promise<DeviceCommandStatus> {
    const startedAt = Date.now()
    while (true) {
        const command = await getDeviceCommandStatus(commandId, { bridgeToken })
        const status = normalizeCommandState(command.status)

        if (isCommandComplete(status)) return command
        if (isCommandFailed(status)) throw toCommandError(command, status)

        if (Date.now() - startedAt > COMMAND_POLL_TIMEOUT_MS) {
            throw new LmxError(
                0,
                `Device command ${commandId} timed out waiting for completion`,
                'command_timeout',
            )
        }

        await sleep(COMMAND_POLL_INTERVAL_MS)
    }
}

async function executeMutationWithTransport<T>(params: {
    method: DeviceCommandMethod
    path: string
    body?: unknown
    direct: () => Promise<T>
}): Promise<T> {
    const commandContext = readCommandChannelContext()
    if (!commandContext) {
        return params.direct()
    }

    const request: DeviceCommandPayload = {
        method: params.method,
        path: params.path,
        ...(params.body !== undefined ? { body: params.body } : {}),
    }

    const command = await enqueueDeviceCommand({
        sessionId: commandContext.sessionId,
        deviceId: commandContext.deviceId,
        request,
        bridgeToken: commandContext.bridgeToken,
    })

    const status = normalizeCommandState(command.status)
    if (isCommandComplete(status)) {
        return parseCommandResponsePayload<T>(command)
    }
    if (isCommandFailed(status)) {
        throw toCommandError(command, status)
    }

    const completed = await pollCommandUntilTerminal(
        command.id,
        commandContext.bridgeToken,
    )
    return parseCommandResponsePayload<T>(completed)
}

export function mutationPost<T>(path: string, body?: unknown): Promise<T> {
    return executeMutationWithTransport<T>({
        method: 'POST',
        path,
        body,
        direct: () => lmxPost<T>(path, body),
    })
}

export function mutationDelete<T>(path: string): Promise<T> {
    return executeMutationWithTransport<T>({
        method: 'DELETE',
        path,
        direct: () => lmxDelete<T>(path),
    })
}

function normalizeArgumentsPayload(
    args: Record<string, unknown> | string | undefined
): Record<string, unknown> | string {
    if (args == null) return {}
    if (typeof args !== 'string') return args

    const trimmed = args.trim()
    if (!trimmed) return {}

    try {
        const parsed = JSON.parse(trimmed) as unknown
        if (
            parsed !== null
            && typeof parsed === 'object'
            && !Array.isArray(parsed)
        ) {
            return parsed as Record<string, unknown>
        }
    } catch {
        // Keep raw input for server-side parsing/error reporting.
    }

    return trimmed
}

// ── Model Lifecycle ─────────────────────────────────────────────────────────

/**
 * Load a model into memory.
 * Returns AdminLoadResponse on immediate load, or AutoDownloadResponse
 * when a download confirmation is needed (202).
 */
export async function loadModel(
    request: AdminLoadRequest
): Promise<AdminLoadResponse | AutoDownloadResponse> {
    return mutationPost<AdminLoadResponse | AutoDownloadResponse>(
        '/admin/models/load',
        request
    )
}

/** Unload a model and free memory. */
export async function unloadModel(modelId: string): Promise<AdminUnloadResponse> {
    return mutationPost<AdminUnloadResponse>('/admin/models/unload', {
        model_id: modelId,
    })
}

/** Delete a model from disk. Must be unloaded first. */
export async function deleteModel(modelId: string): Promise<AdminDeleteResponse> {
    return mutationDelete<AdminDeleteResponse>(
        `/admin/models/${encodeURIComponent(modelId)}`
    )
}

/** Start an async model download from HuggingFace Hub. */
export async function downloadModel(
    request: AdminDownloadRequest
): Promise<AdminDownloadResponse> {
    return mutationPost<AdminDownloadResponse>('/admin/models/download', request)
}

/** Confirm a pending download and start download + auto-load. */
export async function confirmAndLoad(
    request: ConfirmLoadRequest
): Promise<AutoDownloadResponse> {
    return mutationPost<AutoDownloadResponse>('/admin/models/load/confirm', request)
}

/** Probe candidate backends for a model without loading. */
export async function probeModel(
    request: AdminProbeRequest
): Promise<AdminProbeResponse> {
    return mutationPost<AdminProbeResponse>('/admin/models/probe', request)
}

/** Run autotune benchmark and persist best profile. */
export async function autotuneModel(
    request: AdminAutotuneRequest
): Promise<AdminAutotuneResponse> {
    return mutationPost<AdminAutotuneResponse>('/admin/models/autotune', request)
}

// ── System ──────────────────────────────────────────────────────────────────

/** Hot-reload configuration from disk. */
export async function reloadConfig(): Promise<ConfigReloadResponse> {
    return mutationPost<ConfigReloadResponse>('/admin/config/reload')
}

/** Re-read preset files from disk. */
export async function reloadPresets(): Promise<PresetListResponse> {
    return mutationPost<PresetListResponse>('/admin/presets/reload')
}

// ── Benchmark ───────────────────────────────────────────────────────────────

/** Run a performance benchmark against a loaded model. */
export async function runBenchmark(
    request: BenchmarkRunRequest
): Promise<BenchmarkRunResponse> {
    return mutationPost<BenchmarkRunResponse>('/admin/benchmark/run', request)
}

// ── Sessions ────────────────────────────────────────────────────────────────

/** Delete a session by ID. */
export async function deleteSession(
    sessionId: string
): Promise<{ deleted: boolean }> {
    return mutationDelete<{ deleted: boolean }>(
        `/admin/sessions/${encodeURIComponent(sessionId)}`
    )
}

// ── Quantization ────────────────────────────────────────────────────────────

/** Start a quantization job. */
export async function startQuantize(
    body: { model_id: string; bits?: number; output_path?: string }
): Promise<{ job_id: string; status: string }> {
    return mutationPost<{ job_id: string; status: string }>(
        '/admin/quantize',
        body
    )
}

/** Cancel a quantization job. */
export async function cancelQuantize(
    jobId: string
): Promise<{ cancelled: boolean }> {
    return mutationPost<{ cancelled: boolean }>(`/admin/quantize/${jobId}/cancel`)
}

// ── Audio Services (TTS / STT) ───────────────────────────────────────────────

/**
 * Generate speech audio from text via /v1/audio/speech.
 * Returns a Blob (audio/wav by default) that can be played in the browser.
 */
export async function textToSpeech(request: SpeechRequest): Promise<Blob> {
    const { getLmxUrl, getAdminKey, getInferenceKey } = await import('./api')
    const url = `${getLmxUrl()}/v1/audio/speech`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const inferenceKey = getInferenceKey()
    const key = getAdminKey()
    if (inferenceKey) {
        headers['Authorization'] = `Bearer ${inferenceKey}`
    } else if (key) {
        headers['X-Admin-Key'] = key
    }

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
    return mutationPost<RagIngestResponse>('/v1/rag/ingest', request)
}

/** Semantic search a RAG collection. */
export async function queryRag(
    request: RagQueryRequest
): Promise<RagQueryResponse> {
    return mutationPost<RagQueryResponse>('/v1/rag/query', request)
}

/** Delete a RAG collection and all its documents. */
export async function deleteRagCollection(
    collection: string
): Promise<{ success: boolean; collection: string; documents_deleted: number }> {
    return mutationDelete<{ success: boolean; collection: string; documents_deleted: number }>(
        `/v1/rag/collections/${encodeURIComponent(collection)}`
    )
}

/** Generate vector embeddings for one or more texts. */
export async function generateEmbedding(
    input: string | string[],
    model?: string
): Promise<EmbeddingResponse> {
    return mutationPost<EmbeddingResponse>('/v1/embeddings', {
        input,
        model: model ?? 'text-embedding-ada-002',
    })
}

// ── Skills & MCP ─────────────────────────────────────────────────────────────

/** Execute a skill by name. */
export async function executeSkill(
    skillName: string,
    args: Record<string, unknown> | string,
    approved = false,
    timeoutSec?: number
): Promise<SkillExecuteResponse> {
    const body: SkillExecuteRequest = {
        arguments: normalizeArgumentsPayload(args),
        approved,
        ...(timeoutSec !== undefined ? { timeout_sec: timeoutSec } : {}),
    }
    return mutationPost<SkillExecuteResponse>(
        `/v1/skills/${encodeURIComponent(skillName)}/execute`,
        body
    )
}

/** Call an MCP tool by name. */
export async function callMcpTool(
    name: string,
    args: Record<string, unknown> | string = {},
    approved = false
): Promise<MCPToolCallResponse> {
    const body: MCPToolCallRequest = {
        name,
        arguments: normalizeArgumentsPayload(args),
        approved,
    }
    return mutationPost<MCPToolCallResponse>('/v1/skills/mcp/call', body)
}

/** Resolve an MCP prompt by name and optional arguments. */
export async function getMcpPrompt(
    name: string,
    args: Record<string, unknown> | string = {}
): Promise<MCPPromptGetResponse> {
    const payload = normalizeArgumentsPayload(args)
    const body: MCPPromptGetRequest = {
        name,
        arguments: typeof payload === 'string' ? {} : payload,
    }
    return mutationPost<MCPPromptGetResponse>('/v1/skills/mcp/prompts/get', body)
}

/** Read MCP resource content by URI. */
export async function readMcpResource(
    uri: string
): Promise<MCPResourceReadResponse> {
    const body: MCPResourceReadRequest = { uri }
    return mutationPost<MCPResourceReadResponse>('/mcp/resources/read', body)
}

// ── Agent Orchestration ───────────────────────────────────────────────────────

/** Create and start an agent run. Returns immediately with initial run state. */
export async function createAgentRun(
    request: AgentRunCreateRequest
): Promise<AgentRun> {
    return mutationPost<AgentRun>('/v1/agents/runs', request)
}

/** Cancel a queued or running agent run. */
export async function cancelAgentRun(runId: string): Promise<AgentRun> {
    return mutationPost<AgentRun>(`/v1/agents/runs/${encodeURIComponent(runId)}/cancel`)
}
