/**
 * StealthMode component for one-click process termination.
 *
 * Provides a prominent button to terminate all safe-to-kill processes,
 * with confirmation dialog and results feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo, StealthModeResult } from '../types/processes';
import './StealthMode.css';

type ModalState = 'closed' | 'confirm' | 'loading' | 'results';

interface StealthModeProps {
  /** Optional callback when stealth mode completes */
  onComplete?: (result: StealthModeResult) => void;
}

/**
 * StealthMode component with confirmation modal and results display.
 */
function StealthMode({ onComplete }: StealthModeProps) {
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [safeToKillProcesses, setSafeToKillProcesses] = useState<ProcessInfo[]>([]);
  const [estimatedMemory, setEstimatedMemory] = useState<number>(0);
  const [result, setResult] = useState<StealthModeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch safe-to-kill processes when opening confirmation
  const fetchProcesses = useCallback(async () => {
    try {
      const processes = await invoke<ProcessInfo[]>('get_processes');
      const safeToKill = processes.filter(p => p.category === 'safe-to-kill');
      setSafeToKillProcesses(safeToKill);

      // Estimate memory based on process memory percentages
      // Assume 16GB (16384MB) as rough estimate for now
      const totalMemoryMb = 16384;
      const estimated = safeToKill.reduce(
        (sum, p) => sum + (p.memory_percent / 100) * totalMemoryMb,
        0
      );
      setEstimatedMemory(Math.round(estimated));
    } catch (err) {
      console.error('Failed to fetch processes:', err);
      setError(String(err));
    }
  }, []);

  // Open confirmation modal
  const handleButtonClick = async () => {
    setError(null);
    setResult(null);
    setModalState('confirm');
    await fetchProcesses();
  };

  // Execute stealth mode
  const handleActivate = async () => {
    setModalState('loading');
    try {
      const stealthResult = await invoke<StealthModeResult>('stealth_mode');
      setResult(stealthResult);
      setModalState('results');
      onComplete?.(stealthResult);
    } catch (err) {
      console.error('Stealth mode failed:', err);
      setError(String(err));
      setModalState('results');
    }
  };

  // Close modal
  const handleClose = () => {
    setModalState('closed');
    setResult(null);
    setError(null);
  };

  // Auto-dismiss results after 5 seconds
  useEffect(() => {
    if (modalState === 'results') {
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [modalState]);

  return (
    <>
      {/* Main Stealth Mode Button */}
      <button
        className="stealth-mode-button"
        onClick={handleButtonClick}
        disabled={modalState !== 'closed'}
      >
        <span className="stealth-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </span>
        <span className="stealth-text">STEALTH MODE</span>
        <span className="stealth-subtext">Free up system resources</span>
      </button>

      {/* Modal Overlay */}
      {modalState !== 'closed' && (
        <div className="stealth-modal-overlay" onClick={handleClose}>
          <div className="stealth-modal" onClick={e => e.stopPropagation()}>

            {/* Confirmation State */}
            {modalState === 'confirm' && (
              <>
                <h2 className="modal-title">Activate Stealth Mode?</h2>
                <p className="modal-description">
                  This will terminate {safeToKillProcesses.length} background processes
                  to free up system resources.
                </p>

                {safeToKillProcesses.length > 0 ? (
                  <>
                    <div className="process-preview">
                      <div className="preview-header">
                        <span>Processes to terminate:</span>
                        <span className="memory-estimate">~{estimatedMemory} MB</span>
                      </div>
                      <ul className="preview-list">
                        {safeToKillProcesses.slice(0, 8).map(p => (
                          <li key={p.pid}>
                            <span className="process-name">{p.name}</span>
                            <span className="process-mem">{p.memory_percent.toFixed(1)}%</span>
                          </li>
                        ))}
                        {safeToKillProcesses.length > 8 && (
                          <li className="more-count">
                            +{safeToKillProcesses.length - 8} more...
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={handleClose}>
                        Cancel
                      </button>
                      <button className="btn-activate" onClick={handleActivate}>
                        Activate
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="no-processes">
                      No safe-to-kill processes found. System is already optimized!
                    </p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={handleClose}>
                        Close
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Loading State */}
            {modalState === 'loading' && (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Terminating processes...</p>
              </div>
            )}

            {/* Results State */}
            {modalState === 'results' && (
              <>
                <h2 className="modal-title">
                  {error ? 'Stealth Mode Error' : 'Stealth Mode Complete'}
                </h2>

                {error ? (
                  <p className="error-message">{error}</p>
                ) : result && (
                  <div className="results-content">
                    <div className="results-stats">
                      <div className="stat">
                        <span className="stat-value stat-success">
                          {result.terminated.length}
                        </span>
                        <span className="stat-label">Terminated</span>
                      </div>
                      {result.failed.length > 0 && (
                        <div className="stat">
                          <span className="stat-value stat-failed">
                            {result.failed.length}
                          </span>
                          <span className="stat-label">Failed</span>
                        </div>
                      )}
                      <div className="stat">
                        <span className="stat-value stat-memory">
                          {result.freed_memory_mb.toFixed(0)}
                        </span>
                        <span className="stat-label">MB Freed</span>
                      </div>
                    </div>

                    {result.terminated.length > 0 && (
                      <div className="terminated-list">
                        <p className="list-header">Terminated:</p>
                        <ul>
                          {result.terminated.slice(0, 5).map(t => (
                            <li key={t.pid}>{t.name || `PID ${t.pid}`}</li>
                          ))}
                          {result.terminated.length > 5 && (
                            <li className="more-count">
                              +{result.terminated.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-close" onClick={handleClose}>
                    Close
                  </button>
                </div>
                <p className="auto-dismiss">Auto-closing in 5 seconds...</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default StealthMode;
