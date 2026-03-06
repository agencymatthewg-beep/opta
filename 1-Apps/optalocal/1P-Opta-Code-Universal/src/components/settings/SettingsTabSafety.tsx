import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

export function SettingsTabSafety({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Safety
    const [maxToolCalls, setMaxToolCalls] = useState(30);
    const [maxParallelTools, setMaxParallelTools] = useState(8);
    const [diskHeadroomMb, setDiskHeadroomMb] = useState(64);
    const [compactAt, setCompactAt] = useState(0.7);

    // Circuit Breaker
    const [cbWarnAt, setCbWarnAt] = useState(20);
    const [cbPauseAt, setCbPauseAt] = useState(40);
    const [cbHardStopAt, setCbHardStopAt] = useState(100);
    const [cbSilentBehavior, setCbSilentBehavior] = useState("stop");

    // Computer Control
    const [fgEnabled, setFgEnabled] = useState(false);
    const [fgRequireDangerous, setFgRequireDangerous] = useState(true);
    const [fgAllowScreenActions, setFgAllowScreenActions] = useState(false);
    const [bgEnabled, setBgEnabled] = useState(true);
    const [bgAllowBrowserHosting, setBgAllowBrowserHosting] = useState(true);
    const [bgAllowScreenStreaming, setBgAllowScreenStreaming] = useState(true);
    const [bgMaxBrowserSessions, setBgMaxBrowserSessions] = useState(5);

    // Git
    const [gitAutoCommit, setGitAutoCommit] = useState(true);
    const [gitCheckpoints, setGitCheckpoints] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [mt, mp, dh, ca, cw, cp, chs, csb, fe, fd, fa, be, bbh, bss, bmbs, gac, gc] = await Promise.all([
                g("safety.maxToolCalls", 30), g("safety.maxParallelTools", 8),
                g("safety.diskHeadroomMb", 64), g("safety.compactAt", 0.7),
                g("safety.circuitBreaker.warnAt", 20), g("safety.circuitBreaker.pauseAt", 40),
                g("safety.circuitBreaker.hardStopAt", 100), g("safety.circuitBreaker.silentBehavior", "stop"),
                g("computerControl.foreground.enabled", false), g("computerControl.foreground.requireDangerousMode", true),
                g("computerControl.foreground.allowScreenActions", false), g("computerControl.background.enabled", true),
                g("computerControl.background.allowBrowserSessionHosting", true),
                g("computerControl.background.allowScreenStreaming", true),
                g("computerControl.background.maxHostedBrowserSessions", 5),
                g("git.autoCommit", true), g("git.checkpoints", true),
            ]);
            if (cancelled) return;
            setMaxToolCalls(Number(mt) || 30); setMaxParallelTools(Number(mp) || 8);
            setDiskHeadroomMb(Number(dh) || 64); setCompactAt(Number(ca) || 0.7);
            setCbWarnAt(Number(cw) || 20); setCbPauseAt(Number(cp) || 40);
            setCbHardStopAt(Number(chs) || 100); setCbSilentBehavior(String(csb ?? "stop"));
            setFgEnabled(fe === true); setFgRequireDangerous(fd !== false); setFgAllowScreenActions(fa === true);
            setBgEnabled(be !== false); setBgAllowBrowserHosting(bbh !== false); setBgAllowScreenStreaming(bss !== false);
            setBgMaxBrowserSessions(Number(bmbs) || 5);
            setGitAutoCommit(gac !== false); setGitCheckpoints(gc !== false);
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("safety.maxToolCalls", maxToolCalls), s("safety.maxParallelTools", maxParallelTools),
            s("safety.diskHeadroomMb", diskHeadroomMb), s("safety.compactAt", compactAt),
            s("safety.circuitBreaker.warnAt", cbWarnAt), s("safety.circuitBreaker.pauseAt", cbPauseAt),
            s("safety.circuitBreaker.hardStopAt", cbHardStopAt), s("safety.circuitBreaker.silentBehavior", cbSilentBehavior),
            s("computerControl.foreground.enabled", fgEnabled), s("computerControl.foreground.requireDangerousMode", fgRequireDangerous),
            s("computerControl.foreground.allowScreenActions", fgAllowScreenActions),
            s("computerControl.background.enabled", bgEnabled), s("computerControl.background.allowBrowserSessionHosting", bgAllowBrowserHosting),
            s("computerControl.background.allowScreenStreaming", bgAllowScreenStreaming),
            s("computerControl.background.maxHostedBrowserSessions", bgMaxBrowserSessions),
            s("git.autoCommit", gitAutoCommit), s("git.checkpoints", gitCheckpoints),
        ]);
        setSaving(false);
    }, [connection, maxToolCalls, maxParallelTools, diskHeadroomMb, compactAt, cbWarnAt, cbPauseAt,
        cbHardStopAt, cbSilentBehavior, fgEnabled, fgRequireDangerous, fgAllowScreenActions,
        bgEnabled, bgAllowBrowserHosting, bgAllowScreenStreaming, bgMaxBrowserSessions, gitAutoCommit, gitCheckpoints]);

    if (loading) return <div className="settings-tab-loading">Loading safety settings...</div>;

    return (
        <motion.div key="safety" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <p className="st-desc">Configure execution limits, circuit breakers, computer control policies, and git behaviour.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Execution Limits</legend>
                <div className="st-row">
                    <label className="st-label">Max Tool Calls <input className="st-input" type="number" value={maxToolCalls} onChange={e => setMaxToolCalls(Number(e.target.value))} min={1} /></label>
                    <label className="st-label">Max Parallel Tools <input className="st-input" type="number" value={maxParallelTools} onChange={e => setMaxParallelTools(Number(e.target.value))} min={1} max={16} /></label>
                </div>
                <div className="st-row">
                    <label className="st-label">Disk Headroom (MB) <input className="st-input" type="number" value={diskHeadroomMb} onChange={e => setDiskHeadroomMb(Number(e.target.value))} min={1} /></label>
                    <label className="st-label">Compact At <input className="st-input" type="number" value={compactAt} onChange={e => setCompactAt(Number(e.target.value))} min={0} max={1} step={0.1} /></label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Circuit Breaker</legend>
                <div className="st-row">
                    <label className="st-label">Warn At <input className="st-input" type="number" value={cbWarnAt} onChange={e => setCbWarnAt(Number(e.target.value))} min={1} /></label>
                    <label className="st-label">Pause At <input className="st-input" type="number" value={cbPauseAt} onChange={e => setCbPauseAt(Number(e.target.value))} min={1} /></label>
                </div>
                <div className="st-row">
                    <label className="st-label">Hard Stop At <input className="st-input" type="number" value={cbHardStopAt} onChange={e => setCbHardStopAt(Number(e.target.value))} min={1} /></label>
                    <label className="st-label">Silent Behavior
                        <select className="st-select" value={cbSilentBehavior} onChange={e => setCbSilentBehavior(e.target.value)}>
                            <option value="stop">stop</option>
                            <option value="warn-and-continue">warn-and-continue</option>
                            <option value="error">error</option>
                        </select>
                    </label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Computer Control — Foreground</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={fgEnabled} onChange={e => setFgEnabled(e.target.checked)} /> Enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={fgRequireDangerous} onChange={e => setFgRequireDangerous(e.target.checked)} /> Require dangerous mode</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={fgAllowScreenActions} onChange={e => setFgAllowScreenActions(e.target.checked)} /> Allow screen actions</label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Computer Control — Background</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={bgEnabled} onChange={e => setBgEnabled(e.target.checked)} /> Enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={bgAllowBrowserHosting} onChange={e => setBgAllowBrowserHosting(e.target.checked)} /> Allow browser session hosting</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={bgAllowScreenStreaming} onChange={e => setBgAllowScreenStreaming(e.target.checked)} /> Allow screen streaming</label>
                <label className="st-label">Max Hosted Browser Sessions <input className="st-input" type="number" value={bgMaxBrowserSessions} onChange={e => setBgMaxBrowserSessions(Number(e.target.value))} min={1} max={5} /></label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Git</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={gitAutoCommit} onChange={e => setGitAutoCommit(e.target.checked)} /> Auto-commit on task completion</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={gitCheckpoints} onChange={e => setGitCheckpoints(e.target.checked)} /> Enable stash-based checkpoints</label>
            </fieldset>
        </motion.div>
    );
}
