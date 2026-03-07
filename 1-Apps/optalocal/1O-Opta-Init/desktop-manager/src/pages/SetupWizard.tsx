import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { GetOptaConfigResult, OptaConfig, WorkspaceCreationResult } from '../types';
import './SetupWizard.css';

export interface SetupWizardProps {
    onComplete: () => void;
}

const SETUP_COMPLETE_KEY = 'init_setup_complete';
const SETUP_CONFIG_CACHE_KEY = 'opta_init_setup_config_v1';

type WizardPlatform = 'windows' | 'macos' | 'linux';

function detectPlatform(): WizardPlatform {
    if (typeof navigator === 'undefined') return 'linux';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    return 'linux';
}

function defaultPaths(platform: WizardPlatform): { installPath: string; docsPath: string } {
    if (platform === 'windows') {
        return {
            installPath: '%LOCALAPPDATA%\\Opta\\apps',
            docsPath: '%USERPROFILE%\\Documents\\Opta\\docs',
        };
    }
    return {
        installPath: '~/optalocal/apps',
        docsPath: '~/optalocal/docs',
    };
}

function normalizeProfile(profile: unknown): 'workstation' | 'host' {
    return profile === 'host' ? 'host' : 'workstation';
}

function parseCachedConfig(): OptaConfig | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SETUP_CONFIG_CACHE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as OptaConfig;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function normalizeOptaConfig(payload: unknown): OptaConfig | null {
    if (!payload || typeof payload !== 'object') return null;
    const value = payload as Record<string, unknown>;
    const nested = value.config;
    if (nested && typeof nested === 'object') {
        return nested as OptaConfig;
    }
    return value as OptaConfig;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
    const platform = detectPlatform();
    const defaults = defaultPaths(platform);
    const [step, setStep] = useState(1);
    const [cmdProgress, setCmdProgress] = useState<Record<string, { line: string, pct?: number }>>({});

    // Step 1 State
    const [profile, setProfile] = useState<'workstation' | 'host'>('workstation');

    // Step 2 State
    const [installPath, setInstallPath] = useState(defaults.installPath);
    const [docsPath, setDocsPath] = useState(defaults.docsPath);

    // Step 3 State
    const [deps, setDeps] = useState({
        cli: { installed: false, installing: false },
        daemon: { installed: false, installing: false },
        lmx: { installed: false, installing: false },
        code: { installed: false, installing: false }
    });

    useEffect(() => {
        const applyConfig = (config: OptaConfig) => {
            if (!config) return;
            if (typeof config.profile === 'string') {
                setProfile(normalizeProfile(config.profile));
            }
            if (typeof config.installPath === 'string' && config.installPath.trim().length > 0) {
                setInstallPath(config.installPath);
            }
            if (typeof config.docsPath === 'string' && config.docsPath.trim().length > 0) {
                setDocsPath(config.docsPath);
            }
        };

        const cachedConfig = parseCachedConfig();
        if (cachedConfig) {
            applyConfig(cachedConfig);
        }

        let cancelled = false;
        const loadFromBackend = async () => {
            try {
                const result = await invoke<GetOptaConfigResult | OptaConfig>('get_opta_config');
                if (cancelled) return;
                const normalized = normalizeOptaConfig(result);
                if (normalized) {
                    applyConfig(normalized);
                }
            } catch {
                // Command may not exist yet; keep cached/default values.
            }
        };

        void loadFromBackend();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const unlisten = listen("cmd-progress", (event) => {
            const payload = event.payload as { app_id: string, line: string };
            setCmdProgress(prev => {
                let pct = prev[payload.app_id]?.pct;
                const match = payload.line.match(/(\d{1,3})%/);
                if (match) pct = parseInt(match[1], 10);
                return { ...prev, [payload.app_id]: { line: payload.line, pct } };
            });
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    useEffect(() => {
        if (step === 3) {
            const checkDeps = async () => {
                for (const key of Object.keys(deps)) {
                    try {
                        const isInstalled = await invoke<boolean>("check_dependency_status", { dependency: key });
                        setDeps(d => ({ ...d, [key]: { ...d[key as keyof typeof d], installed: isInstalled } }));
                    } catch (e) {
                        console.error(`Status check failed for ${key}`, e);
                    }
                }
            };
            void checkDeps();
        }
    }, [step]);

    const nextStep = () => setStep(s => Math.min(s + 1, 4));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleComplete = async () => {
        // Create the Opta Workspace filesystem structure first
        let workspacePath: string | undefined;
        try {
            const result = await invoke<WorkspaceCreationResult>("create_opta_workspace", {
                customPath: null,
            });
            workspacePath = result.workspacePath;
        } catch (e) {
            // Non-fatal — workspace creation failure should not block setup completion
            console.warn("Workspace creation failed (non-fatal):", e);
        }

        const configPayload = {
            profile,
            installPath,
            docsPath,
            ...(workspacePath ? { workspacePath } : {}),
            setupComplete: true,
            completed: true,
        };

        const persistLocalCompletion = () => {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
            window.localStorage.setItem(SETUP_CONFIG_CACHE_KEY, JSON.stringify(configPayload));
        };

        try {
            await invoke("save_opta_config", {
                config: { profile, installPath, docsPath, workspacePath }
            });
            persistLocalCompletion();
            onComplete();
        } catch (e) {
            console.error("Failed to save config:", e);
            // Fallback to local persistence so first-run flow cannot get stuck.
            persistLocalCompletion();
            onComplete();
        }
    };

    const handleInstall = async (key: string) => {
        setDeps(d => ({ ...d, [key]: { ...d[key as keyof typeof d], installing: true } }));
        try {
            await invoke("install_dependency", { dependency: key });
            setDeps(d => ({ ...d, [key]: { ...d[key as keyof typeof d], installed: true, installing: false } }));
        } catch (e) {
            console.error(`Install failed for ${key}`, e);
            setDeps(d => ({ ...d, [key]: { ...d[key as keyof typeof d], installing: false } }));
        } finally {
            setCmdProgress(prev => { const n = {...prev}; delete n[key]; return n; });
        }
    };

    return (
        <div className="setup-wizard-overlay">
            <div className="setup-wizard-card">
                <div className="wizard-header">
                    <h2>Opta Setup</h2>
                    <div className="step-indicator">
                        <div className={`step-dot ${step >= 1 ? 'active' : ''}`} />
                        <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
                        <div className={`step-dot ${step >= 3 ? 'active' : ''}`} />
                    </div>
                </div>

                <div className="wizard-content">
                    {step === 1 && (
                        <div className="wizard-step step-1">
                            <h3>Choose your Profile</h3>
                            <p>Select how you primarily plan to use this machine.</p>

                            <div className="profile-options">
                                <div
                                    className={`profile-card ${profile === 'workstation' ? 'selected' : ''}`}
                                    onClick={() => setProfile('workstation')}
                                >
                                    <div className="profile-icon">💻</div>
                                    <h4>Standard Workstation</h4>
                                    <p>Connect to remote LLMs and run local Opta apps.</p>
                                </div>
                                <div
                                    className={`profile-card ${profile === 'host' ? 'selected' : ''}`}
                                    onClick={() => setProfile('host')}
                                >
                                    <div className="profile-icon">🧠</div>
                                    <h4>LLM Host</h4>
                                    <p>Run heavy local models, LMX inference, and act as a node.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step step-2">
                            <h3>Installation Paths</h3>
                            <p>Where should we install Opta applications and local documentation?</p>

                            <div className="form-group">
                                <label>Apps Installation Path</label>
                                <input
                                    type="text"
                                    value={installPath}
                                    onChange={e => setInstallPath(e.target.value)}
                                    placeholder={defaults.installPath}
                                />
                            </div>

                            <div className="form-group">
                                <label>Documentation Path</label>
                                <input
                                    type="text"
                                    value={docsPath}
                                    onChange={e => setDocsPath(e.target.value)}
                                    placeholder={defaults.docsPath}
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step step-3">
                            <h3>Core Dependencies</h3>
                            <p>Install the required Opta background services to continue.</p>

                            <div className="deps-list">
                                {Object.entries(deps).map(([key, state]) => (
                                    <div className="dep-item" key={key} style={{ flexWrap: 'wrap' }}>
                                        <div className="dep-info">
                                            <h4>Opta {key.toUpperCase()}</h4>
                                            <span className={`status-badge ${state.installed ? 'installed' : 'missing'}`}>
                                                {state.installed ? 'Installed' : 'Missing'}
                                            </span>
                                        </div>
                                        <div>
                                            <button
                                                className="install-btn"
                                                disabled={state.installed || state.installing}
                                                onClick={() => void handleInstall(key)}
                                            >
                                                {state.installing ? 'Working...' : state.installed ? 'Done' : 'Install'}
                                            </button>
                                        </div>
                                        {state.installing && cmdProgress[key] && (
                                            <div style={{ marginTop: '12px', fontSize: '10px', color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace', width: '100%', flexBasis: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>{cmdProgress[key].line}</span>
                                                    <span>{cmdProgress[key].pct ? `${cmdProgress[key].pct}%` : ''}</span>
                                                </div>
                                                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', background: '#8b5cf6', width: cmdProgress[key].pct ? `${cmdProgress[key].pct}%` : '100%', transition: 'width 0.2s', animation: cmdProgress[key].pct ? 'none' : 'pulse 1.5s infinite' }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-footer">
                    {step > 1 ? (
                        <button className="btn-secondary" onClick={prevStep}>Back</button>
                    ) : <div></div>}

                    {step < 3 ? (
                        <button className="btn-primary" onClick={nextStep}>Continue</button>
                    ) : (
                        <button className="btn-primary finish-btn" onClick={handleComplete}>Finish Setup</button>
                    )}
                </div>
            </div>
        </div>
    );
}
