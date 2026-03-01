import { useState, useEffect, useCallback } from "react";
import { fetchBrowserLiveHostStatus, type BrowserLiveHostStatus, type BrowserLiveHostSlot } from "../lib/browserLiveHostClient";

const POLL_INTERVAL_MS = 3000;

export function useBrowserLiveHost() {
    const [status, setStatus] = useState<BrowserLiveHostStatus | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const activeStatus = await fetchBrowserLiveHostStatus();
            setStatus(activeStatus);
        } catch {
            setStatus(null);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
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
