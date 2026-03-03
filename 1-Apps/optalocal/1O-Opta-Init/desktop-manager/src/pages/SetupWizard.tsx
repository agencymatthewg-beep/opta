import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './SetupWizard.css';

export interface SetupWizardProps {
    onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
    const [step, setStep] = useState(1);
    const [cmdProgress, setCmdProgress] = useState<Record<string, { line: string, pct?: number }>>({});

    // Step 1 State
    const [profile, setProfile] = useState<'workstation' | 'host'>('workstation');

    // Step 2 State
    const [installPath, setInstallPath] = useState('~/optalocal/apps');
    const [docsPath, setDocsPath] = useState('~/optalocal/docs');

    // Step 3 State
    const [deps, setDeps] = useState({
        cli: { installed: false, installing: false },
        daemon: { installed: false, installing: false },
        lmx: { installed: false, installing: false },
        code: { installed: false, installing: false }
    });

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
        try {
            await invoke("save_opta_config", {
                config: { profile, installPath, docsPath }
            });
            localStorage.setItem('init_setup_complete', 'true');
            onComplete();
        } catch (e) {
            console.error("Failed to save config:", e);
            // Fallback
            localStorage.setItem('init_setup_complete', 'true');
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
                                    placeholder="~/optalocal/apps"
                                />
                            </div>

                            <div className="form-group">
                                <label>Documentation Path</label>
                                <input
                                    type="text"
                                    value={docsPath}
                                    onChange={e => setDocsPath(e.target.value)}
                                    placeholder="~/optalocal/docs"
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
