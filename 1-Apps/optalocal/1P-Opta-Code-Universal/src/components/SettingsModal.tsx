import { useState, useEffect } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";
import { daemonClient, type DaemonLmxEndpointCandidate } from "../lib/daemonClient";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    connection: DaemonConnectionOptions;
    onSaveConnection: (conn: DaemonConnectionOptions) => void;
}

function parseHostList(raw: string): string[] {
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index);
}

function hostListToInput(raw: unknown): string {
    if (Array.isArray(raw)) {
        return raw
            .map((entry) => String(entry).trim())
            .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index)
            .join(", ");
    }
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((entry) => String(entry).trim())
                        .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index)
                        .join(", ");
                }
            } catch {
                // Fall through to raw string.
            }
        }
        return trimmed;
    }
    return "";
}

function parsePort(raw: unknown, fallback: number): number {
    const candidate =
        typeof raw === "number"
            ? raw
            : typeof raw === "string"
                ? Number.parseInt(raw, 10)
                : Number.NaN;
    if (!Number.isFinite(candidate) || candidate <= 0 || candidate > 65_535) {
        return fallback;
    }
    return candidate;
}

function parseBoolean(raw: unknown, fallback: boolean): boolean {
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "string") {
        const normalized = raw.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return fallback;
}

export function SettingsModal({
    isOpen,
    onClose,
    connection,
    onSaveConnection,
}: SettingsModalProps) {
    const [form, setForm] = useState({
        host: connection.host,
        port: String(connection.port),
        token: connection.token,
        protocol: connection.protocol ?? "",
    });
    const [showToken, setShowToken] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [probeMessage, setProbeMessage] = useState<string | null>(null);
    const [lmxHost, setLmxHost] = useState("");
    const [lmxPort, setLmxPort] = useState("1234");
    const [lmxFallbackHosts, setLmxFallbackHosts] = useState("");
    const [lmxAutoDiscover, setLmxAutoDiscover] = useState(true);
    const [lmxEndpoints, setLmxEndpoints] = useState<DaemonLmxEndpointCandidate[]>([]);
    const [lmxNotice, setLmxNotice] = useState<string | null>(null);
    const [lmxLoading, setLmxLoading] = useState(false);
    const [lmxSaving, setLmxSaving] = useState(false);

    useEffect(() => {
        setForm({
            host: connection.host,
            port: String(connection.port),
            token: connection.token,
            protocol: connection.protocol ?? "",
        });
        setProbeMessage(null);
        setLmxNotice(null);
    }, [connection, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const loadLmxTarget = async () => {
            setLmxLoading(true);
            setLmxNotice("Loading daemon → LMX settings...");
            try {
                const [hostRaw, portRaw, fallbackHostsRaw, autoDiscoverRaw, discovery] =
                    await Promise.all([
                        daemonClient.configGet(connection, "connection.host").catch(() => connection.host),
                        daemonClient.configGet(connection, "connection.port").catch(() => connection.port),
                        daemonClient.configGet(connection, "connection.fallbackHosts").catch(() => []),
                        daemonClient.configGet(connection, "connection.autoDiscover").catch(() => true),
                        daemonClient.lmxDiscovery(connection).catch(() => null),
                    ]);

                if (cancelled) return;

                const host =
                    typeof hostRaw === "string" && hostRaw.trim().length > 0
                        ? hostRaw.trim()
                        : connection.host;
                const port = parsePort(portRaw, connection.port);
                setLmxHost(host);
                setLmxPort(String(port));
                setLmxFallbackHosts(hostListToInput(fallbackHostsRaw));
                setLmxAutoDiscover(parseBoolean(autoDiscoverRaw, true));
                setLmxEndpoints(daemonClient.extractLmxEndpointCandidates(discovery));
                setLmxNotice(null);
            } catch (error) {
                if (cancelled) return;
                setLmxNotice(
                    `Failed to load daemon → LMX settings: ${error instanceof Error ? error.message : String(error)}`,
                );
            } finally {
                if (!cancelled) {
                    setLmxLoading(false);
                }
            }
        };

        void loadLmxTarget();
        return () => {
            cancelled = true;
        };
    }, [
        connection,
        connection.host,
        connection.port,
        connection.protocol,
        connection.token,
        isOpen,
    ]);

    async function runConnectionProbe() {
        const nextPort = Number.parseInt(form.port, 10);
        if (!Number.isFinite(nextPort)) {
            setProbeMessage("Invalid port");
            return;
        }

        setTestingConnection(true);
        setProbeMessage("Testing daemon endpoint...");
        try {
            const probe = await probeDaemonConnection({
                host: form.host.trim() || connection.host,
                port: nextPort,
                token: form.token.trim(),
                protocol:
                    form.protocol === "http" || form.protocol === "https"
                        ? form.protocol
                        : undefined,
            });

            if (probe.type !== "offline" && !form.protocol) {
                setForm((prev) => ({ ...prev, protocol: probe.protocol }));
            }

            setProbeMessage(
                `Probe ${probe.diagnostic.toLowerCase()} via ${probe.url} (${probe.type})`,
            );
        } catch (error) {
            setProbeMessage(
                `Probe failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setTestingConnection(false);
        }
    }

    async function runLmxProbe() {
        const targetHost = lmxHost.trim() || connection.host;
        const targetPort = Number.parseInt(lmxPort, 10);
        if (!Number.isFinite(targetPort)) {
            setLmxNotice("Invalid LMX port");
            return;
        }

        setLmxNotice("Testing LMX target...");
        try {
            const probe = await probeDaemonConnection({
                host: targetHost,
                port: targetPort,
                token: form.token.trim() || connection.token,
                protocol:
                    form.protocol === "http" || form.protocol === "https"
                        ? form.protocol
                        : connection.protocol,
            });
            setLmxNotice(
                `LMX target ${probe.diagnostic.toLowerCase()} via ${probe.url} (${probe.type})`,
            );
        } catch (error) {
            setLmxNotice(
                `LMX probe failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async function discoverLmxEndpoints() {
        setLmxNotice("Discovering LMX endpoints...");
        try {
            const discovery = await daemonClient.lmxDiscovery(connection);
            const candidates = daemonClient.extractLmxEndpointCandidates(discovery);
            setLmxEndpoints(candidates);
            setLmxNotice(
                candidates.length > 0
                    ? `Discovered ${candidates.length} endpoint${candidates.length === 1 ? "" : "s"}`
                    : "No LMX endpoints discovered",
            );
        } catch (error) {
            setLmxNotice(
                `Endpoint discovery failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async function saveLmxNetwork(event: React.FormEvent) {
        event.preventDefault();
        const nextHost = lmxHost.trim() || connection.host;
        const nextPort = Number.parseInt(lmxPort, 10);
        if (!Number.isFinite(nextPort)) {
            setLmxNotice("Invalid LMX port");
            return;
        }

        setLmxSaving(true);
        setLmxNotice("Saving daemon → LMX settings...");
        try {
            await Promise.all([
                daemonClient.configSet(connection, "connection.host", nextHost),
                daemonClient.configSet(connection, "connection.port", nextPort),
                daemonClient.configSet(
                    connection,
                    "connection.fallbackHosts",
                    parseHostList(lmxFallbackHosts),
                ),
                daemonClient.configSet(
                    connection,
                    "connection.autoDiscover",
                    lmxAutoDiscover,
                ),
            ]);
            setLmxNotice("Saved daemon → LMX network settings");
        } catch (error) {
            setLmxNotice(
                `Failed to save daemon → LMX settings: ${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            setLmxSaving(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
                <header className="modal-header">
                    <h2><SettingsIcon size={14} style={{ marginRight: '8px' }} />Settings Control</h2>
                    <button type="button" className="icon-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </header>

                <div className="modal-body">
                    <section className="settings-section">
                        <h3>Daemon Connection</h3>
                        <form
                            className="settings-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const nextPort = Number.parseInt(form.port, 10);
                                onSaveConnection({
                                    host: form.host.trim() || connection.host,
                                    port: Number.isFinite(nextPort) ? nextPort : connection.port,
                                    token: form.token.trim(),
                                    protocol:
                                        form.protocol === "http" ||
                                        form.protocol === "https"
                                            ? form.protocol
                                            : undefined,
                                });
                                onClose();
                            }}
                        >
                            <label>
                                Host
                                <input
                                    placeholder="127.0.0.1"
                                    value={form.host}
                                    onChange={(e) => setForm(prev => ({ ...prev, host: e.target.value }))}
                                />
                            </label>
                            <label>
                                Port
                                <input
                                    placeholder="9999"
                                    value={form.port}
                                    onChange={(e) => setForm(prev => ({ ...prev, port: e.target.value }))}
                                />
                            </label>
                            <label>
                                Protocol
                                <select
                                    value={form.protocol}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            protocol: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="">Auto-detect</option>
                                    <option value="http">http</option>
                                    <option value="https">https</option>
                                </select>
                            </label>
                            <label className="token-label">
                                Token
                                <div className="token-input-wrap">
                                    <input
                                        type={showToken ? "text" : "password"}
                                        placeholder="Leave blank for unauthenticated"
                                        value={form.token}
                                        onChange={(e) => setForm(prev => ({ ...prev, token: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        className="token-toggle"
                                        onClick={() => setShowToken((v) => !v)}
                                    >
                                        {showToken ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "10px",
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    disabled={testingConnection}
                                    onClick={() => void runConnectionProbe()}
                                >
                                    {testingConnection ? "Testing..." : "Test Connection"}
                                </button>
                                {probeMessage ? (
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            color: "var(--opta-text-secondary)",
                                        }}
                                    >
                                        {probeMessage}
                                    </span>
                                ) : null}
                            </div>
                            <div className="settings-actions">
                                <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                                <button type="submit" className="btn-primary">Save & Restart Daemon Fetch</button>
                            </div>
                        </form>
                    </section>

                    <section className="settings-section">
                        <h3>Daemon → LMX Network</h3>
                        <form className="settings-form" onSubmit={(event) => void saveLmxNetwork(event)}>
                            <label>
                                LMX Host
                                <input
                                    placeholder="localhost"
                                    value={lmxHost}
                                    onChange={(event) => setLmxHost(event.target.value)}
                                />
                            </label>
                            <label>
                                LMX Port
                                <input
                                    placeholder="1234"
                                    value={lmxPort}
                                    onChange={(event) => setLmxPort(event.target.value)}
                                />
                            </label>
                            <label>
                                Fallback Hosts
                                <input
                                    placeholder="host1:1234, host2:1234"
                                    value={lmxFallbackHosts}
                                    onChange={(event) => setLmxFallbackHosts(event.target.value)}
                                />
                            </label>
                            <label>
                                Auto Discover
                                <select
                                    value={lmxAutoDiscover ? "true" : "false"}
                                    onChange={(event) =>
                                        setLmxAutoDiscover(event.target.value === "true")
                                    }
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </label>
                            <div className="settings-inline-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    disabled={lmxLoading || lmxSaving}
                                    onClick={() => void runLmxProbe()}
                                >
                                    Test LMX Target
                                </button>
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    disabled={lmxLoading || lmxSaving}
                                    onClick={() => void discoverLmxEndpoints()}
                                >
                                    Discover Endpoints
                                </button>
                                {lmxNotice ? (
                                    <span className="settings-inline-message">{lmxNotice}</span>
                                ) : null}
                            </div>
                            {lmxEndpoints.length > 0 ? (
                                <div className="settings-endpoint-list">
                                    {lmxEndpoints.map((endpoint) => (
                                        <div key={endpoint.id} className="settings-endpoint-item">
                                            <div>
                                                <strong>{endpoint.host}:{endpoint.port}</strong>
                                                <span>{endpoint.source}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-cancel"
                                                onClick={() => {
                                                    setLmxHost(endpoint.host);
                                                    setLmxPort(String(endpoint.port));
                                                    setLmxNotice(`Selected ${endpoint.url}`);
                                                }}
                                            >
                                                Use
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <div className="settings-actions">
                                <button type="submit" className="btn-primary" disabled={lmxSaving}>
                                    {lmxSaving ? "Saving..." : "Save LMX Target"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
