/**
 * TunnelWizard.tsx — Guided 5-step setup wizard for Cloudflare Tunnel.
 *
 * Steps:
 *   0 — Intro / Pitch
 *   1 — Install cloudflared (silent brew install with live log)
 *   2 — Cloudflare Auth (browser opens, we poll for cert.pem)
 *   3 — Auto-Provision tunnel (create + route DNS)
 *   4 — Done — shows URL + writes to address book
 */

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 0 | 1 | 2 | 3 | 4;

interface LogLine {
    text: string;
    ok?: boolean;
}

interface TunnelWizardProps {
    lmxHost: string;
    lmxPort: number;
    onClose: () => void;
    onComplete: (tunnelUrl: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Spinner() {
    return (
        <span style={{
            display: "inline-block",
            width: "14px",
            height: "14px",
            border: "2px solid rgba(139,92,246,0.3)",
            borderTopColor: "#8b5cf6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
        }} />
    );
}

function StepDots({ current, total }: { current: WizardStep; total: number }) {
    return (
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "1.5rem" }}>
            {Array.from({ length: total }, (_, i) => (
                <div key={i} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: i === current
                        ? "#8b5cf6"
                        : i < current
                            ? "#10b981"
                            : "rgba(255,255,255,0.15)",
                    transition: "background 0.3s ease",
                }} />
            ))}
        </div>
    );
}

function LogTerminal({ lines }: { lines: LogLine[] }) {
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines]);

    return (
        <div style={{
            background: "#0a0a0c",
            border: "1px solid rgba(63,63,70,0.6)",
            borderRadius: "8px",
            padding: "0.75rem",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.75rem",
            maxHeight: "160px",
            overflowY: "auto",
            color: "#a1a1aa",
            lineHeight: 1.6,
        }}>
            {lines.map((l, i) => (
                <div key={i} style={{ color: l.ok === false ? "#ef4444" : l.ok === true ? "#10b981" : "#a1a1aa" }}>
                    {l.ok === true ? "✓ " : l.ok === false ? "✗ " : "  "}{l.text}
                </div>
            ))}
            <div ref={endRef} />
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TunnelWizard({ lmxHost, lmxPort, onClose, onComplete }: TunnelWizardProps) {
    const [step, setStep] = useState<WizardStep>(0);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [tunnelName, setTunnelName] = useState("opta-lmx");
    const [tunnelUrl, setTunnelUrl] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const listenerRef = useRef<UnlistenFn | null>(null);

    const addLog = (text: string, ok?: boolean) =>
        setLogs(prev => [...prev, { text, ok }]);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => { listenerRef.current?.(); };
    }, []);

    // ── Step 1: Install cloudflared ──────────────────────────────────────────

    const runInstall = async () => {
        setBusy(true);
        setLogs([]);
        setError(null);

        // Subscribe to install progress events from Rust
        listenerRef.current = await listen<{ line: string; ok?: boolean }>(
            "tunnel-install-progress",
            (e) => addLog(e.payload.line, e.payload.ok),
        );

        try {
            const result = await invoke<{ ok: boolean; message?: string }>(
                "install_cloudflared"
            );
            if (result.ok) {
                addLog("cloudflared installed successfully.", true);
                setTimeout(() => setStep(2), 800);
            } else {
                setError(result.message ?? "Installation failed.");
            }
        } catch (e) {
            setError(String(e));
        } finally {
            listenerRef.current?.();
            listenerRef.current = null;
            setBusy(false);
        }
    };

    // ── Step 2: Auth ─────────────────────────────────────────────────────────

    const runAuth = async () => {
        setBusy(true);
        setError(null);
        try {
            // This opens the Cloudflare browser page + polls for cert.pem
            await invoke("start_cloudflared_login");
            setStep(3);
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
        }
    };

    // ── Step 3: Provision tunnel ──────────────────────────────────────────────

    const runProvision = async () => {
        setBusy(true);
        setLogs([]);
        setError(null);

        listenerRef.current = await listen<{ line: string; ok?: boolean }>(
            "tunnel-provision-progress",
            (e) => addLog(e.payload.line, e.payload.ok),
        );

        try {
            const result = await invoke<{ ok: boolean; url: string; message?: string }>(
                "provision_cloudflared_tunnel",
                { name: tunnelName.trim() || "opta-lmx", lmxHost, lmxPort },
            );
            if (result.ok && result.url) {
                setTunnelUrl(result.url);
                addLog(`Tunnel URL: ${result.url}`, true);

                // Auto-write to address book shared config
                await invoke("write_tunnel_to_address_book", {
                    lmxHost,
                    lmxPort,
                    tunnelUrl: result.url,
                }).catch(() => { /* Non-fatal if address book write fails */ });

                setTimeout(() => setStep(4), 600);
            } else {
                setError(result.message ?? "Provisioning failed.");
            }
        } catch (e) {
            setError(String(e));
        } finally {
            listenerRef.current?.();
            listenerRef.current = null;
            setBusy(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                background: "rgba(9,9,11,0.85)",
                backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "1rem",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: "#18181b",
                border: "1px solid rgba(63,63,70,0.7)",
                borderRadius: "16px",
                padding: "2rem",
                width: "100%",
                maxWidth: "480px",
                boxShadow: "0 0 60px rgba(139,92,246,0.08)",
                fontFamily: "Sora, sans-serif",
            }}>
                <StepDots current={step} total={5} />

                {/* ─── Step 0: Intro ─── */}
                {step === 0 && (
                    <div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.75rem", margin: "0 0 0.75rem" }}>
                            Remote Access Setup
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.875rem", lineHeight: 1.6, margin: "0 0 1.25rem" }}>
                            Set up a secure Cloudflare Tunnel so you can access your Opta LMX models from anywhere — no port forwarding, no dynamic DNS, no VPN required.
                        </p>
                        <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr",
                            gap: "0.75rem", marginBottom: "1.5rem",
                        }}>
                            {[
                                { label: "At Home (LAN)", desc: "Direct connection\n~5ms latency", color: "#10b981" },
                                { label: "Away (WAN)", desc: "Encrypted tunnel\n~80ms latency", color: "#8b5cf6" },
                            ].map(({ label, desc, color }) => (
                                <div key={label} style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: `1px solid rgba(63,63,70,0.5)`,
                                    borderRadius: "10px",
                                    padding: "0.875rem",
                                    textAlign: "center",
                                }}>
                                    <div style={{ color, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.35rem" }}>{label}</div>
                                    <div style={{ color: "#71717a", fontSize: "0.75rem", whiteSpace: "pre-line", fontFamily: "JetBrains Mono, monospace" }}>{desc}</div>
                                </div>
                            ))}
                        </div>
                        <p style={{ color: "#52525b", fontSize: "0.78rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
                            This will install <code style={{ color: "#a1a1aa" }}>cloudflared</code> on your machine, create an encrypted tunnel, and wire it into Opta Code Desktop automatically.
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                type="button"
                                style={{
                                    flex: 1, background: "#8b5cf6",
                                    border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: "pointer",
                                }}
                                onClick={() => setStep(1)}
                            >
                                Set Up Remote Access
                            </button>
                            <button
                                type="button"
                                style={{
                                    background: "transparent",
                                    border: "1px solid rgba(63,63,70,0.6)",
                                    borderRadius: "8px",
                                    color: "#71717a", fontFamily: "Sora, sans-serif",
                                    fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: "pointer",
                                }}
                                onClick={onClose}
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Step 1: Install ─── */}
                {step === 1 && (
                    <div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                            Install cloudflared
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                            The <code style={{ color: "#a1a1aa" }}>cloudflared</code> daemon creates and manages the encrypted tunnel. It only needs to be installed once.
                        </p>
                        {logs.length > 0 && <LogTerminal lines={logs} />}
                        {error && (
                            <div style={{
                                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: "8px", padding: "0.75rem",
                                color: "#fca5a5", fontSize: "0.8rem", margin: "0.75rem 0",
                                fontFamily: "JetBrains Mono, monospace",
                            }}>{error}</div>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runInstall()}
                                style={{
                                    flex: 1, background: busy ? "rgba(139,92,246,0.3)" : "#8b5cf6",
                                    border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: busy ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
                                }}
                            >
                                {busy && <Spinner />}
                                {busy ? "Installing…" : "Install via Homebrew"}
                            </button>
                            <button type="button" style={{ background: "transparent", border: "1px solid rgba(63,63,70,0.6)", borderRadius: "8px", color: "#71717a", fontFamily: "Sora, sans-serif", fontSize: "0.875rem", padding: "0.6rem 1rem", cursor: "pointer" }} onClick={onClose}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* ─── Step 2: Auth ─── */}
                {step === 2 && (
                    <div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                            Connect to Cloudflare
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                            We'll open your browser to authorize the tunnel. Log in with your Cloudflare account — Opta Init will detect completion automatically.
                        </p>
                        <div style={{
                            background: "rgba(139,92,246,0.06)",
                            border: "1px solid rgba(139,92,246,0.25)",
                            borderRadius: "10px", padding: "0.875rem",
                            color: "#a1a1aa", fontSize: "0.82rem", lineHeight: 1.6,
                            marginBottom: "1rem",
                        }}>
                            <strong style={{ color: "#fafafa" }}>What happens:</strong><br />
                            1. Your browser opens to cloudflare.com/login<br />
                            2. You approve the tunnel in Cloudflare's UI<br />
                            3. Opta Init detects the approval and continues automatically
                        </div>
                        {error && (
                            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem", color: "#fca5a5", fontSize: "0.8rem", margin: "0.75rem 0", fontFamily: "JetBrains Mono, monospace" }}>{error}</div>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runAuth()}
                                style={{
                                    flex: 1, background: busy ? "rgba(139,92,246,0.3)" : "#8b5cf6",
                                    border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: busy ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
                                }}
                            >
                                {busy && <Spinner />}
                                {busy ? "Waiting for browser approval…" : "Open Cloudflare Login"}
                            </button>
                            <button type="button" style={{ background: "transparent", border: "1px solid rgba(63,63,70,0.6)", borderRadius: "8px", color: "#71717a", fontFamily: "Sora, sans-serif", fontSize: "0.875rem", padding: "0.6rem 1rem", cursor: "pointer" }} onClick={onClose}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* ─── Step 3: Provision ─── */}
                {step === 3 && (
                    <div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                            Create Tunnel
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                            Give your tunnel a name. A stable HTTPS URL will be created and wired into Opta Code Desktop automatically.
                        </p>
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", color: "#a1a1aa", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
                                Tunnel name
                            </label>
                            <input
                                type="text"
                                value={tunnelName}
                                onChange={(e) => setTunnelName(e.target.value)}
                                style={{
                                    width: "100%", background: "#0a0a0c",
                                    border: "1px solid rgba(63,63,70,0.6)", borderRadius: "8px",
                                    color: "#fafafa", fontFamily: "JetBrains Mono, monospace",
                                    fontSize: "0.875rem", padding: "0.5rem 0.75rem",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        {logs.length > 0 && <LogTerminal lines={logs} />}
                        {error && (
                            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "0.75rem", color: "#fca5a5", fontSize: "0.8rem", margin: "0.75rem 0", fontFamily: "JetBrains Mono, monospace" }}>{error}</div>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runProvision()}
                                style={{
                                    flex: 1, background: busy ? "rgba(139,92,246,0.3)" : "#8b5cf6",
                                    border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: busy ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
                                }}
                            >
                                {busy && <Spinner />}
                                {busy ? "Provisioning…" : "Create Tunnel"}
                            </button>
                            <button type="button" style={{ background: "transparent", border: "1px solid rgba(63,63,70,0.6)", borderRadius: "8px", color: "#71717a", fontFamily: "Sora, sans-serif", fontSize: "0.875rem", padding: "0.6rem 1rem", cursor: "pointer" }} onClick={onClose}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* ─── Step 4: Done ─── */}
                {step === 4 && (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: "48px", height: "48px", borderRadius: "50%",
                            background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1rem",
                            fontSize: "1.4rem",
                        }}>✓</div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                            Tunnel Active
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                            Your tunnel is live and has been wired into Opta Code Desktop. You can now access your models from anywhere.
                        </p>
                        {tunnelUrl && (
                            <div style={{
                                background: "rgba(16,185,129,0.06)",
                                border: "1px solid rgba(16,185,129,0.25)",
                                borderRadius: "8px", padding: "0.75rem",
                                fontFamily: "JetBrains Mono, monospace",
                                fontSize: "0.8rem", color: "#6ee7b7",
                                wordBreak: "break-all", marginBottom: "1.25rem",
                            }}>
                                {tunnelUrl}
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                {[
                                    { label: "LAN", latency: "~5ms", color: "#10b981" },
                                    { label: "WAN", latency: "~80ms", color: "#8b5cf6" },
                                ].map(({ label, latency, color }) => (
                                    <div key={label} style={{
                                        display: "flex", alignItems: "center", gap: "0.4rem",
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(63,63,70,0.5)",
                                        borderRadius: "6px", padding: "0.35rem 0.75rem",
                                        fontSize: "0.8rem",
                                    }}>
                                        <span style={{ color, fontWeight: 600 }}>{label}</span>
                                        <span style={{ color: "#71717a", fontFamily: "JetBrains Mono, monospace" }}>{latency}</span>
                                        <span style={{ color: "#10b981" }}>✓</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                style={{
                                    background: "#8b5cf6", border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: "pointer", marginTop: "0.75rem",
                                }}
                                onClick={() => { onComplete(tunnelUrl); onClose(); }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
