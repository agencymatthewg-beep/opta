/**
 * TunnelWizard.tsx — Single-flow setup for Opta Anywhere.
 *
 * States:
 *   0 — Intro / Idle
 *   1 — Enabling (live backend progress)
 *   2 — Connected (URL available)
 */

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 0 | 1 | 2;

interface LogLine {
    text: string;
    ok?: boolean;
}

interface ProgressPayload {
    line?: string;
    message?: string;
    ok?: boolean;
}

interface EnableOptaAnywhereResult {
    ok?: boolean;
    url?: string;
    tunnelUrl?: string;
    message?: string;
    error?: string;
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
    const [tunnelUrl, setTunnelUrl] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const listenerRef = useRef<UnlistenFn | null>(null);
    const tunnelName = "opta-lmx";
    const genericEnableError = "Unable to enable Opta Anywhere. Review the setup log and try again.";

    const addLog = (text: string, ok?: boolean) =>
        setLogs(prev => [...prev, { text, ok }]);

    // Cleanup listeners on unmount
    useEffect(() => {
        return () => { listenerRef.current?.(); };
    }, []);

    const normalizeProgress = (payload: unknown): ProgressPayload => {
        if (typeof payload === "string") {
            return { line: payload };
        }

        if (!payload || typeof payload !== "object") {
            return { line: String(payload) };
        }

        const value = payload as Record<string, unknown>;
        return {
            line: typeof value.line === "string"
                ? value.line
                : typeof value.message === "string"
                    ? value.message
                    : JSON.stringify(value),
            message: typeof value.message === "string" ? value.message : undefined,
            ok: typeof value.ok === "boolean" ? value.ok : undefined,
        };
    };

    const runEnable = async () => {
        setBusy(true);
        setStep(1);
        setLogs([]);
        setError(null);

        listenerRef.current?.();
        listenerRef.current = await listen<{ line: string; ok?: boolean }>(
            "opta-anywhere-progress",
            (e) => {
                const progress = normalizeProgress(e.payload);
                addLog(progress.line ?? progress.message ?? "", progress.ok);
            },
        );

        try {
            const payload: { lmxHost: string; lmxPort: number; tunnelName?: string } = {
                lmxHost,
                lmxPort,
            };
            if (tunnelName.trim()) {
                payload.tunnelName = tunnelName.trim();
            }

            const result = await invoke<EnableOptaAnywhereResult>(
                "enable_opta_anywhere",
                payload,
            );
            const url = result.url?.trim() || result.tunnelUrl?.trim() || "";
            const success = Boolean(url) || result.ok === true;

            if (success && url) {
                setTunnelUrl(url);
                addLog(`Opta Anywhere URL: ${url}`, true);
                if (result.ok === false && (result.message || result.error)) {
                    addLog(result.message ?? result.error ?? "Some setup steps reported warnings.", false);
                }
                setStep(2);
                onComplete(url);
                return;
            }

            const failureMessage = result.message ?? result.error ?? "Unable to enable Opta Anywhere.";
            addLog(failureMessage, false);
            setError(genericEnableError);
            setStep(0);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            addLog(message, false);
            setError(genericEnableError);
            setStep(0);
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
                <StepDots current={step} total={3} />

                {/* ─── Intro + Enabling ─── */}
                {(step === 0 || step === 1) && (
                    <div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.75rem", margin: "0 0 0.75rem" }}>
                            Opta Anywhere
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.875rem", lineHeight: 1.6, margin: "0 0 1.25rem" }}>
                            Enable secure remote access for your Opta LMX with one guided setup. Opta will configure everything and return a shareable URL when ready.
                        </p>
                        <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr",
                            gap: "0.75rem", marginBottom: "1.5rem",
                        }}>
                            {[
                                { label: "At Home (LAN)", desc: "Direct connection\n~5ms latency", color: "#10b981" },
                                { label: "Away (WAN)", desc: "Encrypted connection\n~80ms latency", color: "#8b5cf6" },
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
                        {logs.length > 0 && <LogTerminal lines={logs} />}
                        {!busy && (
                            <p style={{ color: "#52525b", fontSize: "0.78rem", margin: "0.9rem 0 1.5rem", lineHeight: 1.5 }}>
                                This setup keeps local and remote access aligned so Opta Code Desktop can connect reliably from anywhere.
                            </p>
                        )}
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                type="button"
                                style={{
                                    flex: 1, background: "#8b5cf6",
                                    border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
                                }}
                                onClick={() => void runEnable()}
                                disabled={busy}
                            >
                                {busy && <Spinner />}
                                {busy ? "Enabling Opta Anywhere…" : "Enable Opta Anywhere"}
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
                                {busy ? "Cancel" : "Skip for Now"}
                            </button>
                        </div>
                        {error && (
                            <div style={{
                                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                                borderRadius: "8px", padding: "0.75rem",
                                color: "#fca5a5", fontSize: "0.8rem", margin: "0.75rem 0",
                                fontFamily: "JetBrains Mono, monospace",
                            }}>{error}</div>
                        )}
                    </div>
                )}

                {/* ─── Connected ─── */}
                {step === 2 && (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: "48px", height: "48px", borderRadius: "50%",
                            background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 1rem",
                            fontSize: "1.4rem",
                        }}>✓</div>
                        <h2 style={{ color: "#fafafa", fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                            Opta Anywhere Connected
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", margin: "0 0 1rem", lineHeight: 1.5 }}>
                            Your remote access endpoint is active and ready to use.
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
                            <button
                                type="button"
                                style={{
                                    background: "#8b5cf6", border: "none", borderRadius: "8px",
                                    color: "#fff", fontFamily: "Sora, sans-serif",
                                    fontWeight: 600, fontSize: "0.875rem",
                                    padding: "0.6rem 1rem", cursor: "pointer", marginTop: "0.75rem",
                                }}
                                onClick={onClose}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
