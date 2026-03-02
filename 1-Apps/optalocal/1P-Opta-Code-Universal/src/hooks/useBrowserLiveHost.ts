import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBrowserLiveHostStatus, type BrowserLiveHostStatus, type BrowserLiveHostSlot } from "../lib/browserLiveHostClient";

const FAST_POLL_INTERVAL_MS = 3000;
const SLOW_POLL_INTERVAL_MS = 30000;

export function useBrowserLiveHost() {
    const [status, setStatus] = useState<BrowserLiveHostStatus | null>(null);
    const inFlightRef = useRef(false);
    const nextPollDelayRef = useRef(FAST_POLL_INTERVAL_MS);

    const fetchStatus = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const activeStatus = await fetchBrowserLiveHostStatus();
            setStatus(activeStatus);
            nextPollDelayRef.current =
                activeStatus?.running ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
        } catch {
            setStatus(null);
            nextPollDelayRef.current = SLOW_POLL_INTERVAL_MS;
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | null = null;

        const loop = async () => {
            await fetchStatus();
            if (cancelled) return;
            timeoutId = window.setTimeout(loop, nextPollDelayRef.current);
        };

        void loop();
        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [fetchStatus]);

    const getSlotForSession = useCallback((sessionId: string): BrowserLiveHostSlot | undefined => {
        if (!status || !status.running) return undefined;
        return status.slots.find((slot) => slot.sessionId === sessionId);
    }, [status]);

    return {
        status,
        isActive: status?.running ?? false,
        getSlotForSession,
        refreshNow: fetchStatus,
    };
}
