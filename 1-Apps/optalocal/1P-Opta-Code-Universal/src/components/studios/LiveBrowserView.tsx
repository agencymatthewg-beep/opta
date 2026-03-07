import { useEffect, useState, useRef } from "react";
import type { BrowserLiveHostSlot } from "../../lib/browserLiveHostClient";
import { isNativeDesktop } from "../../lib/runtime";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { Play, Pause, Square } from "lucide-react";

interface LiveBrowserViewProps {
  connection: DaemonConnectionOptions;
  slot?: BrowserLiveHostSlot;
  className?: string;
  refreshRateMs?: number;
  showNativeControls?: boolean;
  viewerAuthToken?: string;
}

export function LiveBrowserView({
  connection,
  slot,
  className = "",
  refreshRateMs = 800,
  showNativeControls,
  viewerAuthToken,
}: LiveBrowserViewProps) {
  const { runOperation } = useOperations(connection);
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
        const frameUrl = new URL(`http://127.0.0.1:${activeSlot.port}/frame`);
        if (viewerAuthToken?.trim()) {
          frameUrl.searchParams.set("token", viewerAuthToken.trim());
        }
        const controller = new AbortController();
        const timeoutHandle = window.setTimeout(() => controller.abort(), 2500);
        const response = await (async () => {
          try {
            return await fetch(frameUrl.toString(), {
              cache: "no-store",
              signal: controller.signal,
              headers: {
                Accept: "image/jpeg,image/avif,image/webp,*/*",
                "Cache-Control": "no-cache",
              },
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
          nextDelay = Math.min(
            5000,
            refreshRateMs * Math.max(1, errorCountRef.current),
          );
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
  }, [slot?.port, slot?.sessionId, refreshRateMs, viewerAuthToken]);

  return (
    <div
      className={`live-browser-view glass-panel ${className}`}
      ref={containerRef}
    >
      <div className="browser-header glass-subtle">
        {nativeControls ? (
          <div className="browser-traffic-lights">
            <span className="light light-close" />
            <span className="light light-min" />
            <span className="light light-max" />
          </div>
        ) : null}
        <div className="flex gap-2 mr-2">
          <button
            onClick={() => void runOperation("browser.runtime", { action: "play" })}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Play"
            type="button"
          >
            <Play size={14} className="text-green-400" />
          </button>
          <button
            onClick={() => void runOperation("browser.runtime", { action: "pause" })}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Pause"
            type="button"
          >
            <Pause size={14} className="text-yellow-400" />
          </button>
          <button
            onClick={() => void runOperation("browser.host", { action: "status" })}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Stop/Status"
            type="button"
          >
            <Square size={14} className="text-red-400" />
          </button>
        </div>
        <div className="browser-url-bar flex-1">
          <span className="truncate">
            {slot?.currentUrl || (slot ? "about:blank" : "Offline")}
          </span>
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
              <span className="text-secondary">
                Waiting for browser stream...
              </span>
            ) : (
              <span className="pulse-dot" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
