import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

export function SettingsTabLearning({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Learning
    const [lrnEnabled, setLrnEnabled] = useState(true);
    const [captureLevel, setCaptureLevel] = useState("exhaustive");
    const [includeUnverified, setIncludeUnverified] = useState(true);
    const [ledgerPath, setLedgerPath] = useState(".opta/learning/ledger.jsonl");
    const [summaryDir, setSummaryDir] = useState(".opta/learning/summaries");

    // Journal
    const [jrnEnabled, setJrnEnabled] = useState(true);
    const [sessionLogsDir, setSessionLogsDir] = useState("12-Session-Logs");
    const [updateLogsDir, setUpdateLogsDir] = useState("updates");
    const [jrnAuthor, setJrnAuthor] = useState("");
    const [jrnTimezone, setJrnTimezone] = useState("local");

    // Reports
    const [rptEnabled, setRptEnabled] = useState(true);
    const [rptAutoOpen, setRptAutoOpen] = useState(true);
    const [rptOutputDir, setRptOutputDir] = useState(".opta/reports");
    const [rptToolCalls, setRptToolCalls] = useState(15);
    const [rptElapsedSec, setRptElapsedSec] = useState(120);

    // Insights
    const [insightsEnabled, setInsightsEnabled] = useState(true);

    // Context
    const [contextExportMap, setContextExportMap] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [le, cl, iu, lp, sd, je, sld, uld, ja, jt, re, rao, rod, rtc, res, ie, cem] = await Promise.all([
                g("learning.enabled", true), g("learning.captureLevel", "exhaustive"),
                g("learning.includeUnverified", true), g("learning.ledgerPath", ".opta/learning/ledger.jsonl"),
                g("learning.summaryDir", ".opta/learning/summaries"),
                g("journal.enabled", true), g("journal.sessionLogsDir", "12-Session-Logs"),
                g("journal.updateLogsDir", "updates"), g("journal.author", ""),
                g("journal.timezone", "local"),
                g("reports.enabled", true), g("reports.autoOpen", true),
                g("reports.outputDir", ".opta/reports"),
                g("reports.threshold.toolCalls", 15), g("reports.threshold.elapsedSeconds", 120),
                g("insights.enabled", true), g("context.exportMap", true),
            ]);
            if (cancelled) return;
            setLrnEnabled(le !== false); setCaptureLevel(String(cl ?? "exhaustive"));
            setIncludeUnverified(iu !== false); setLedgerPath(String(lp ?? ".opta/learning/ledger.jsonl"));
            setSummaryDir(String(sd ?? ".opta/learning/summaries"));
            setJrnEnabled(je !== false); setSessionLogsDir(String(sld ?? "12-Session-Logs"));
            setUpdateLogsDir(String(uld ?? "updates")); setJrnAuthor(String(ja ?? ""));
            setJrnTimezone(String(jt ?? "local"));
            setRptEnabled(re !== false); setRptAutoOpen(rao !== false);
            setRptOutputDir(String(rod ?? ".opta/reports"));
            setRptToolCalls(Number(rtc) || 15); setRptElapsedSec(Number(res) || 120);
            setInsightsEnabled(ie !== false); setContextExportMap(cem !== false);
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("learning.enabled", lrnEnabled), s("learning.captureLevel", captureLevel),
            s("learning.includeUnverified", includeUnverified), s("learning.ledgerPath", ledgerPath),
            s("learning.summaryDir", summaryDir),
            s("journal.enabled", jrnEnabled), s("journal.sessionLogsDir", sessionLogsDir),
            s("journal.updateLogsDir", updateLogsDir), s("journal.author", jrnAuthor),
            s("journal.timezone", jrnTimezone),
            s("reports.enabled", rptEnabled), s("reports.autoOpen", rptAutoOpen),
            s("reports.outputDir", rptOutputDir),
            s("reports.threshold.toolCalls", rptToolCalls), s("reports.threshold.elapsedSeconds", rptElapsedSec),
            s("insights.enabled", insightsEnabled), s("context.exportMap", contextExportMap),
        ]);
        setSaving(false);
    }, [connection, lrnEnabled, captureLevel, includeUnverified, ledgerPath, summaryDir,
        jrnEnabled, sessionLogsDir, updateLogsDir, jrnAuthor, jrnTimezone,
        rptEnabled, rptAutoOpen, rptOutputDir, rptToolCalls, rptElapsedSec, insightsEnabled, contextExportMap]);

    if (loading) return <div className="settings-tab-loading">Loading learning settings...</div>;

    return (
        <motion.div key="learning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <p className="st-desc">Adaptive learning, session journaling, reporting, and context management.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Adaptive Learning</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={lrnEnabled} onChange={e => setLrnEnabled(e.target.checked)} /> Learning enabled</label>
                <label className="st-label">Capture Level
                    <select className="st-select" value={captureLevel} onChange={e => setCaptureLevel(e.target.value)}>
                        <option value="exhaustive">Exhaustive</option>
                        <option value="balanced">Balanced</option>
                        <option value="lean">Lean</option>
                    </select>
                </label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={includeUnverified} onChange={e => setIncludeUnverified(e.target.checked)} /> Include unverified learnings</label>
                <label className="st-label">Ledger Path <input className="st-input" value={ledgerPath} onChange={e => setLedgerPath(e.target.value)} /></label>
                <label className="st-label">Summary Dir <input className="st-input" value={summaryDir} onChange={e => setSummaryDir(e.target.value)} /></label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Journal</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={jrnEnabled} onChange={e => setJrnEnabled(e.target.checked)} /> Journal enabled</label>
                <div className="st-row">
                    <label className="st-label">Session Logs Dir <input className="st-input" value={sessionLogsDir} onChange={e => setSessionLogsDir(e.target.value)} /></label>
                    <label className="st-label">Update Logs Dir <input className="st-input" value={updateLogsDir} onChange={e => setUpdateLogsDir(e.target.value)} /></label>
                </div>
                <div className="st-row">
                    <label className="st-label">Author <input className="st-input" value={jrnAuthor} onChange={e => setJrnAuthor(e.target.value)} /></label>
                    <label className="st-label">Timezone <input className="st-input" value={jrnTimezone} onChange={e => setJrnTimezone(e.target.value)} placeholder="local" /></label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Reports</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rptEnabled} onChange={e => setRptEnabled(e.target.checked)} /> Reports enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rptAutoOpen} onChange={e => setRptAutoOpen(e.target.checked)} /> Auto-open reports</label>
                <label className="st-label">Output Dir <input className="st-input" value={rptOutputDir} onChange={e => setRptOutputDir(e.target.value)} /></label>
                <div className="st-row">
                    <label className="st-label">Min Tool Calls Threshold <input className="st-input" type="number" value={rptToolCalls} onChange={e => setRptToolCalls(Number(e.target.value))} min={1} /></label>
                    <label className="st-label">Min Elapsed (sec) <input className="st-input" type="number" value={rptElapsedSec} onChange={e => setRptElapsedSec(Number(e.target.value))} min={10} /></label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Other</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={insightsEnabled} onChange={e => setInsightsEnabled(e.target.checked)} /> Insights enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={contextExportMap} onChange={e => setContextExportMap(e.target.checked)} /> Export context map</label>
            </fieldset>
        </motion.div>
    );
}
