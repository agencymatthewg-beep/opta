'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type {
    MCPCapabilitiesResponse,
    MCPPromptsResponse,
    MCPResourcesResponse,
    MCPToolsResponse,
    Skill,
    SkillListResponse,
} from '@/lib/types'

/**
 * Poll /v1/skills every 30s.
 * By default returns only the latest version of each skill (latest_only=true).
 */
export function useSkills(latestOnly = true) {
    const { isConnected } = useConnection()
    const key = isConnected
        ? `/v1/skills?latest_only=${latestOnly}`
        : null
    const { data, error, isLoading, mutate } = useSWR<SkillListResponse>(
        key,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        skills: data?.data ?? [] as Skill[],
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Fetch a single skill by name/reference. On-demand (no polling).
 */
export function useSkill(name: string | null) {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<Skill>(
        isConnected && name ? `/v1/skills/${encodeURIComponent(name)}` : null,
        lmxFetcher
    )
    return { skill: data, error, isLoading, refresh: mutate }
}

/**
 * Poll /v1/skills/mcp/tools every 30s.
 * Returns all registered MCP tools in MCP-compatible shape.
 */
export function useMcpTools() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MCPToolsResponse>(
        isConnected ? '/v1/skills/mcp/tools' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        tools: data?.tools ?? [],
        listChangedAt: data?.list_changed_at ?? null,
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Poll /v1/skills/mcp/prompts every 30s.
 * Returns prompt descriptors for prompt-kind skills.
 */
export function useMcpPrompts() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MCPPromptsResponse>(
        isConnected ? '/v1/skills/mcp/prompts' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        ok: data?.ok ?? false,
        prompts: data?.prompts ?? [],
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Poll /v1/skills/mcp/resources every 30s.
 * Returns resource descriptors surfaced through the MCP bridge.
 */
export function useMcpResources() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MCPResourcesResponse>(
        isConnected ? '/v1/skills/mcp/resources' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        ok: data?.ok ?? false,
        resources: data?.resources ?? [],
        error,
        isLoading,
        refresh: mutate,
    }
}

/**
 * Poll /v1/skills/mcp/capabilities every 30s.
 * Returns declared MCP primitive support and change-notification flags.
 */
export function useMcpCapabilities() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<MCPCapabilitiesResponse>(
        isConnected ? '/v1/skills/mcp/capabilities' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        ok: data?.ok ?? false,
        capabilities: data?.capabilities ?? {},
        error,
        isLoading,
        refresh: mutate,
    }
}
