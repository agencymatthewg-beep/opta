/**
 * useConnectionHealth.ts
 *
 * Ambient connection health hook for the WorkspaceRail.
 *
 * Probes the daemon's /v3/health endpoint every 30s and classifies
 * latency into a quality tier. Also listens to the browser's navigator.onLine
 * to detect offline immediately. Exposes:
 *
 *   - status: "connected" | "connecting" | "disconnected" | "offline"
 *   - latencyMs: the last measured round-trip time
 *   - latencyTier: "excellent" | "good" | "degraded" | "poor"
 *   - host + port of the probed target
 */

import { useEffect, useRef, useState } from "react";
import type { DaemonConnectionOptions } from "../types";

const HEALTH_POLL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 3_000;

export type ConnectionQualityTier = "excellent" | "good" | "degraded" | "poor";

export interface ConnectionHealthState {
    /** Derived from daemon health probe + navigator.onLine */
    status: "connected" | "connecting" | "disconnected" | "offline";
    /** Last measured probe latency in ms, or null if never succeeded */
    latencyMs: number | null;
    /** Latency colour classification */
    latencyTier: ConnectionQualityTier;
    /** The endpoint being monitored */
    host: string;
    port: number;
}

function classify(ms: number | null): ConnectionQualityTier {
    if (ms === null) return "poor";
    if (ms < 20) return "excellent";
    if (ms < 80) return "good";
    if (ms < 250) return "degraded";
    return "poor";
}

export function useConnectionHealth(
    connection: DaemonConnectionOptions,
    /** The already-known connection state from useDaemonSessions (avoids a second probe on startup) */
    knownState: "connected" | "connecting" | "disconnected",
): ConnectionHealthState {
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [probeState, setProbeState] = useState<"connected" | "connecting" | "disconnected">(
        knownState,
    );
    const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
    const abortRef = useRef<AbortController | null>(null);
    const connKey = `${connection.host}:${connection.port}`;

    // Sync knownState changes into local state (avoids lag from poll interval)
    useEffect(() => {
        setProbeState(knownState);
    }, [knownState]);

    // Network offline/online listener
    useEffect(() => {
        const onOnline = () => setIsOffline(false);
        const onOffline = () => setIsOffline(true);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    // Background health probe loop — independent 30s poll
    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;

        const probe = async () => {
            if (cancelled || !navigator.onLine) return;
            const abort = new AbortController();
            abortRef.current = abort;
            const url = `${connection.protocol ?? "http"}://${connection.host}:${connection.port}/v3/health`;
            const start = performance.now();
            try {
                const resp = await fetch(url, {
                    signal: abort.signal,
                    headers: connection.token ? { Authorization: `Bearer ${connection.token}` } : {},
                });
                const ms = Math.round(performance.now() - start);
                if (cancelled) return;
                if (resp.ok || resp.status === 401 || resp.status === 403) {
                    setLatencyMs(ms);
                    setProbeState("connected");
                } else {
                    setProbeState("disconnected");
                }
            } catch {
                if (cancelled) return;
                setProbeState("disconnected");
            }

            if (!cancelled) {
                timer = window.setTimeout(probe, HEALTH_POLL_MS);
            }
        };

        // Run first probe after a short delay so we don't race startup
        timer = window.setTimeout(probe, 3_000);

        return () => {
            cancelled = true;
            if (timer !== null) window.clearTimeout(timer);
            abortRef.current?.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connKey, connection.token, connection.protocol]);

    const effectiveStatus = isOffline
        ? "offline"
        : probeState;

    return {
        status: effectiveStatus,
        latencyMs,
        latencyTier: classify(latencyMs),
        host: connection.host,
        port: connection.port,
    };
}
