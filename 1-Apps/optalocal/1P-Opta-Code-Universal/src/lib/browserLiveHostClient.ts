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
  viewerAuthToken?: string;
  scannedCandidateCount: number;
  requiredPortCount: number;
  maxSessionSlots: number;
  includePeekabooScreen: boolean;
  screenActionsEnabled: boolean;
  openSessionCount: number;
  slots: BrowserLiveHostSlot[];
}

const PRIMARY_SCAN_START_PORT = 46000;
const PRIMARY_SCAN_END_PORT = 46009;
const FALLBACK_SCAN_START_PORT = 46000;
const FALLBACK_SCAN_END_PORT = 47000;
const PORT_SCAN_CONCURRENCY = 24;
const STATUS_REQUEST_TIMEOUT_MS = 450;
const TOKEN_REQUEST_TIMEOUT_MS = 450;

let lastKnownControlPort: number | undefined;
const viewerTokenCacheByControlPort = new Map<number, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBrowserLiveHostStatus(value: unknown): value is BrowserLiveHostStatus {
  if (!isRecord(value)) return false;
  return (
    typeof value.running === "boolean" &&
    Array.isArray(value.safePorts) &&
    Array.isArray(value.slots) &&
    typeof value.requiredPortCount === "number" &&
    typeof value.maxSessionSlots === "number"
  );
}

function extractViewerTokenFromHtml(html: string): string | undefined {
  const patterns = [
    /const\s+screenToken\s*=\s*"([^"]+)"/,
    /const\s+viewerToken\s*=\s*"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const token = match?.[1]?.trim();
    if (token) return token;
  }
  return undefined;
}

function buildCandidatePorts(): number[] {
  const ports = new Set<number>();

  if (
    typeof lastKnownControlPort === "number" &&
    lastKnownControlPort >= FALLBACK_SCAN_START_PORT &&
    lastKnownControlPort <= FALLBACK_SCAN_END_PORT
  ) {
    ports.add(lastKnownControlPort);
  }

  for (let port = PRIMARY_SCAN_START_PORT; port <= PRIMARY_SCAN_END_PORT; port++) {
    ports.add(port);
  }
  for (let port = FALLBACK_SCAN_START_PORT; port <= FALLBACK_SCAN_END_PORT; port++) {
    ports.add(port);
  }

  return [...ports];
}

async function fetchStatusFromPort(port: number): Promise<BrowserLiveHostStatus | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), STATUS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (!isBrowserLiveHostStatus(data)) return null;
    return data;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function scanForLiveHostStatus(): Promise<BrowserLiveHostStatus | null> {
  const candidates = buildCandidatePorts();
  if (candidates.length === 0) return null;

  let cursor = 0;
  let found: BrowserLiveHostStatus | null = null;

  const workerCount = Math.min(PORT_SCAN_CONCURRENCY, candidates.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (found === null) {
      const index = cursor;
      cursor += 1;
      if (index >= candidates.length) return;
      const port = candidates[index];
      if (typeof port !== "number") return;

      const status = await fetchStatusFromPort(port);
      if (status) {
        if (typeof status.controlPort !== "number") {
          status.controlPort = port;
        }
        found = status;
        return;
      }
    }
  });

  await Promise.all(workers);
  return found;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function resolveViewerAuthToken(
  status: BrowserLiveHostStatus,
): Promise<string | undefined> {
  const directToken = status.viewerAuthToken?.trim();
  if (directToken) return directToken;

  const controlPort = status.controlPort;
  if (typeof controlPort === "number") {
    const cached = viewerTokenCacheByControlPort.get(controlPort);
    if (cached) return cached;
  }

  const firstSlotPort = status.slots.find((slot) => typeof slot.port === "number")?.port;
  const tokenProbeUrls: string[] = [];

  if (typeof controlPort === "number") {
    tokenProbeUrls.push(`http://127.0.0.1:${controlPort}/screen`);
  }
  if (typeof firstSlotPort === "number") {
    tokenProbeUrls.push(`http://127.0.0.1:${firstSlotPort}/`);
  }

  for (const url of tokenProbeUrls) {
    const html = await fetchText(url);
    if (!html) continue;
    const token = extractViewerTokenFromHtml(html);
    if (!token) continue;
    if (typeof controlPort === "number") {
      viewerTokenCacheByControlPort.set(controlPort, token);
    }
    return token;
  }

  return undefined;
}

/**
 * Scans localhost ports to find the active browser live host.
 */
export async function fetchBrowserLiveHostStatus(): Promise<BrowserLiveHostStatus | null> {
  const status = await scanForLiveHostStatus();
  if (!status) return null;

  if (typeof status.controlPort === "number") {
    lastKnownControlPort = status.controlPort;
  }

  const viewerAuthToken = await resolveViewerAuthToken(status);
  if (viewerAuthToken) {
    return { ...status, viewerAuthToken };
  }

  return status;
}
