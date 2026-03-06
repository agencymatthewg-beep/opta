import type {
    BridgeTokenMintEnvelope,
    PairingSessionEnvelope,
} from '@/lib/types'

const DEFAULT_ACCOUNTS_BASE_URL =
    process.env.NEXT_PUBLIC_OPTA_ACCOUNTS_URL ?? 'https://accounts.optalocal.com'

export class AccountsControlPlaneError extends Error {
    status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'AccountsControlPlaneError'
        this.status = status
    }
}

async function readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`
        try {
            const body = (await response.json()) as { error?: string }
            if (body?.error) message = body.error
        } catch {
            // ignore
        }
        throw new AccountsControlPlaneError(response.status, message)
    }
    return response.json() as Promise<T>
}

function cpUrl(path: string): string {
    return `${DEFAULT_ACCOUNTS_BASE_URL}${path}`
}

function buildBridgeHeaders(token?: string | null): Record<string, string> {
    if (!token) return {}
    return {
        'X-Bridge-Token': token,
    }
}

function toRecord(value: unknown): Record<string, unknown> | null {
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

async function readJsonWithFallback<T>(
    paths: string[],
    init: RequestInit
): Promise<T> {
    let notFoundError: AccountsControlPlaneError | null = null

    for (const path of paths) {
        const response = await fetch(cpUrl(path), init)
        if (response.status === 404 && paths.length > 1) {
            notFoundError = new AccountsControlPlaneError(
                response.status,
                'Device command endpoint not found',
            )
            continue
        }
        return readJson<T>(response)
    }

    if (notFoundError) throw notFoundError
    throw new AccountsControlPlaneError(404, 'Device command endpoint not found')
}

export async function createPairingSession(input: {
    deviceId?: string
    deviceLabel?: string
    capabilityScopes?: string[]
    ttlSeconds?: number
}): Promise<PairingSessionEnvelope> {
    const response = await fetch(cpUrl('/api/pairing/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
    })
    return readJson<PairingSessionEnvelope>(response)
}

export async function getPairingSession(sessionId: string): Promise<PairingSessionEnvelope> {
    const response = await fetch(cpUrl(`/api/pairing/sessions/${encodeURIComponent(sessionId)}`), {
        method: 'GET',
        credentials: 'include',
    })
    return readJson<PairingSessionEnvelope>(response)
}

export async function claimPairingSession(
    sessionId: string,
    input: {
        deviceId?: string
        deviceLabel?: string
        bridgeTokenId?: string
    },
): Promise<PairingSessionEnvelope> {
    const response = await fetch(
        cpUrl(`/api/pairing/sessions/${encodeURIComponent(sessionId)}/claim`),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(input),
        },
    )
    return readJson<PairingSessionEnvelope>(response)
}

export async function mintBridgeToken(input: {
    deviceId: string
    scopes: string[]
    ttlSeconds?: number
}): Promise<BridgeTokenMintEnvelope> {
    const response = await fetch(cpUrl('/api/bridge/tokens'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
    })
    return readJson<BridgeTokenMintEnvelope>(response)
}

export type DeviceCommandMethod = 'POST' | 'DELETE'

export interface DeviceCommandPayload {
    method: DeviceCommandMethod
    path: string
    body?: unknown
}

export interface DeviceCommandStatus {
    id: string
    status: string
    request?: DeviceCommandPayload
    response?: unknown
    result?: unknown
    data?: unknown
    output?: unknown
    error: string | null
    errorCode: string | null
    httpStatus: number | null
    createdAt: string | null
    updatedAt: string | null
    completedAt: string | null
}

const DEVICE_COMMAND_ENQUEUE_PATHS = [
    '/api/device-commands',
    '/api/device/commands',
]

const DEVICE_COMMAND_STATUS_PATHS = (commandId: string) => [
    `/api/device-commands/${encodeURIComponent(commandId)}`,
    `/api/device/commands/${encodeURIComponent(commandId)}`,
]

function normalizeDeviceCommand(raw: unknown): DeviceCommandStatus {
    const obj = toRecord(raw)
    if (!obj) {
        throw new AccountsControlPlaneError(500, 'Invalid device command response')
    }

    const id =
        readString(obj.id)
        ?? readString(obj.commandId)
        ?? readString(obj.command_id)
    if (!id) {
        throw new AccountsControlPlaneError(500, 'Device command ID missing from response')
    }

    const status =
        readString(obj.status)
        ?? readString(obj.state)
        ?? 'queued'

    const requestRecord = toRecord(obj.request)
    const requestMethod = readString(requestRecord?.method)
    const requestPath = readString(requestRecord?.path)

    return {
        id,
        status,
        request:
            requestMethod && requestPath
                ? {
                    method: requestMethod === 'DELETE' ? 'DELETE' : 'POST',
                    path: requestPath,
                    body: requestRecord?.body,
                }
                : undefined,
        response: obj.response,
        result: obj.result,
        data: obj.data,
        output: obj.output,
        error:
            readString(obj.error)
            ?? readString(obj.message)
            ?? null,
        errorCode:
            readString(obj.errorCode)
            ?? readString(obj.error_code)
            ?? null,
        httpStatus:
            readNumber(obj.httpStatus)
            ?? readNumber(obj.http_status)
            ?? null,
        createdAt: readString(obj.createdAt) ?? readString(obj.created_at),
        updatedAt: readString(obj.updatedAt) ?? readString(obj.updated_at),
        completedAt: readString(obj.completedAt) ?? readString(obj.completed_at),
    }
}

function normalizeDeviceCommandEnvelope(
    raw: unknown
): DeviceCommandStatus {
    const obj = toRecord(raw)
    if (!obj) return normalizeDeviceCommand(raw)

    if ('command' in obj) return normalizeDeviceCommand(obj.command)
    if ('data' in obj) {
        const data = toRecord(obj.data)
        if (data && 'command' in data) {
            return normalizeDeviceCommand(data.command)
        }
    }
    return normalizeDeviceCommand(raw)
}

export async function enqueueDeviceCommand(input: {
    sessionId: string
    deviceId: string
    request: DeviceCommandPayload
    bridgeToken?: string | null
}): Promise<DeviceCommandStatus> {
    const body = {
        // Kept for forwards compatibility with future session-scoped APIs.
        sessionId: input.sessionId,
        deviceId: input.deviceId,
        command: 'lmx.http.request',
        payload: input.request,
        scope: 'device.mutation.execute',
    }

    const payload = await readJsonWithFallback<unknown>(
        DEVICE_COMMAND_ENQUEUE_PATHS,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...buildBridgeHeaders(input.bridgeToken),
            },
            credentials: 'include',
            body: JSON.stringify(body),
        },
    )
    return normalizeDeviceCommandEnvelope(payload)
}

export async function getDeviceCommandStatus(
    commandId: string,
    options?: { bridgeToken?: string | null }
): Promise<DeviceCommandStatus> {
    const payload = await readJsonWithFallback<unknown>(
        DEVICE_COMMAND_STATUS_PATHS(commandId),
        {
            method: 'GET',
            headers: buildBridgeHeaders(options?.bridgeToken),
            credentials: 'include',
        },
    )
    return normalizeDeviceCommandEnvelope(payload)
}
