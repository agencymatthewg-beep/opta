/**
 * lanScanner.ts
 *
 * Two-tier discovery strategy:
 *
 * 1. mDNS-Hints fast-path (< 1s):
 *    Probe `<hostname>.local:1234` for `/_well-known/opta-lmx` — works on macOS
 *    because the OS mDNS resolver (mDNSResponder) resolves `.local` names natively,
 *    so standard `fetch()` calls resolve Bonjour-advertised hostnames transparently.
 *    LMX advertises `_opta-lmx._tcp.local.` by default, and its hostname is always
 *    `<machinename>.local`.
 *
 * 2. /24 subnet sweep fallback (brute-force):
 *    Concurrency-limited parallel probes of all 254 hosts, used when mDNS hints miss.
 */

export interface LmxDiscoveryInfo {
    host: string;
    port: number;
    latencyMs: number;
    instanceId?: string;
    machineName?: string;
    loadedModelCount?: number;
    adminKeyRequired?: boolean;
    preferredBaseUrl?: string;
    via: "mdns-hint" | "subnet-scan";
}

export interface LanScanResult {
    host: string;
    port: number;
    latencyMs: number;
    online: boolean;
    unauthorized: boolean;
    lmxInfo?: LmxDiscoveryInfo;
}

export interface LanScanProgress {
    scanned: number;
    total: number;
    found: LanScanResult[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LAN_PROBE_TIMEOUT_MS = 1200;
const MDNS_PROBE_TIMEOUT_MS = 800;
const DEFAULT_CONCURRENCY = 20;

const OPTA_LMX_PORT = 1234;
const OPTA_DAEMON_PORT = 9999;

// Well-known .local hostnames to always try first (common Mac Studio names).
// macOS mDNS (Bonjour) resolves these via the OS resolver — no special APIs needed.
const MDNS_HINT_HOSTNAMES = [
    "mono512",
    "mac-studio",
    "mac-mini",
    "mac-pro",
    "opta-studio",
    "opta-mac",
    "macstudio",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function makeTimeoutSignal(ms: number): AbortSignal {
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        return AbortSignal.timeout(ms);
    }
    const c = new AbortController();
    globalThis.setTimeout(() => c.abort(), ms);
    return c.signal;
}

/**
 * Derives the /24 base from an IP address string.
 * e.g. "192.168.188.11" → "192.168.188"
 * Falls back to "192.168.1" if parse fails.
 */
export function deriveSubnetBase(ip: string): string {
    const parts = ip.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
        return [parts[0], parts[1], parts[2]].join(".");
    }
    return "192.168.1";
}

// ─── LMX Well-Known Probe ────────────────────────────────────────────────────

/**
 * Probe `/.well-known/opta-lmx` on a host:port.
 * Returns rich LMX metadata or null if unreachable.
 * LMX always serves this endpoint — it's faster and more informative than /healthz.
 */
async function probeLmxWellKnown(
    host: string,
    port: number,
    via: LmxDiscoveryInfo["via"],
): Promise<LmxDiscoveryInfo | null> {
    const timeoutMs = via === "mdns-hint" ? MDNS_PROBE_TIMEOUT_MS : LAN_PROBE_TIMEOUT_MS;
    const url = `http://${host}:${port}/.well-known/opta-lmx`;
    const start = performance.now();
    try {
        const response = await fetch(url, {
            signal: makeTimeoutSignal(timeoutMs),
        });
        if (!response.ok) return null;
        const latencyMs = Math.round(performance.now() - start);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: Record<string, any> = {};
        try {
            data = (await response.json()) as Record<string, any>;
        } catch {
            // response was OK but not JSON — still counts as LMX present
        }
        return {
            host,
            port,
            latencyMs,
            via,
            instanceId: typeof data.instance_id === "string" ? data.instance_id : undefined,
            machineName: typeof data.instance_id === "string"
                ? data.instance_id.split(":")[0]
                : undefined,
            loadedModelCount: typeof data.loaded_model_count === "number"
                ? data.loaded_model_count
                : undefined,
            adminKeyRequired: typeof data.auth?.admin_key_required === "boolean"
                ? data.auth.admin_key_required
                : undefined,
            preferredBaseUrl: typeof data.endpoints?.preferred_base_url === "string"
                ? data.endpoints.preferred_base_url
                : undefined,
        };
    } catch {
        return null;
    }
}

// ─── Daemon Probe ─────────────────────────────────────────────────────────────

async function probeHost(host: string, port: number): Promise<LanScanResult> {
    const url = `http://${host}:${port}/v3/health`;
    const start = performance.now();
    try {
        const response = await fetch(url, {
            signal: makeTimeoutSignal(LAN_PROBE_TIMEOUT_MS),
        });
        const latencyMs = Math.round(performance.now() - start);
        if (response.ok) {
            return { host, port, latencyMs, online: true, unauthorized: false };
        }
        if (response.status === 401 || response.status === 403) {
            return { host, port, latencyMs, online: true, unauthorized: true };
        }
        return { host, port, latencyMs: 0, online: false, unauthorized: false };
    } catch {
        return { host, port, latencyMs: 0, online: false, unauthorized: false };
    }
}

// ─── mDNS Hints Fast-Path ─────────────────────────────────────────────────────

/**
 * Probe a set of well-known `.local` hostnames for Opta LMX.
 *
 * On macOS, the system mDNS resolver (Bonjour/mDNSResponder) resolves `.local`
 * names transparently in `fetch()`. If LMX is advertising itself via
 * `_opta-lmx._tcp.local.` (enabled by default), its machine hostname
 * (e.g. `mono512.local`) will resolve to its LAN IP in < 50ms.
 *
 * This is an instant, zero-scan discovery path — no subnet probing required.
 */
export async function discoverLmxViaMdnsHints(
    extraHints: string[] = [],
    onFound?: (info: LmxDiscoveryInfo) => void,
): Promise<LmxDiscoveryInfo[]> {
    const candidates = [
        ...MDNS_HINT_HOSTNAMES.map((h) => `${h}.local`),
        ...extraHints,
    ];

    const results = await Promise.allSettled(
        candidates.map((host) =>
            probeLmxWellKnown(host, OPTA_LMX_PORT, "mdns-hint"),
        ),
    );

    const found: LmxDiscoveryInfo[] = [];
    for (const r of results) {
        if (r.status === "fulfilled" && r.value !== null) {
            found.push(r.value);
            onFound?.(r.value);
        }
    }
    return found;
}

// ─── Combined Discovery ────────────────────────────────────────────────────────

export interface FullDiscoveryResult {
    lmxInstances: LmxDiscoveryInfo[];
    daemonInstances: LanScanResult[];
}

/**
 * Full discovery: mDNS hints first (fast), then subnet scan (thorough).
 *
 * Strategy:
 * 1. Probe well-known .local hostnames for LMX (≈ 50–200ms each, parallel)
 * 2. Run /24 subnet scan on daemonPort and lmxPort simultaneously
 *
 * @param subnetBase - e.g. "192.168.188" (derived from current connection host)
 * @param daemonPort - Opta Daemon port (default 9999)
 * @param lmxPort - LMX port (default 1234)
 * @param concurrency - parallel probes in subnet scan (default 20)
 * @param onProgress - called after each batch
 * @param signal - optional AbortSignal to cancel
 */
export async function discoverAll(
    subnetBase: string,
    daemonPort = OPTA_DAEMON_PORT,
    lmxPort = OPTA_LMX_PORT,
    concurrency = DEFAULT_CONCURRENCY,
    onProgress?: (phase: "mdns" | "scan", progress: LanScanProgress) => void,
    signal?: AbortSignal,
): Promise<FullDiscoveryResult> {
    // Phase 1: mDNS hints (instant on macOS)
    const lmxInstances = await discoverLmxViaMdnsHints(
        [],
        (info) => onProgress?.("mdns", { scanned: 0, total: 0, found: [] }),
    );

    if (signal?.aborted) {
        return { lmxInstances, daemonInstances: [] };
    }

    // Phase 2: Subnet scan for daemon instances
    const daemonInstances = await scanLanSubnet(
        subnetBase,
        daemonPort,
        concurrency,
        (progress) => onProgress?.("scan", progress),
        signal,
    );

    // Also check if any subnet-discovered hosts have LMX on lmxPort
    const lmxHostsAlreadyFound = new Set(lmxInstances.map((l) => l.host));
    const subnetLmxChecks = daemonInstances
        .filter((d) => d.online && !lmxHostsAlreadyFound.has(d.host))
        .map(async (d) => {
            const info = await probeLmxWellKnown(d.host, lmxPort, "subnet-scan");
            if (info) lmxInstances.push(info);
        });

    await Promise.allSettled(subnetLmxChecks);

    return { lmxInstances, daemonInstances };
}

// ─── Subnet Scan (unchanged public API used by ConnectionAddressBook) ──────────

/**
 * Runs a concurrent scan of all 254 hosts on a /24 subnet.
 */
export async function scanLanSubnet(
    subnetBase: string,
    port = OPTA_DAEMON_PORT,
    concurrency = DEFAULT_CONCURRENCY,
    onProgress?: (progress: LanScanProgress) => void,
    signal?: AbortSignal,
): Promise<LanScanResult[]> {
    const hosts: string[] = [];
    for (let i = 1; i <= 254; i++) {
        hosts.push(`${subnetBase}.${i}`);
    }

    const found: LanScanResult[] = [];
    let scanned = 0;

    for (let i = 0; i < hosts.length; i += concurrency) {
        if (signal?.aborted) break;

        const batch = hosts.slice(i, i + concurrency);
        const results = await Promise.allSettled(
            batch.map((host) => probeHost(host, port)),
        );

        scanned += batch.length;

        for (const result of results) {
            if (result.status === "fulfilled" && result.value.online) {
                found.push(result.value);
            }
        }

        onProgress?.({ scanned, total: hosts.length, found: [...found] });
    }

    return found;
}
