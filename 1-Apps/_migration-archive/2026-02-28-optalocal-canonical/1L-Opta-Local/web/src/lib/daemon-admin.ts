/**
 * Server-side daemon admin request helper.
 *
 * Keeps daemon auth token on the server and centralizes HTTP request handling
 * for Next.js route handlers that proxy to local daemon v3 endpoints.
 */

interface DaemonAdminRequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
}

export interface DaemonAdminResponse {
  status: number;
  body: unknown;
}

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:9999';

function getDaemonBaseUrl(): string {
  const baseUrl =
    process.env.OPTA_DAEMON_BASE_URL ??
    process.env.OPTA_DAEMON_URL ??
    DEFAULT_DAEMON_BASE_URL;

  return baseUrl.replace(/\/+$/, '');
}

async function parseDaemonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response
      .json()
      .catch(() => ({ error: 'Daemon returned invalid JSON' }));
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : null;
}

export async function daemonAdminRequest(
  path: `/v3/${string}`,
  options: DaemonAdminRequestOptions = {},
): Promise<DaemonAdminResponse> {
  const url = `${getDaemonBaseUrl()}${path}`;
  const token = process.env.OPTA_DAEMON_TOKEN;

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
    cache: 'no-store',
  });

  const parsedBody = await parseDaemonBody(response);

  return {
    status: response.status,
    body: parsedBody,
  };
}
