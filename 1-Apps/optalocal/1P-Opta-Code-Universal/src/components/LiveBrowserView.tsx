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
    const errorCountRef = useRef(0);
    const nativeControls =
        showNativeControls === undefined ? isNativeDesktop() : showNativeControls;

    useEffect(() => {
        let active = true;
        let timeoutId: number;
        // Keep track of the previous object URL to avoid quick GC churn right as an image is mounting
        let currentObjectUrl: string | null = null;
        let previousObjectUrl: string | null = null;

        if (!slot) {
            setFrameUrl(null);
            setErrorCount(0);
            errorCountRef.current = 0;
            return;
        }
        const activeSlot = slot;

        async function loadFrame() {
            if (!active) return;
            let nextDelay = refreshRateMs;
            try {
                const controller = new AbortController();
                const timeoutHandle = window.setTimeout(() => controller.abort(), 2500);
                const response = await (async () => {
                    try {
                        return await fetch(`http://127.0.0.1:${activeSlot.port}/frame`, {
                            cache: "no-store",
                            signal: controller.signal,
                            headers: {
                                "Accept": "image/jpeg,image/avif,image/webp,*/*",
                                "Cache-Control": "no-cache",
                            }
                        });
                    } finally {
                        window.clearTimeout(timeoutHandle);
                    }
                })();

                if (response.ok) {
                    const blob = await response.blob();
                    if (!active) return;

                    if (previousObjectUrl) {
                        URL.revokeObjectURL(previousObjectUrl);
                    }
                    previousObjectUrl = currentObjectUrl;

                    currentObjectUrl = URL.createObjectURL(blob);
                    setFrameUrl(currentObjectUrl);
                    errorCountRef.current = 0;
                    setErrorCount(0);
                } else {
                    errorCountRef.current += 1;
                    setErrorCount(errorCountRef.current);
                }
            } catch {
                if (active) {
                    errorCountRef.current += 1;
                    setErrorCount(errorCountRef.current);
                }
            }

            if (active) {
                // Backoff if failing repeatedly.
                if (errorCountRef.current > 0) {
                    nextDelay = Math.min(5000, refreshRateMs * Math.max(1, errorCountRef.current));
                }
                timeoutId = window.setTimeout(loadFrame, nextDelay);
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
    }, [slot?.port, slot?.sessionId, refreshRateMs]);

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
