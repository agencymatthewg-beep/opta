import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

export function SettingsTabToolsAgents({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Sub-agents
    const [saEnabled, setSaEnabled] = useState(true);
    const [saMaxDepth, setSaMaxDepth] = useState(2);
    const [saMaxConcurrent, setSaMaxConcurrent] = useState(3);
    const [saBudgetToolCalls, setSaBudgetToolCalls] = useState(15);
    const [saBudgetTokens, setSaBudgetTokens] = useState(8192);
    const [saBudgetTimeout, setSaBudgetTimeout] = useState(60000);
    const [saInheritMode, setSaInheritMode] = useState(true);

    // Background processes
    const [bgMaxConcurrent, setBgMaxConcurrent] = useState(5);
    const [bgDefaultTimeout, setBgDefaultTimeout] = useState(300000);
    const [bgMaxBufferSize, setBgMaxBufferSize] = useState(1048576);
    const [bgKillOnSessionEnd, setBgKillOnSessionEnd] = useState(true);

    // LSP
    const [lspEnabled, setLspEnabled] = useState(true);
    const [lspTimeout, setLspTimeout] = useState(10000);

    // TUI
    const [tuiDefault, setTuiDefault] = useState(false);
    const [tuiTone, setTuiTone] = useState("technical");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [se, sd, sc, sbt, sbto, sbtm, si, bm, bd, bbs, bk, le, lt, td, tt] = await Promise.all([
                g("subAgent.enabled", true), g("subAgent.maxDepth", 2), g("subAgent.maxConcurrent", 3),
                g("subAgent.defaultBudget.maxToolCalls", 15), g("subAgent.defaultBudget.maxTokens", 8192),
                g("subAgent.defaultBudget.timeoutMs", 60000), g("subAgent.inheritMode", true),
                g("background.maxConcurrent", 5), g("background.defaultTimeout", 300000),
                g("background.maxBufferSize", 1048576), g("background.killOnSessionEnd", true),
                g("lsp.enabled", true), g("lsp.timeout", 10000),
                g("tui.default", false), g("tui.responseIntentTone", "technical"),
            ]);
            if (cancelled) return;
            setSaEnabled(se !== false); setSaMaxDepth(Number(sd) || 2); setSaMaxConcurrent(Number(sc) || 3);
            setSaBudgetToolCalls(Number(sbt) || 15); setSaBudgetTokens(Number(sbto) || 8192);
            setSaBudgetTimeout(Number(sbtm) || 60000); setSaInheritMode(si !== false);
            setBgMaxConcurrent(Number(bm) || 5); setBgDefaultTimeout(Number(bd) || 300000);
            setBgMaxBufferSize(Number(bbs) || 1048576); setBgKillOnSessionEnd(bk !== false);
            setLspEnabled(le !== false); setLspTimeout(Number(lt) || 10000);
            setTuiDefault(td === true); setTuiTone(String(tt ?? "technical"));
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("subAgent.enabled", saEnabled), s("subAgent.maxDepth", saMaxDepth), s("subAgent.maxConcurrent", saMaxConcurrent),
            s("subAgent.defaultBudget.maxToolCalls", saBudgetToolCalls), s("subAgent.defaultBudget.maxTokens", saBudgetTokens),
            s("subAgent.defaultBudget.timeoutMs", saBudgetTimeout), s("subAgent.inheritMode", saInheritMode),
            s("background.maxConcurrent", bgMaxConcurrent), s("background.defaultTimeout", bgDefaultTimeout),
            s("background.maxBufferSize", bgMaxBufferSize), s("background.killOnSessionEnd", bgKillOnSessionEnd),
            s("lsp.enabled", lspEnabled), s("lsp.timeout", lspTimeout),
            s("tui.default", tuiDefault), s("tui.responseIntentTone", tuiTone),
        ]);
        setSaving(false);
    }, [connection, saEnabled, saMaxDepth, saMaxConcurrent, saBudgetToolCalls, saBudgetTokens,
        saBudgetTimeout, saInheritMode, bgMaxConcurrent, bgDefaultTimeout, bgMaxBufferSize,
        bgKillOnSessionEnd, lspEnabled, lspTimeout, tuiDefault, tuiTone]);

    if (loading) return <div className="settings-tab-loading">Loading tools &amp; agents settings...</div>;

    return (
        <motion.div key="tools" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <h3 className="opta-studio-section-title">Tools &amp; Agents</h3>
                    <p className="st-desc">Sub-agent delegation, background process limits, LSP, and TUI preferences.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Sub-Agents</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={saEnabled} onChange={e => setSaEnabled(e.target.checked)} /> Enable sub-agent delegation</label>
                <div className="st-row">
                    <label className="st-label">Max Depth <input className="st-input" type="number" value={saMaxDepth} onChange={e => setSaMaxDepth(Number(e.target.value))} min={1} max={10} /></label>
                    <label className="st-label">Max Concurrent <input className="st-input" type="number" value={saMaxConcurrent} onChange={e => setSaMaxConcurrent(Number(e.target.value))} min={1} max={10} /></label>
                </div>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={saInheritMode} onChange={e => setSaInheritMode(e.target.checked)} /> Inherit parent mode</label>
                <fieldset className="st-fieldset-inner">
                    <legend className="st-legend-inner">Default Budget</legend>
                    <div className="st-row">
                        <label className="st-label">Max Tool Calls <input className="st-input" type="number" value={saBudgetToolCalls} onChange={e => setSaBudgetToolCalls(Number(e.target.value))} min={1} /></label>
                        <label className="st-label">Max Tokens <input className="st-input" type="number" value={saBudgetTokens} onChange={e => setSaBudgetTokens(Number(e.target.value))} min={1} /></label>
                        <label className="st-label">Timeout (ms) <input className="st-input" type="number" value={saBudgetTimeout} onChange={e => setSaBudgetTimeout(Number(e.target.value))} min={1000} /></label>
                    </div>
                </fieldset>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Background Processes</legend>
                <div className="st-row">
                    <label className="st-label">Max Concurrent <input className="st-input" type="number" value={bgMaxConcurrent} onChange={e => setBgMaxConcurrent(Number(e.target.value))} min={1} max={20} /></label>
                    <label className="st-label">Default Timeout (ms) <input className="st-input" type="number" value={bgDefaultTimeout} onChange={e => setBgDefaultTimeout(Number(e.target.value))} min={0} /></label>
                </div>
                <label className="st-label">Max Buffer Size (bytes) <input className="st-input" type="number" value={bgMaxBufferSize} onChange={e => setBgMaxBufferSize(Number(e.target.value))} min={1024} /></label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={bgKillOnSessionEnd} onChange={e => setBgKillOnSessionEnd(e.target.checked)} /> Kill background processes on session end</label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">LSP</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={lspEnabled} onChange={e => setLspEnabled(e.target.checked)} /> LSP enabled</label>
                <label className="st-label">Timeout (ms) <input className="st-input" type="number" value={lspTimeout} onChange={e => setLspTimeout(Number(e.target.value))} min={1000} /></label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">TUI Preferences</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={tuiDefault} onChange={e => setTuiDefault(e.target.checked)} /> Default to TUI mode</label>
                <label className="st-label">Response Tone
                    <select className="st-select" value={tuiTone} onChange={e => setTuiTone(e.target.value)}>
                        <option value="concise">Concise</option>
                        <option value="technical">Technical</option>
                        <option value="product">Product</option>
                    </select>
                </label>
            </fieldset>
        </motion.div>
    );
}
