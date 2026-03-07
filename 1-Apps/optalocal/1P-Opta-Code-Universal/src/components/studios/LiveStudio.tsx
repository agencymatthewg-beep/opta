import { useState } from "react";
import { Maximize2, Minimize2, X, Play, Pause, Square } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import type { BrowserLiveHostSlot } from "../../lib/browserLiveHostClient";
import { LiveBrowserView } from "./LiveBrowserView";
import { isNativeDesktop } from "../../lib/runtime";
import { useOperations } from "../../hooks/useOperations";

interface LiveStudioProps {
    connection: DaemonConnectionOptions;
    slot?: BrowserLiveHostSlot;
    viewerAuthToken?: string;
    isFullscreen: boolean;
    onClose: () => void;
    onToggleFullscreen?: () => void;
}

const ACCENT = "#ef4444"; // Red for live/recording

export function LiveStudio({
    connection,
    slot,
    viewerAuthToken,
    isFullscreen,
    onClose,
    onToggleFullscreen,
}: LiveStudioProps) {
    const isMac = isNativeDesktop();
    const { runOperation } = useOperations(connection);

    return (
        <div
            className="opta-studio-shell"
            style={{
                "--studio-accent": ACCENT,
                "--studio-accent-rgb": "239, 68, 68",
            } as React.CSSProperties}
        >
            <div className="opta-studio-top-chrome" data-tauri-drag-region>
                <div className="studio-chrome-left" data-tauri-drag-region>
                    {isMac && (
                        <div className="studio-mac-traffic-lights" data-tauri-drag-region>
                            <button
                                type="button"
                                className="mac-light mac-light-close"
                                onClick={onClose}
                                aria-label="Close"
                            />
                            <button
                                type="button"
                                className="mac-light mac-light-min"
                                aria-label="Minimize"
                            />
                            <button
                                type="button"
                                className="mac-light mac-light-max"
                                onClick={onToggleFullscreen}
                                aria-label="Toggle Fullscreen"
                            />
                        </div>
                    )}
                    <div className="studio-chrome-titleplate" data-tauri-drag-region>
                        <span className="studio-chrome-titleplate-label" data-tauri-drag-region>
                            LIVE STUDIO
                        </span>
                        <div className="studio-chrome-subtitle" data-tauri-drag-region>
                            <span>Ctrl+L toggle</span>
                            <span className="studio-separator">·</span>
                            <span>Shift+Space fullscreen</span>
                            <span className="studio-separator">·</span>
                            <span>Esc close</span>
                        </div>
                    </div>
                </div>
                <div className="studio-chrome-right" data-tauri-drag-region>
                    <button
                        type="button"
                        className="studio-chrome-btn"
                        onClick={onToggleFullscreen}
                        aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </button>
                    {!isMac && (
                        <button
                            type="button"
                            className="studio-chrome-btn studio-chrome-btn--close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="feature-studio-content">
                <div className="feature-studio-content-header">
                    <div className="feature-studio-content-header-title">
                        <span className="pulse-dot bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] !w-2.5 !h-2.5 !mr-2" style={{ animationDuration: '1s' }}></span>
                        LIVE PLAYWRIGHT FEED
                    </div>
                    <div className="feature-studio-content-controls">
                        <div className="feature-studio-group">
                            <button
                                onClick={() => void runOperation("browser.runtime", { action: "play" })}
                                className="feature-studio-btn hover:!bg-white/10"
                                title="Play"
                                type="button"
                            >
                                <Play size={14} className="text-green-400" />
                                <span>Play</span>
                            </button>
                            <button
                                onClick={() => void runOperation("browser.runtime", { action: "pause" })}
                                className="feature-studio-btn hover:!bg-white/10"
                                title="Pause"
                                type="button"
                            >
                                <Pause size={14} className="text-yellow-400" />
                                <span>Pause</span>
                            </button>
                            <button
                                onClick={() => void runOperation("browser.host", { action: "status" })}
                                className="feature-studio-btn hover:!bg-white/10"
                                title="Stop/Status"
                                type="button"
                            >
                                <Square size={14} className="text-red-400" />
                                <span>Stop</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="feature-studio-pane py-4">
                    <div className="w-full h-full min-h-[400px] border border-white/5 rounded-lg overflow-hidden bg-black/40">
                        <LiveBrowserView
                            connection={connection}
                            slot={slot}
                            viewerAuthToken={viewerAuthToken}
                            className="w-full h-full !rounded-none !border-0 bg-transparent"
                            showNativeControls={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
