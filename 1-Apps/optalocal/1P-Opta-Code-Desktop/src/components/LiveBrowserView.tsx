import { useEffect, useState, useRef } from "react";
import type { BrowserLiveHostSlot } from "../lib/browserLiveHostClient";
import { isNativeDesktop } from "../lib/runtime";

interface LiveBrowserViewProps {
    slot?: BrowserLiveHostSlot;
    className?: string;
    refreshRateMs?: number;
    showNativeControls?: boolean;
}

export function LiveBrowserView({
    slot,
    className = "",
    refreshRateMs = 800,
    showNativeControls,
}: LiveBrowserViewProps) {
    const [frameUrl, setFrameUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [errorCount, setErrorCount] = useState(0);
    const nativeControls =
        showNativeControls === undefined ? isNativeDesktop() : showNativeControls;

    useEffect(() => {
        let active = true;
        let timeoutId: number;
        // Keep track of the previous object URL to avoid quick GC churn right as an image is mounting
        let currentObjectUrl: string | null = null;
        let previousObjectUrl: string | null = null;

        async function loadFrame() {
            if (!active || !slot) return;
            try {
                const response = await fetch(`http://127.0.0.1:${slot.port}/frame`, {
                    cache: "no-store",
                    headers: {
                        "Accept": "image/jpeg,image/avif,image/webp,*/*",
                        "Cache-Control": "no-cache",
                    }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    if (!active) return;

                    if (previousObjectUrl) {
                        URL.revokeObjectURL(previousObjectUrl);
                    }
                    previousObjectUrl = currentObjectUrl;

                    currentObjectUrl = URL.createObjectURL(blob);
                    setFrameUrl(currentObjectUrl);
                    setErrorCount(0);
                } else {
                    setErrorCount(prev => prev + 1);
                }
            } catch (e) {
                if (active) setErrorCount(prev => prev + 1);
            }

            if (active) {
                // Backoff if failing repeatedly
                const backoff = errorCount > 5 ? Math.min(5000, refreshRateMs * errorCount) : refreshRateMs;
                timeoutId = window.setTimeout(loadFrame, backoff);
            }
        }

        // Start loop
        loadFrame();

        return () => {
            active = false;
            if (timeoutId) clearTimeout(timeoutId);
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
        };
    }, [slot?.port, refreshRateMs, errorCount]);

    return (
        <div className={`live-browser-view glass-panel ${className}`} ref={containerRef}>
            <div className="browser-header glass-subtle">
                {nativeControls ? (
                    <div className="browser-traffic-lights">
                        <span className="light light-close" />
                        <span className="light light-min" />
                        <span className="light light-max" />
                    </div>
                ) : null}
                <div className="browser-url-bar">
                    <span className="truncate">{slot?.currentUrl || (slot ? 'about:blank' : 'Offline')}</span>
                </div>
            </div>

            <div className="browser-viewport">
                {!slot ? (
                    <div className="browser-loading">
                        <span className="text-secondary">Browser Offline</span>
                    </div>
                ) : frameUrl ? (
                    <img
                        src={frameUrl}
                        alt={`Browser Session ${slot.sessionId}`}
                        className="browser-frame-img"
                        // Use pointer events to prevent dragging the image
                        draggable="false"
                    />
                ) : (
                    <div className="browser-loading">
                        {errorCount > 3 ? (
                            <span className="text-secondary">Waiting for browser stream...</span>
                        ) : (
                            <span className="pulse-dot" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
