"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
    Wifi,
    Plus,
    Trash2,
    CheckCircle,
    AlertCircle,
    Loader2,
    ChevronRight,
    Server,
    Scan,
    Copy,
    Eye,
    EyeOff,
    Save,
} from "lucide-react";
import { probeDaemonConnection } from "../../lib/connectionProbe";
import {
    loadAddressBook,
    saveAddressBook,
    addEntry,
    updateEntry,
    removeEntry,
    entryToConnection,
    saveTokenForEntry,
    LOCAL_DAEMON_ENTRY,
    type AddressBookEntry,
} from "../../lib/addressBook";
import {
    scanLanSubnet,
    deriveSubnetBase,
    discoverLmxViaMdnsHints,
    type LanScanResult,
    type LanScanProgress,
    type LmxDiscoveryInfo,
} from "../../lib/lanScanner";
import type { DaemonConnectionOptions } from "../../types";
import {
    LMX_DEFAULT_PORT,
    sanitizeDaemonConnection,
} from "../../lib/daemonConnectionGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryStatus = "unknown" | "online" | "unauthorized" | "offline" | "probing";

interface EnrichedEntry extends AddressBookEntry {
    status: EntryStatus;
    latencyMs?: number;
}

interface ConnectionAddressBookProps {
    activeConnection: DaemonConnectionOptions;
    onConnectionChange: (conn: DaemonConnectionOptions) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<EntryStatus, string> = {
    unknown: "#52525b",
    online: "#10b981",
    unauthorized: "#f59e0b",
    offline: "#ef4444",
    probing: "#a855f7",
};

const STATUS_LABELS: Record<EntryStatus, string> = {
    unknown: "···",
    online: "online",
    unauthorized: "auth needed",
    offline: "offline",
    probing: "probing…",
};

function isLocalEntry(e: AddressBookEntry): boolean {
    return e.id === LOCAL_DAEMON_ENTRY.id;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectionAddressBook({
    activeConnection,
    onConnectionChange,
}: ConnectionAddressBookProps) {
    const [entries, setEntries] = useState<EnrichedEntry[]>(() => {
        const saved = loadAddressBook();
        const enriched: EnrichedEntry[] = saved.map((e) => ({
            ...e,
            status: "unknown",
        }));
        const hasLocal = enriched.some(isLocalEntry);
        if (!hasLocal) {
            return [{ ...LOCAL_DAEMON_ENTRY, status: "unknown" }, ...enriched];
        }
        // ensure pinned local is always first
        return [
            ...enriched.filter(isLocalEntry),
            ...enriched.filter((e) => !isLocalEntry(e)),
        ];
    });

    const [selectedId, setSelectedId] = useState<string | null>(null);

    // --- Active form ---
    const [formHost, setFormHost] = useState("");
    const [formPort, setFormPort] = useState("9999");
    const [formLabel, setFormLabel] = useState("");
    const [formToken, setFormToken] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [probeMsg, setProbeMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [probing, setProbing] = useState(false);
    const [saving, setSaving] = useState(false);

    // --- LAN scan ---
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState<LanScanProgress | null>(null);
    const [scanResults, setScanResults] = useState<LanScanResult[]>([]);
    const [mdnsResults, setMdnsResults] = useState<LmxDiscoveryInfo[]>([]);
    const scanAbortRef = useRef<AbortController | null>(null);

    // --- Add Manual ---
    const [showAddForm, setShowAddForm] = useState(false);
    const [addLabel, setAddLabel] = useState("");
    const [addHost, setAddHost] = useState("");
    const [addPort, setAddPort] = useState("9999");

    // Persist entries whenever they change (skip local-only entry)
    useEffect(() => {
        const toSave = entries.filter((e) => !isLocalEntry(e));
        saveAddressBook(toSave);
    }, [entries]);

    // Load token + populate form when an entry is selected
    const selectEntry = useCallback(async (entry: EnrichedEntry) => {
        setSelectedId(entry.id);
        setFormHost(entry.host);
        setFormPort(String(entry.port));
        setFormLabel(entry.label);
        setProbeMsg(null);
        const conn = await entryToConnection(entry);
        setFormToken(conn.token);
    }, []);

    // Update status of a single entry
    const updateStatus = useCallback(
        (id: string, status: EntryStatus, latencyMs?: number) => {
            setEntries((prev) =>
                prev.map((e) => (e.id === id ? { ...e, status, latencyMs } : e)),
            );
        },
        [],
    );

    // Probe a single entry
    const probeEntry = useCallback(
        async (entry: EnrichedEntry) => {
            updateStatus(entry.id, "probing");
            const conn = await entryToConnection(entry);
            const result = await probeDaemonConnection(conn);
            if (result.type !== "offline") {
                updateStatus(
                    entry.id,
                    result.diagnostic === "UNAUTHORIZED" ? "unauthorized" : "online",
                    result.latencyMs,
                );
            } else {
                updateStatus(entry.id, "offline");
            }
        },
        [updateStatus],
    );

    // Probe all entries on mount
    useEffect(() => {
        for (const entry of entries) {
            void probeEntry(entry);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // LAN scan
    const startScan = useCallback(async () => {
        setScanning(true);
        setScanResults([]);
        setScanProgress(null);
        setMdnsResults([]);

        const base = deriveSubnetBase(activeConnection.host);
        const abortCtrl = new AbortController();
        scanAbortRef.current = abortCtrl;

        // Phase 1: mDNS hints (instant — probes .local hostnames via OS Bonjour)
        const lmxFound = await discoverLmxViaMdnsHints(
            [],
            (info) => setMdnsResults((prev) => [...prev, info]),
        );
        setMdnsResults(lmxFound);

        if (abortCtrl.signal.aborted) {
            setScanning(false);
            return;
        }

        // Phase 2: Subnet scan for daemons
        const results = await scanLanSubnet(
            base,
            9999,
            20,
            (progress) => setScanProgress(progress),
            abortCtrl.signal,
        );
        setScanResults(results);
        setScanning(false);
    }, [activeConnection.host]);

    const stopScan = useCallback(() => {
        scanAbortRef.current?.abort();
        setScanning(false);
    }, []);

    // Add a scan result to the address book
    const addScanResult = useCallback(
        (result: LanScanResult) => {
            const label = `Daemon @ ${result.host}`;
            const newEntry: AddressBookEntry = {
                id: Math.random().toString(36).slice(2, 10),
                label,
                host: result.host,
                port: result.port,
                protocol: "http",
                lastSeen: new Date().toISOString(),
                latencyMs: result.latencyMs,
            };
            const enriched: EnrichedEntry = {
                ...newEntry,
                status: result.unauthorized ? "unauthorized" : "online",
                latencyMs: result.latencyMs,
            };
            setEntries((prev) => [...prev, enriched]);
        },
        [],
    );

    // Add manual entry
    const addManualEntry = useCallback(() => {
        const port = Number.parseInt(addPort, 10);
        if (!addHost.trim() || !Number.isFinite(port)) return;
        const label = addLabel.trim() || `Daemon @ ${addHost.trim()}`;
        const newEntry: AddressBookEntry = {
            id: Math.random().toString(36).slice(2, 10),
            label,
            host: addHost.trim(),
            port,
            protocol: "http",
        };
        const enriched: EnrichedEntry = { ...newEntry, status: "unknown" };
        setEntries((prev) => [...prev, enriched]);
        setAddLabel("");
        setAddHost("");
        setAddPort("9999");
        setShowAddForm(false);
        void probeEntry(enriched);
    }, [addHost, addPort, addLabel, probeEntry]);

    // Remove an entry
    const handleRemove = useCallback(
        (id: string) => {
            setEntries((prev) => removeEntry(prev, id) as EnrichedEntry[]);
            if (selectedId === id) setSelectedId(null);
        },
        [selectedId],
    );

    // Test current form connection
    const testConnection = useCallback(async () => {
        const port = Number.parseInt(formPort, 10);
        if (!formHost.trim() || !Number.isFinite(port)) return;
        const guarded = sanitizeDaemonConnection({
            host: formHost.trim(),
            port,
            token: formToken.trim(),
            protocol: "http",
        });
        setProbing(true);
        setProbeMsg(null);
        const result = await probeDaemonConnection(guarded.connection);
        if (result.type !== "offline") {
            setProbeMsg({
                text: guarded.corrected
                    ? `✓ Connected — daemon guard redirected ${LMX_DEFAULT_PORT} → ${guarded.connection.host}:${guarded.connection.port} (${result.latencyMs}ms)`
                    : `✓ Connected — ${result.latencyMs}ms`,
                ok: true,
            });
        } else {
            setProbeMsg({ text: `\u2717 Failed: ${result.diagnostic}`, ok: false });
        }
        setProbing(false);
    }, [formHost, formPort, formToken]);

    // Save + Reconnect
    const handleSave = useCallback(async () => {
        const port = Number.parseInt(formPort, 10);
        if (!formHost.trim() || !Number.isFinite(port)) return;
        setSaving(true);
        const guarded = sanitizeDaemonConnection({
            host: formHost.trim(),
            port,
            token: formToken.trim(),
            protocol: "http",
        } as DaemonConnectionOptions);

        // Persist token to address book entry (or create new entry)
        if (selectedId && selectedId !== LOCAL_DAEMON_ENTRY.id) {
            const updatedEntries = updateEntry(entries, selectedId, {
                host: guarded.connection.host,
                port: guarded.connection.port,
                label: formLabel.trim() || guarded.connection.host,
                lastSeen: new Date().toISOString(),
            });
            const targetEntry = updatedEntries.find((e) => e.id === selectedId);
            if (targetEntry) {
                const withToken = await saveTokenForEntry(targetEntry, formToken.trim(), updatedEntries as AddressBookEntry[]);
                setEntries(withToken.map((e) => {
                    const existing = entries.find((ex) => ex.id === e.id);
                    return { ...e, status: existing?.status ?? "unknown", latencyMs: existing?.latencyMs } as EnrichedEntry;
                }));
            }
        }

        onConnectionChange(guarded.connection);
        if (guarded.corrected) {
            setProbeMsg({
                text: `✗ ${LMX_DEFAULT_PORT} is reserved for LMX. Daemon endpoint reset to ${guarded.connection.host}:${guarded.connection.port}.`,
                ok: false,
            });
        }
        setSaving(false);
    }, [selectedId, entries, formHost, formPort, formToken, formLabel, onConnectionChange]);

    // Copy token
    const copyToken = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(formToken);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
        } catch { /* ignore */ }
    }, [formToken]);

    // ─── Render ────────────────────────────────────────────────────────────────

    const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;
    const formPortIsReserved = Number.parseInt(formPort, 10) === LMX_DEFAULT_PORT;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* ── Address book list ── */}
            <div>
                <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: "0.75rem",
                }}>
                    <span style={{ fontSize: "0.8rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Sora" }}>
                        Saved Connections
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {scanning ? (
                            <button
                                type="button"
                                className="opta-studio-btn-secondary"
                                onClick={stopScan}
                                style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem", color: "#fca5a5", borderColor: "rgba(239,68,68,0.4)" }}
                            >
                                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                                Stop Scan
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="opta-studio-btn-secondary"
                                onClick={() => void startScan()}
                                style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                            >
                                <Scan size={12} /> Scan LAN
                            </button>
                        )}
                        <button
                            type="button"
                            className="opta-studio-btn-secondary"
                            onClick={() => setShowAddForm((v) => !v)}
                            style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                        >
                            <Plus size={12} /> Add Manual
                        </button>
                    </div>
                </div>

                {/* mDNS instant results (LMX instances) */}
                {mdnsResults.length > 0 && (
                    <div style={{ marginBottom: "0.75rem", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", overflow: "hidden" }}>
                        <div style={{ padding: "6px 10px", background: "rgba(16,185,129,0.08)", fontSize: "0.73rem", color: "#10b981", borderBottom: "1px solid rgba(16,185,129,0.15)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <Wifi size={12} /> Discovered via mDNS (Bonjour) — {mdnsResults.length} LMX server{mdnsResults.length !== 1 ? "s" : ""}
                        </div>
                        {mdnsResults.map((r) => {
                            const alreadySaved = entries.some((e) => e.host === r.host && e.port === r.port);
                            return (
                                <div key={`${r.host}:${r.port}`} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "8px 10px", borderBottom: "1px solid rgba(63,63,70,0.4)",
                                }}>
                                    <div>
                                        <span style={{ fontSize: "0.8rem", fontFamily: "JetBrains Mono", color: "#fafafa" }}>
                                            {r.machineName ?? r.host}:{r.port}
                                        </span>
                                        <span style={{ fontSize: "0.73rem", color: "#10b981", marginLeft: "0.5rem" }}>{r.latencyMs}ms</span>
                                        {r.loadedModelCount != null && (
                                            <span style={{ fontSize: "0.72rem", color: "#a1a1aa", marginLeft: "0.5rem" }}>{r.loadedModelCount} model{r.loadedModelCount !== 1 ? "s" : ""} loaded</span>
                                        )}
                                        {r.adminKeyRequired && (
                                            <span style={{ fontSize: "0.72rem", color: "#f59e0b", marginLeft: "0.5rem" }}>admin key required</span>
                                        )}
                                    </div>
                                    {!alreadySaved ? (
                                        <button
                                            type="button"
                                            className="opta-studio-btn-secondary"
                                            onClick={() => {
                                                const newEntry: import("../../lib/addressBook").AddressBookEntry = {
                                                    id: Math.random().toString(36).slice(2, 10),
                                                    label: r.machineName ? `${r.machineName} (LMX)` : `LMX @ ${r.host}`,
                                                    host: r.host,
                                                    port: r.port,
                                                    protocol: "http",
                                                    lastSeen: new Date().toISOString(),
                                                    latencyMs: r.latencyMs,
                                                };
                                                setEntries((prev) => [...prev, { ...newEntry, status: "online", latencyMs: r.latencyMs }]);
                                            }}
                                            style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                                        >
                                            + Save
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: "0.72rem", color: "#52525b" }}>saved</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Scan progress */}
                {scanning && scanProgress && (
                    <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#a1a1aa", marginBottom: "4px" }}>
                            <span>Scanning {deriveSubnetBase(activeConnection.host)}.x …</span>
                            <span>{scanProgress.scanned}/{scanProgress.total} — {scanProgress.found.length} found</span>
                        </div>
                        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(139,92,246,0.15)", overflow: "hidden" }}>
                            <div style={{
                                height: "100%",
                                borderRadius: "2px",
                                background: "#8b5cf6",
                                width: `${Math.round((scanProgress.scanned / scanProgress.total) * 100)}%`,
                                transition: "width 200ms ease",
                            }} />
                        </div>
                    </div>
                )}

                {/* Scan results */}
                {!scanning && scanResults.length > 0 && (
                    <div style={{ marginBottom: "0.75rem", border: "1px solid rgba(139,92,246,0.25)", borderRadius: "8px", overflow: "hidden" }}>
                        <div style={{ padding: "6px 10px", background: "rgba(139,92,246,0.08)", fontSize: "0.73rem", color: "#a855f7", borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
                            LAN scan found {scanResults.length} daemon{scanResults.length !== 1 ? "s" : ""}
                        </div>
                        {scanResults.map((r) => {
                            const alreadySaved = entries.some((e) => e.host === r.host && e.port === r.port);
                            return (
                                <div key={`${r.host}:${r.port}`} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "8px 10px", borderBottom: "1px solid rgba(63,63,70,0.4)",
                                }}>
                                    <div>
                                        <span style={{ fontSize: "0.8rem", fontFamily: "JetBrains Mono", color: "#fafafa" }}>{r.host}:{r.port}</span>
                                        <span style={{ fontSize: "0.73rem", color: "#10b981", marginLeft: "0.5rem" }}>{r.latencyMs}ms</span>
                                        {r.unauthorized && <span style={{ fontSize: "0.73rem", color: "#f59e0b", marginLeft: "0.5rem" }}>auth needed</span>}
                                    </div>
                                    {!alreadySaved ? (
                                        <button
                                            type="button"
                                            className="opta-studio-btn-secondary"
                                            onClick={() => addScanResult(r)}
                                            style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                                        >
                                            + Save
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: "0.72rem", color: "#52525b" }}>saved</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Manual add form */}
                {showAddForm && (
                    <div style={{
                        border: "1px solid rgba(139,92,246,0.3)", borderRadius: "8px",
                        padding: "12px", marginBottom: "0.75rem", background: "rgba(139,92,246,0.05)",
                    }}>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <input
                                className="opta-studio-input"
                                placeholder="Label"
                                value={addLabel}
                                onChange={(e) => setAddLabel(e.target.value)}
                                style={{ fontSize: "0.83rem" }}
                            />
                            <input
                                className="opta-studio-input"
                                placeholder="Host (e.g. 192.168.1.5)"
                                value={addHost}
                                onChange={(e) => setAddHost(e.target.value)}
                                style={{ fontSize: "0.83rem" }}
                            />
                            <input
                                className="opta-studio-input"
                                placeholder="Port"
                                value={addPort}
                                onChange={(e) => setAddPort(e.target.value)}
                                style={{ fontSize: "0.83rem" }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button type="button" className="opta-studio-btn-secondary" onClick={() => setShowAddForm(false)} style={{ fontSize: "0.78rem" }}>Cancel</button>
                            <button type="button" className="opta-studio-btn" onClick={addManualEntry} style={{ fontSize: "0.78rem" }}>Add Entry</button>
                        </div>
                    </div>
                )}

                {/* Entry list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {entries.map((entry) => {
                        const isActive = activeConnection.host === entry.host && activeConnection.port === entry.port;
                        const isSelected = selectedId === entry.id;
                        const isPinned = isLocalEntry(entry);

                        return (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => void selectEntry(entry)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.75rem",
                                    padding: "10px 12px", borderRadius: "8px", textAlign: "left", width: "100%",
                                    cursor: "pointer", transition: "all 0.15s ease",
                                    background: isSelected
                                        ? "rgba(139,92,246,0.15)"
                                        : isActive
                                            ? "rgba(16,185,129,0.08)"
                                            : "rgba(255,255,255,0.03)",
                                    border: isSelected
                                        ? "1px solid rgba(139,92,246,0.5)"
                                        : isActive
                                            ? "1px solid rgba(16,185,129,0.3)"
                                            : "1px solid rgba(63,63,70,0.5)",
                                }}
                            >
                                {/* Status dot */}
                                <div style={{
                                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                                    background: STATUS_COLORS[entry.status],
                                    boxShadow: entry.status === "online" ? `0 0 6px ${STATUS_COLORS.online}80` : "none",
                                }} />

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#fafafa", fontFamily: "Sora", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {entry.label}
                                        </span>
                                        {isPinned && (
                                            <span style={{ fontSize: "0.65rem", color: "#52525b", border: "1px solid #3f3f46", borderRadius: "3px", padding: "1px 5px" }}>pinned</span>
                                        )}
                                        {isActive && (
                                            <span style={{ fontSize: "0.65rem", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "3px", padding: "1px 5px" }}>active</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "0.74rem", fontFamily: "JetBrains Mono", color: "#71717a", marginTop: "1px" }}>
                                        {entry.host}:{entry.port}
                                        {entry.status === "online" && entry.latencyMs != null && (
                                            <span style={{ color: "#10b981", marginLeft: "0.4rem" }}>{entry.latencyMs}ms</span>
                                        )}
                                        {entry.status !== "online" && entry.status !== "unknown" && entry.status !== "probing" && (
                                            <span style={{ color: STATUS_COLORS[entry.status], marginLeft: "0.4rem" }}>{STATUS_LABELS[entry.status]}</span>
                                        )}
                                        {entry.status === "probing" && (
                                            <span style={{ color: "#a855f7", marginLeft: "0.4rem" }}>probing…</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    {isSelected && <ChevronRight size={14} style={{ color: "#8b5cf6" }} />}
                                    {!isPinned && (
                                        <button
                                            type="button"
                                            onClick={(ev) => { ev.stopPropagation(); handleRemove(entry.id); }}
                                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#52525b", padding: "2px", lineHeight: 0 }}
                                            title="Remove"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Active configuration form ── */}
            {selectedEntry && (
                <div style={{
                    borderTop: "1px solid rgba(63,63,70,0.6)", paddingTop: "1.25rem",
                    display: "flex", flexDirection: "column", gap: "0.85rem",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <Server size={14} style={{ color: "#a855f7" }} />
                        <span style={{ fontSize: "0.78rem", color: "#a1a1aa", fontFamily: "Sora", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Active Configuration — {selectedEntry.label}
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "0.75rem" }}>
                        <div className="opta-studio-form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: "0.78rem" }}>Host</label>
                            <input
                                className="opta-studio-input"
                                value={formHost}
                                onChange={(e) => setFormHost(e.target.value)}
                                placeholder="127.0.0.1"
                                disabled={isLocalEntry(selectedEntry)}
                            />
                        </div>
                        <div className="opta-studio-form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: "0.78rem" }}>Port</label>
                            <input
                                className="opta-studio-input"
                                value={formPort}
                                onChange={(e) => setFormPort(e.target.value)}
                                placeholder="9999"
                                disabled={isLocalEntry(selectedEntry)}
                            />
                        </div>
                    </div>

                    {formPortIsReserved && (
                        <div style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "0.76rem",
                            fontFamily: "JetBrains Mono",
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.35)",
                            color: "#fcd34d",
                        }}>
                            Port {LMX_DEFAULT_PORT} is LMX-only. Daemon API uses 9999. Save will auto-fallback to 127.0.0.1:9999.
                        </div>
                    )}

                    {!isLocalEntry(selectedEntry) && (
                        <div className="opta-studio-form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: "0.78rem" }}>Label</label>
                            <input
                                className="opta-studio-input"
                                value={formLabel}
                                onChange={(e) => setFormLabel(e.target.value)}
                                placeholder="My Daemon"
                            />
                        </div>
                    )}

                    <div className="opta-studio-form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: "0.78rem" }}>Auth Token</label>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                            <input
                                className="opta-studio-input"
                                type={showToken ? "text" : "password"}
                                value={formToken}
                                onChange={(e) => setFormToken(e.target.value)}
                                placeholder="Paste token from: opta config get connection.adminKey"
                            />
                            <button
                                type="button"
                                className="opta-studio-btn-secondary"
                                onClick={() => setShowToken((v) => !v)}
                                style={{ flexShrink: 0 }}
                            >
                                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            {formToken && (
                                <button
                                    type="button"
                                    className="opta-studio-btn-secondary"
                                    onClick={() => void copyToken()}
                                    style={{ flexShrink: 0 }}
                                >
                                    {tokenCopied ? <CheckCircle size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
                                </button>
                            )}
                        </div>
                    </div>

                    {probeMsg && (
                        <div style={{
                            padding: "8px 12px", borderRadius: "6px", fontSize: "0.78rem",
                            fontFamily: "JetBrains Mono",
                            background: probeMsg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${probeMsg.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color: probeMsg.ok ? "rgba(110,231,183,0.95)" : "rgba(252,165,165,0.95)",
                        }}>
                            {probeMsg.text}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            className="opta-studio-btn-secondary"
                            onClick={() => void testConnection()}
                            disabled={probing}
                            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                        >
                            {probing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Wifi size={13} />}
                            {probing ? "Testing…" : "Test Connection"}
                        </button>
                        <button
                            type="button"
                            className="opta-studio-btn"
                            onClick={() => void handleSave()}
                            disabled={saving}
                            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                        >
                            <Save size={13} />
                            {saving ? "Saving…" : "Save & Reconnect"}
                        </button>
                    </div>
                </div>
            )}

            {!selectedEntry && (
                <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#52525b", fontSize: "0.82rem" }}>
                    Select a connection above to configure it, or scan LAN to discover daemons.
                </div>
            )}
        </div>
    );
}
