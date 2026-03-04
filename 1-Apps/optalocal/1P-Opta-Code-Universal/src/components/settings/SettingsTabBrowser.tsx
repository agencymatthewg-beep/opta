import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

export function SettingsTabBrowser({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Core
    const [enabled, setEnabled] = useState(false);
    const [mode, setMode] = useState("isolated");
    const [autoInvoke, setAutoInvoke] = useState(false);
    const [screenshotPolicy, setScreenshotPolicy] = useState("on-demand");
    const [homePage, setHomePage] = useState("");

    // Runtime
    const [rtEnabled, setRtEnabled] = useState(true);
    const [rtPersistSessions, setRtPersistSessions] = useState(true);
    const [rtMaxSessions, setRtMaxSessions] = useState(3);
    const [rtProfileRetentionDays, setRtProfileRetentionDays] = useState(30);

    // Policy
    const [polRequireApproval, setPolRequireApproval] = useState(true);
    const [polAllowedHosts, setPolAllowedHosts] = useState("*");
    const [polBlockedOrigins, setPolBlockedOrigins] = useState("");

    // Artifacts
    const [artEnabled, setArtEnabled] = useState(true);
    const [artScreenshots, setArtScreenshots] = useState("on_step");
    const [artTrace, setArtTrace] = useState(true);

    // MCP
    const [mcpEnabled, setMcpEnabled] = useState(true);
    const [mcpCommand, setMcpCommand] = useState("npx");
    const [mcpPackage, setMcpPackage] = useState("@playwright/mcp@latest");

    // Attach
    const [attachEnabled, setAttachEnabled] = useState(false);
    const [attachWsEndpoint, setAttachWsEndpoint] = useState("");
    const [attachRequireApproval, setAttachRequireApproval] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const vals = await Promise.all([
                g("browser.enabled", false), g("browser.mode", "isolated"),
                g("browser.autoInvoke", false), g("browser.screenshotPolicy", "on-demand"),
                g("browser.homePage", ""),
                g("browser.runtime.enabled", true), g("browser.runtime.persistSessions", true),
                g("browser.runtime.maxSessions", 3), g("browser.runtime.profileRetentionDays", 30),
                g("browser.policy.requireApprovalForHighRisk", true),
                g("browser.policy.allowedHosts", ["*"]), g("browser.policy.blockedOrigins", []),
                g("browser.artifacts.enabled", true), g("browser.artifacts.screenshots", "on_step"),
                g("browser.artifacts.trace", true),
                g("browser.mcp.enabled", true), g("browser.mcp.command", "npx"), g("browser.mcp.package", "@playwright/mcp@latest"),
                g("browser.attach.enabled", false), g("browser.attach.wsEndpoint", ""), g("browser.attach.requireApproval", true),
            ]);
            if (cancelled) return;
            const [en, md, ai, sp, hp, re, rp, rms, rpd, pa, ah, bo, ae, as2, at2, me, mc, mp, aten, awe, ara] = vals;
            setEnabled(en === true); setMode(String(md ?? "isolated")); setAutoInvoke(ai === true);
            setScreenshotPolicy(String(sp ?? "on-demand")); setHomePage(String(hp ?? ""));
            setRtEnabled(re !== false); setRtPersistSessions(rp !== false);
            setRtMaxSessions(Number(rms) || 3); setRtProfileRetentionDays(Number(rpd) || 30);
            setPolRequireApproval(pa !== false);
            setPolAllowedHosts(Array.isArray(ah) ? ah.join(", ") : "*");
            setPolBlockedOrigins(Array.isArray(bo) ? bo.join(", ") : "");
            setArtEnabled(ae !== false); setArtScreenshots(String(as2 ?? "on_step")); setArtTrace(at2 !== false);
            setMcpEnabled(me !== false); setMcpCommand(String(mc ?? "npx")); setMcpPackage(String(mp ?? "@playwright/mcp@latest"));
            setAttachEnabled(aten === true); setAttachWsEndpoint(String(awe ?? "")); setAttachRequireApproval(ara !== false);
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("browser.enabled", enabled), s("browser.mode", mode), s("browser.autoInvoke", autoInvoke),
            s("browser.screenshotPolicy", screenshotPolicy), s("browser.homePage", homePage),
            s("browser.runtime.enabled", rtEnabled), s("browser.runtime.persistSessions", rtPersistSessions),
            s("browser.runtime.maxSessions", rtMaxSessions), s("browser.runtime.profileRetentionDays", rtProfileRetentionDays),
            s("browser.policy.requireApprovalForHighRisk", polRequireApproval),
            s("browser.policy.allowedHosts", polAllowedHosts.split(",").map(h => h.trim()).filter(Boolean)),
            s("browser.policy.blockedOrigins", polBlockedOrigins.split(",").map(h => h.trim()).filter(Boolean)),
            s("browser.artifacts.enabled", artEnabled), s("browser.artifacts.screenshots", artScreenshots),
            s("browser.artifacts.trace", artTrace),
            s("browser.mcp.enabled", mcpEnabled), s("browser.mcp.command", mcpCommand), s("browser.mcp.package", mcpPackage),
            s("browser.attach.enabled", attachEnabled), s("browser.attach.wsEndpoint", attachWsEndpoint),
            s("browser.attach.requireApproval", attachRequireApproval),
        ]);
        setSaving(false);
    }, [connection, enabled, mode, autoInvoke, screenshotPolicy, homePage, rtEnabled, rtPersistSessions,
        rtMaxSessions, rtProfileRetentionDays, polRequireApproval, polAllowedHosts, polBlockedOrigins,
        artEnabled, artScreenshots, artTrace, mcpEnabled, mcpCommand, mcpPackage,
        attachEnabled, attachWsEndpoint, attachRequireApproval]);

    if (loading) return <div className="settings-tab-loading">Loading browser settings...</div>;

    return (
        <motion.div key="browser" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <h3 className="opta-studio-section-title">Browser Automation</h3>
                    <p className="st-desc">Playwright-powered browser control, session management, and security policies.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Core</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Browser automation enabled</label>
                <div className="st-row">
                    <label className="st-label">Mode
                        <select className="st-select" value={mode} onChange={e => setMode(e.target.value)}>
                            <option value="isolated">Isolated</option><option value="attach">Attach</option>
                        </select>
                    </label>
                    <label className="st-label">Screenshot Policy
                        <select className="st-select" value={screenshotPolicy} onChange={e => setScreenshotPolicy(e.target.value)}>
                            <option value="on-demand">On Demand</option><option value="always">Always</option><option value="disabled">Disabled</option>
                        </select>
                    </label>
                </div>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={autoInvoke} onChange={e => setAutoInvoke(e.target.checked)} /> Auto-invoke browser when needed</label>
                <label className="st-label">Home Page <input className="st-input" value={homePage} onChange={e => setHomePage(e.target.value)} placeholder="https://..." /></label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Runtime</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtEnabled} onChange={e => setRtEnabled(e.target.checked)} /> Runtime enabled</label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={rtPersistSessions} onChange={e => setRtPersistSessions(e.target.checked)} /> Persist sessions</label>
                <div className="st-row">
                    <label className="st-label">Max Sessions <input className="st-input" type="number" value={rtMaxSessions} onChange={e => setRtMaxSessions(Number(e.target.value))} min={1} max={20} /></label>
                    <label className="st-label">Profile Retention (days) <input className="st-input" type="number" value={rtProfileRetentionDays} onChange={e => setRtProfileRetentionDays(Number(e.target.value))} min={1} /></label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Policy</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={polRequireApproval} onChange={e => setPolRequireApproval(e.target.checked)} /> Require approval for high-risk actions</label>
                <label className="st-label">Allowed Hosts <span className="st-hint">(comma-separated, * = all)</span>
                    <input className="st-input" value={polAllowedHosts} onChange={e => setPolAllowedHosts(e.target.value)} />
                </label>
                <label className="st-label">Blocked Origins <span className="st-hint">(comma-separated)</span>
                    <input className="st-input" value={polBlockedOrigins} onChange={e => setPolBlockedOrigins(e.target.value)} />
                </label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Artifacts</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={artEnabled} onChange={e => setArtEnabled(e.target.checked)} /> Artifact collection enabled</label>
                <label className="st-label">Screenshots
                    <select className="st-select" value={artScreenshots} onChange={e => setArtScreenshots(e.target.value)}>
                        <option value="on_step">On Step</option><option value="manual">Manual</option><option value="off">Off</option>
                    </select>
                </label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={artTrace} onChange={e => setArtTrace(e.target.checked)} /> Enable trace recording</label>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">MCP Integration</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={mcpEnabled} onChange={e => setMcpEnabled(e.target.checked)} /> MCP enabled</label>
                <div className="st-row">
                    <label className="st-label">Command <input className="st-input" value={mcpCommand} onChange={e => setMcpCommand(e.target.value)} /></label>
                    <label className="st-label">Package <input className="st-input" value={mcpPackage} onChange={e => setMcpPackage(e.target.value)} /></label>
                </div>
            </fieldset>

            <fieldset className="st-fieldset">
                <legend className="st-legend">Attach Mode</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={attachEnabled} onChange={e => setAttachEnabled(e.target.checked)} /> Attach mode enabled</label>
                <label className="st-label">WS Endpoint <input className="st-input" value={attachWsEndpoint} onChange={e => setAttachWsEndpoint(e.target.value)} placeholder="ws://..." /></label>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={attachRequireApproval} onChange={e => setAttachRequireApproval(e.target.checked)} /> Require approval</label>
            </fieldset>
        </motion.div>
    );
}
