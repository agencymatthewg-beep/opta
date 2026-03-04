import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Layers, Save, RotateCcw } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

const PROVIDERS = [
    { id: "lmx", label: "LMX (Local)" },
    { id: "anthropic", label: "Anthropic (Claude)" },
    { id: "gemini", label: "Gemini (Google)" },
    { id: "openai", label: "OpenAI / Codex / Minimax" },
    { id: "opencode_zen", label: "OpenCode Zen" },
] as const;
const MODES = ["safe", "auto", "plan", "review", "research", "dangerous", "ci"] as const;

export function SettingsTabModelProvider({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Model
    const [defaultModel, setDefaultModel] = useState("");
    const [contextLimit, setContextLimit] = useState(32768);
    const [favourites, setFavourites] = useState("");
    const [embeddingModel, setEmbeddingModel] = useState("");
    const [rerankerModel, setRerankerModel] = useState("");

    // Provider
    const [activeProvider, setActiveProvider] = useState("lmx");
    const [fallbackOnFailure, setFallbackOnFailure] = useState(false);
    const [defaultMode, setDefaultMode] = useState("safe");

    // Provider keys
    const [anthropicKey, setAnthropicKey] = useState("");
    const [anthropicModel, setAnthropicModel] = useState("claude-3-7-sonnet-latest");
    const [geminiKey, setGeminiKey] = useState("");
    const [geminiModel, setGeminiModel] = useState("gemini-2.5-pro");
    const [openaiKey, setOpenaiKey] = useState("");
    const [openaiModel, setOpenaiModel] = useState("gpt-4o");
    const [opencodeKey, setOpencodeKey] = useState("");
    const [opencodeModel, setOpencodeModel] = useState("opencode-zen-1");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const g = (k: string, d: unknown) => daemonClient.configGet(connection, k).catch(() => d);
            const [dm, cl, fav, emb, rer, ap, fof, mode,
                ak, am, gk, gm, ok, om, ock, ocm] = await Promise.all([
                    g("model.default", ""), g("model.contextLimit", 32768),
                    g("model.favourites", []), g("model.embeddingModel", ""),
                    g("model.rerankerModel", ""), g("provider.active", "lmx"),
                    g("provider.fallbackOnFailure", false), g("defaultMode", "safe"),
                    g("provider.anthropic.apiKey", ""), g("provider.anthropic.model", "claude-3-7-sonnet-latest"),
                    g("provider.gemini.apiKey", ""), g("provider.gemini.model", "gemini-2.5-pro"),
                    g("provider.openai.apiKey", ""), g("provider.openai.model", "gpt-4o"),
                    g("provider.opencode_zen.apiKey", ""), g("provider.opencode_zen.model", "opencode-zen-1"),
                ]);
            if (cancelled) return;
            setDefaultModel(String(dm ?? "")); setContextLimit(Number(cl) || 32768);
            setFavourites(Array.isArray(fav) ? fav.join(", ") : "");
            setEmbeddingModel(String(emb ?? "")); setRerankerModel(String(rer ?? ""));
            setActiveProvider(String(ap ?? "lmx")); setFallbackOnFailure(fof === true);
            setDefaultMode(String(mode ?? "safe"));
            setAnthropicKey(String(ak ?? "")); setAnthropicModel(String(am ?? "claude-3-7-sonnet-latest"));
            setGeminiKey(String(gk ?? "")); setGeminiModel(String(gm ?? "gemini-2.5-pro"));
            setOpenaiKey(String(ok ?? "")); setOpenaiModel(String(om ?? "gpt-4o"));
            setOpencodeKey(String(ock ?? "")); setOpencodeModel(String(ocm ?? "opencode-zen-1"));
            setLoading(false);
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const save = useCallback(async () => {
        setSaving(true);
        const s = (k: string, v: unknown) => daemonClient.configSet(connection, k, v).catch(() => { });
        const favArr = favourites.split(",").map(f => f.trim()).filter(Boolean);
        await Promise.all([
            s("model.default", defaultModel), s("model.contextLimit", contextLimit),
            s("model.favourites", favArr), s("model.embeddingModel", embeddingModel),
            s("model.rerankerModel", rerankerModel), s("provider.active", activeProvider),
            s("provider.fallbackOnFailure", fallbackOnFailure), s("defaultMode", defaultMode),
            s("provider.anthropic.apiKey", anthropicKey), s("provider.anthropic.model", anthropicModel),
            s("provider.gemini.apiKey", geminiKey), s("provider.gemini.model", geminiModel),
            s("provider.openai.apiKey", openaiKey), s("provider.openai.model", openaiModel),
            s("provider.opencode_zen.apiKey", opencodeKey), s("provider.opencode_zen.model", opencodeModel),
        ]);
        setSaving(false);
    }, [connection, defaultModel, contextLimit, favourites, embeddingModel, rerankerModel,
        activeProvider, fallbackOnFailure, defaultMode, anthropicKey, anthropicModel,
        geminiKey, geminiModel, openaiKey, openaiModel, opencodeKey, opencodeModel]);

    if (loading) return <div className="settings-tab-loading">Loading model settings...</div>;

    return (
        <motion.div key="model" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <h3 className="opta-studio-section-title">Model &amp; Provider</h3>
                    <p className="st-desc">Configure default models, context limits, and inference provider routing.</p>
                </div>
                <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Save All"}
                </button>
            </div>

            {/* Model Config */}
            <fieldset className="st-fieldset">
                <legend className="st-legend"><Layers size={14} /> Model Defaults</legend>
                <label className="st-label">Default Model
                    <input className="st-input" value={defaultModel} onChange={e => setDefaultModel(e.target.value)} placeholder="e.g. mlx-community/Qwen2.5-Coder-32B-4bit" />
                </label>
                <div className="st-row">
                    <label className="st-label">Context Limit
                        <input className="st-input" type="number" value={contextLimit} onChange={e => setContextLimit(Number(e.target.value))} min={1024} max={262144} />
                    </label>
                    <label className="st-label">Default Mode
                        <select className="st-select" value={defaultMode} onChange={e => setDefaultMode(e.target.value)}>
                            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </label>
                </div>
                <label className="st-label">Favourites <span className="st-hint">(comma-separated)</span>
                    <input className="st-input" value={favourites} onChange={e => setFavourites(e.target.value)} placeholder="model-a, model-b" />
                </label>
                <div className="st-row">
                    <label className="st-label">Embedding Model
                        <input className="st-input" value={embeddingModel} onChange={e => setEmbeddingModel(e.target.value)} placeholder="nomic-ai/nomic-embed-text-v2-moe" />
                    </label>
                    <label className="st-label">Reranker Model
                        <input className="st-input" value={rerankerModel} onChange={e => setRerankerModel(e.target.value)} placeholder="BAAI/bge-reranker-v2-m3" />
                    </label>
                </div>
            </fieldset>

            {/* Provider Config */}
            <fieldset className="st-fieldset">
                <legend className="st-legend"><RotateCcw size={14} /> Provider Routing</legend>
                <div className="st-row">
                    <label className="st-label">Active Provider
                        <select className="st-select" value={activeProvider} onChange={e => setActiveProvider(e.target.value)}>
                            {PROVIDERS.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="st-label st-checkbox-label">
                        <input type="checkbox" checked={fallbackOnFailure} onChange={e => setFallbackOnFailure(e.target.checked)} />
                        Fallback on failure
                    </label>
                </div>
            </fieldset>

            {/* Per-Provider API Keys */}
            <fieldset className="st-fieldset">
                <legend className="st-legend">Anthropic</legend>
                <div className="st-row">
                    <label className="st-label">API Key <input className="st-input st-secret" type="password" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} /></label>
                    <label className="st-label">Model <input className="st-input" value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)} /></label>
                </div>
            </fieldset>
            <fieldset className="st-fieldset">
                <legend className="st-legend">Gemini</legend>
                <div className="st-row">
                    <label className="st-label">API Key <input className="st-input st-secret" type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} /></label>
                    <label className="st-label">Model <input className="st-input" value={geminiModel} onChange={e => setGeminiModel(e.target.value)} /></label>
                </div>
            </fieldset>
            <fieldset className="st-fieldset">
                <legend className="st-legend">OpenAI</legend>
                <div className="st-row">
                    <label className="st-label">API Key <input className="st-input st-secret" type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} /></label>
                    <label className="st-label">Model <input className="st-input" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} /></label>
                </div>
            </fieldset>
            <fieldset className="st-fieldset">
                <legend className="st-legend">OpenCode Zen</legend>
                <div className="st-row">
                    <label className="st-label">API Key <input className="st-input st-secret" type="password" value={opencodeKey} onChange={e => setOpencodeKey(e.target.value)} /></label>
                    <label className="st-label">Model <input className="st-input" value={opencodeModel} onChange={e => setOpencodeModel(e.target.value)} /></label>
                </div>
            </fieldset>
        </motion.div>
    );
}
