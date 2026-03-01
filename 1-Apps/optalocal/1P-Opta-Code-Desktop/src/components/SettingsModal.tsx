import { useState, useEffect } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import type { DaemonConnectionOptions } from "../types";

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
    });
    const [showToken, setShowToken] = useState(false);

    useEffect(() => {
        setForm({
            host: connection.host,
            port: String(connection.port),
            token: connection.token,
        });
    }, [connection, isOpen]);

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
