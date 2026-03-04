import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

export function SettingsTabPolicy({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Policy core
    const [enabled, setEnabled] = useState(true);
    const [gateAllAutonomy, setGateAllAutonomy] = useState(true);
    const [failureMode, setFailureMode] = useState("closed");
    const [requireApprovalForModeSwitch, setRequireApprovalForModeSwitch] = useState(true);

    // Runtime enforcement
    const [rtEnabled, setRtEnabled] = useState(false);
    const [rtEndpoint, setRtEndpoint] = useState("http://127.0.0.1:3002/api/capabilities/evaluate");
    const [rtTimeoutMs, setRtTimeoutMs] = useState(2500);
    const [rtFailOpen, setRtFailOpen] = useState(true);
    const [rtApplyDangerous, setRtApplyDangerous] = useState(true);
    const [rtApplyHighRisk, setRtApplyHighRisk] = useState(true);

    // Audit
    const [auditEnabled, setAuditEnabled] = useState(true);
    const [auditPath, setAuditPath] = useState(".opta/policy/audit.jsonl");
    const [auditRedact, setAuditRedact] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [en, ga, fm, ra, re, rep, rt, rfo, rad, rar, ae, ap, ars] = await Promise.all([
                g("policy.enabled", true), g("policy.gateAllAutonomy", true),
                g("policy.failureMode", "closed"), g("policy.requireApprovalForModeSwitch", true),
                g("policy.runtimeEnforcement.enabled", false),
                g("policy.runtimeEnforcement.endpoint", "http://127.0.0.1:3002/api/capabilities/evaluate"),
                g("policy.runtimeEnforcement.timeoutMs", 2500), g("policy.runtimeEnforcement.failOpen", true),
                g("policy.runtimeEnforcement.applyTo.dangerous", true), g("policy.runtimeEnforcement.applyTo.highRiskWrites", true),
                g("policy.audit.enabled", true), g("policy.audit.path", ".opta/policy/audit.jsonl"),
                g("policy.audit.redactSecrets", true),
            ]);
            if (cancelled) return;
            setEnabled(en !== false); setGateAllAutonomy(ga !== false);
            setFailureMode(String(fm ?? "closed")); setRequireApprovalForModeSwitch(ra !== false);
            setRtEnabled(re === true); setRtEndpoint(String(rep ?? "")); setRtTimeoutMs(Number(rt) || 2500);
            setRtFailOpen(rfo !== false); setRtApplyDangerous(rad !== false); setRtApplyHighRisk(rar !== false);
            setAuditEnabled(ae !== false); setAuditPath(String(ap ?? ".opta/policy/audit.jsonl"));
            setAuditRedact(ars !== false);
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("policy.enabled", enabled), s("policy.gateAllAutonomy", gateAllAutonomy),
            s("policy.failureMode", failureMode), s("policy.requireApprovalForModeSwitch", requireApprovalForModeSwitch),
            s("policy.runtimeEnforcement.enabled", rtEnabled), s("policy.runtimeEnforcement.endpoint", rtEndpoint),
            s("policy.runtimeEnforcement.timeoutMs", rtTimeoutMs), s("policy.runtimeEnforcement.failOpen", rtFailOpen),
            s("policy.runtimeEnforcement.applyTo.dangerous", rtApplyDangerous),
            s("policy.runtimeEnforcement.applyTo.highRiskWrites", rtApplyHighRisk),
            s("policy.audit.enabled", auditEnabled), s("policy.audit.path", auditPath),
            s("policy.audit.redactSecrets", auditRedact),
        ]);
        setSaving(false);
    }, [connection, enabled, gateAllAutonomy, failureMode, requireApprovalForModeSwitch,
        rtEnabled, rtEndpoint, rtTimeoutMs, rtFailOpen, rtApplyDangerous, rtApplyHighRisk,
        auditEnabled, auditPath, auditRedact]);

    if (loading) return <div className="settings-tab-loading">Loading policy settings...</div>;

    return (
        <motion.div key="policy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <h3 className="opta-studio-section-title">Policy &amp; Audit</h3>
                    <p className="st-desc">Global permission policies, runtime enforcement, and audit logging.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Policy Core</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Policy evaluation enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={gateAllAutonomy} onChange={e => setGateAllAutonomy(e.target.checked)} /> Gate all autonomy decisions</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={requireApprovalForModeSwitch} onChange={e => setRequireApprovalForModeSwitch(e.target.checked)} /> Require approval for mode switches</label>
                <label className="st-label">Failure Mode
                    <select className="st-select" value={failureMode} onChange={e => setFailureMode(e.target.value)}>
                        <option value="closed">Closed (deny on failure)</option>
                        <option value="degraded-safe">Degraded Safe</option>
                        <option value="open">Open (allow on failure)</option>
                    </select>
                </label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Runtime Enforcement</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtEnabled} onChange={e => setRtEnabled(e.target.checked)} /> Runtime enforcement enabled</label>
                <label className="st-label">Endpoint <input className="st-input" value={rtEndpoint} onChange={e => setRtEndpoint(e.target.value)} /></label>
                <div className="st-row">
                    <label className="st-label">Timeout (ms) <input className="st-input" type="number" value={rtTimeoutMs} onChange={e => setRtTimeoutMs(Number(e.target.value))} min={100} max={30000} /></label>
                    <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtFailOpen} onChange={e => setRtFailOpen(e.target.checked)} /> Fail open</label>
                </div>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtApplyDangerous} onChange={e => setRtApplyDangerous(e.target.checked)} /> Apply to dangerous operations</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtApplyHighRisk} onChange={e => setRtApplyHighRisk(e.target.checked)} /> Apply to high-risk writes</label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Audit</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={auditEnabled} onChange={e => setAuditEnabled(e.target.checked)} /> Audit logging enabled</label>
                <label className="st-label">Audit Path <input className="st-input" value={auditPath} onChange={e => setAuditPath(e.target.value)} /></label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={auditRedact} onChange={e => setAuditRedact(e.target.checked)} /> Redact secrets in audit log</label>
            </fieldset>
        </motion.div>
    );
}
