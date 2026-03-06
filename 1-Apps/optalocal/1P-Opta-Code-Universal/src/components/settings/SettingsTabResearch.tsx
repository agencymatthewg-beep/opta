import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

const PROVIDERS = ["auto", "tavily", "gemini", "exa", "brave", "groq"] as const;

export function SettingsTabResearch({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [enabled, setEnabled] = useState(true);
    const [defaultProvider, setDefaultProvider] = useState("auto");
    const [alwaysIncludeDocs, setAlwaysIncludeDocs] = useState(true);
    const [maxResults, setMaxResults] = useState(8);
    const [searxngUrl, setSearxngUrl] = useState("http://localhost:8081");

    // Per-provider config
    const [tavilyEnabled, setTavilyEnabled] = useState(false);
    const [tavilyKey, setTavilyKey] = useState("");
    const [geminiEnabled, setGeminiEnabled] = useState(false);
    const [geminiKey, setGeminiKey] = useState("");
    const [exaEnabled, setExaEnabled] = useState(false);
    const [exaKey, setExaKey] = useState("");
    const [braveEnabled, setBraveEnabled] = useState(false);
    const [braveKey, setBraveKey] = useState("");
    const [groqEnabled, setGroqEnabled] = useState(false);
    const [groqKey, setGroqKey] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [en, dp, aid, mr, su, te, tk, ge, gk, ee, ek, be, bk, gre, grk] = await Promise.all([
                g("research.enabled", true), g("research.defaultProvider", "auto"),
                g("research.alwaysIncludeDocumentation", true), g("research.maxResults", 8),
                g("search.searxngUrl", "http://localhost:8081"),
                g("research.providers.tavily.enabled", false), g("research.providers.tavily.apiKey", ""),
                g("research.providers.gemini.enabled", false), g("research.providers.gemini.apiKey", ""),
                g("research.providers.exa.enabled", false), g("research.providers.exa.apiKey", ""),
                g("research.providers.brave.enabled", false), g("research.providers.brave.apiKey", ""),
                g("research.providers.groq.enabled", false), g("research.providers.groq.apiKey", ""),
            ]);
            if (cancelled) return;
            setEnabled(en !== false); setDefaultProvider(String(dp ?? "auto"));
            setAlwaysIncludeDocs(aid !== false); setMaxResults(Number(mr) || 8);
            setSearxngUrl(String(su ?? "http://localhost:8081"));
            setTavilyEnabled(te === true); setTavilyKey(String(tk ?? ""));
            setGeminiEnabled(ge === true); setGeminiKey(String(gk ?? ""));
            setExaEnabled(ee === true); setExaKey(String(ek ?? ""));
            setBraveEnabled(be === true); setBraveKey(String(bk ?? ""));
            setGroqEnabled(gre === true); setGroqKey(String(grk ?? ""));
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        await Promise.all([
            s("research.enabled", enabled), s("research.defaultProvider", defaultProvider),
            s("research.alwaysIncludeDocumentation", alwaysIncludeDocs), s("research.maxResults", maxResults),
            s("search.searxngUrl", searxngUrl),
            s("research.providers.tavily.enabled", tavilyEnabled), s("research.providers.tavily.apiKey", tavilyKey),
            s("research.providers.gemini.enabled", geminiEnabled), s("research.providers.gemini.apiKey", geminiKey),
            s("research.providers.exa.enabled", exaEnabled), s("research.providers.exa.apiKey", exaKey),
            s("research.providers.brave.enabled", braveEnabled), s("research.providers.brave.apiKey", braveKey),
            s("research.providers.groq.enabled", groqEnabled), s("research.providers.groq.apiKey", groqKey),
        ]);
        setSaving(false);
    }, [connection, enabled, defaultProvider, alwaysIncludeDocs, maxResults, searxngUrl,
        tavilyEnabled, tavilyKey, geminiEnabled, geminiKey, exaEnabled, exaKey, braveEnabled, braveKey, groqEnabled, groqKey]);

    if (loading) return <div className="settings-tab-loading">Loading research settings...</div>;

    return (
        <motion.div key="research" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <p className="st-desc">Configure web research providers and search engine integration.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            <fieldset className="st-fieldset">
                <legend className="st-legend">General</legend>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Research enabled</label>
                <div className="st-row">
                    <label className="st-label">Default Provider
                        <select className="st-select" value={defaultProvider} onChange={e => setDefaultProvider(e.target.value)}>
                            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </label>
                    <label className="st-label">Max Results <input className="st-input" type="number" value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} min={1} max={20} /></label>
                </div>
                <label className="st-label st-checkbox-label"><input type="checkbox" checked={alwaysIncludeDocs} onChange={e => setAlwaysIncludeDocs(e.target.checked)} /> Always include documentation</label>
                <label className="st-label">SearXNG URL <input className="st-input" value={searxngUrl} onChange={e => setSearxngUrl(e.target.value)} /></label>
            </fieldset>

            {([
                { name: "Tavily", en: tavilyEnabled, setEn: setTavilyEnabled, key: tavilyKey, setKey: setTavilyKey },
                { name: "Gemini", en: geminiEnabled, setEn: setGeminiEnabled, key: geminiKey, setKey: setGeminiKey },
                { name: "Exa", en: exaEnabled, setEn: setExaEnabled, key: exaKey, setKey: setExaKey },
                { name: "Brave", en: braveEnabled, setEn: setBraveEnabled, key: braveKey, setKey: setBraveKey },
                { name: "Groq", en: groqEnabled, setEn: setGroqEnabled, key: groqKey, setKey: setGroqKey },
            ] as const).map(prov => (
                <fieldset key={prov.name} className="st-fieldset">
                    <legend className="st-legend">{prov.name}</legend>
                    <label className="st-label st-checkbox-label"><input type="checkbox" checked={prov.en} onChange={e => prov.setEn(e.target.checked)} /> Enabled</label>
                    <label className="st-label">API Key <input className="st-input st-secret" type="password" value={prov.key} onChange={e => prov.setKey(e.target.value)} /></label>
                </fieldset>
            ))}
        </motion.div>
    );
}
