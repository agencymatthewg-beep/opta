export interface BrowserLiveHostSlot {
    slotIndex: number;
    port: number;
    sessionId?: string;
    currentUrl?: string;
    actionSequence?: number;
}

export interface BrowserLiveHostStatus {
    running: boolean;
    host: string;
    safePorts: number[];
    controlPort?: number;
    scannedCandidateCount: number;
    requiredPortCount: number;
    maxSessionSlots: number;
    includePeekabooScreen: boolean;
    screenActionsEnabled: boolean;
    openSessionCount: number;
    slots: BrowserLiveHostSlot[];
}

const START_PORT = 46000;
const MAX_PORT = 46009;

/**
 * Scans localhost ports to find the active browser live host.
 */
export async function fetchBrowserLiveHostStatus(): Promise<BrowserLiveHostStatus | null> {
    for (let port = START_PORT; port <= MAX_PORT; port++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 800);

            const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
                signal: controller.signal,
                headers: {
                    Accept: 'application/json'
                }
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data && data.running !== undefined && Array.isArray(data.slots)) {
                    return data as BrowserLiveHostStatus;
                }
            }
        } catch {
            // Endpoint not running on this port, just continue scanning
        }
    }
    return null;
}
