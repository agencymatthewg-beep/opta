import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './DaemonDrawer.css';

interface DaemonJob {
    id: string;
    cmd: string;
    pid?: number;
    status: 'running' | 'stopped';
    uptime?: string;
    exitCode?: number;
}

export interface DaemonDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DaemonDrawer({ isOpen, onClose }: DaemonDrawerProps) {
    const [jobs, setJobs] = useState<DaemonJob[]>([]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isOpen) {
            // Fetch immediately
            invoke<DaemonJob[]>('fetch_daemon_jobs')
                .then(setJobs)
                .catch(console.error);

            // Poll every 2 seconds
            interval = setInterval(() => {
                invoke<DaemonJob[]>('fetch_daemon_jobs')
                    .then(setJobs)
                    .catch(console.error);
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isOpen]);

    // Auto-close on Esc
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleKill = async (id: string) => {
        setJobs(jobs.map(j => j.id === id ? { ...j, status: 'stopped' } : j));
        try {
            await invoke('kill_daemon_job', { jobId: id });
            const fresh = await invoke<DaemonJob[]>('fetch_daemon_jobs');
            setJobs(fresh);
        } catch (e) {
            console.error("Failed to kill job", e);
        }
    };

    const handleRestart = async (id: string) => {
        // Optimistic UI fallback
        setJobs(jobs.map(j => j.id === id ? { ...j, status: 'running', uptime: '0s', exitCode: undefined } : j));
        try {
            await invoke('restart_daemon_job', { jobId: id });
            const fresh = await invoke<DaemonJob[]>('fetch_daemon_jobs');
            setJobs(fresh);
        } catch (e) {
            console.error("Failed to restart job", e);
            alert("Error: " + e);
        }
    };

    return (
        <>
            <div
                className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`daemon-drawer ${isOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <h2>Daemon Activity</h2>
                    <div className="close-icon" onClick={onClose}>&times;</div>
                </div>

                <div className="job-track">
                    {jobs.map(job => (
                        <div key={job.id} className="job-node">
                            <div className={`status-ring ${job.status}`}></div>
                            <div className="content">
                                <div className="cmd" style={job.status === 'stopped' ? { color: 'var(--text-muted, #a1a1aa)' } : undefined}>
                                    {job.cmd}
                                </div>
                                <div className="meta">
                                    PID: {job.pid || 'N/A'} &middot; {job.status === 'running' ? (job.uptime || 'active') : `EXIT: ${job.exitCode || 0}`}
                                </div>
                                <div className="action-overlay">
                                    <button className="a-btn">Logs <span className="kb">L</span></button>
                                    {job.status === 'running' ? (
                                        <button className="a-btn danger" onClick={() => handleKill(job.id)}>Kill <span className="kb">K</span></button>
                                    ) : (
                                        <button className="a-btn" style={{ color: 'var(--text-main, #ffffff)' }} onClick={() => handleRestart(job.id)}>Restart <span className="kb">R</span></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
