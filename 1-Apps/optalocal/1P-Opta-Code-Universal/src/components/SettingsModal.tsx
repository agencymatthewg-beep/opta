import { useState, useEffect } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    connection: DaemonConnectionOptions;
    onSaveConnection: (conn: DaemonConnectionOptions) => void;
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

    useEffect(() => {
        setForm({
            host: connection.host,
            port: String(connection.port),
            token: connection.token,
            protocol: connection.protocol ?? "",
        });
        setProbeMessage(null);
    }, [connection, isOpen]);

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
                </div>
            </div>
        </div>
    );
}
