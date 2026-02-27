const PORT_MIN = 1;
const PORT_MAX = 65_535;

export interface DeviceTarget {
  host: string;
  port?: number;
}

function parsePort(raw: string): number {
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port < PORT_MIN || port > PORT_MAX) {
    throw new Error(`Invalid --device port "${raw}" (expected ${PORT_MIN}-${PORT_MAX})`);
  }
  return port;
}

function parseUrlLike(value: string): DeviceTarget | null {
  if (!value.includes('://')) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid --device value "${value}"`);
  }
  const host = parsed.hostname.trim();
  if (!host) throw new Error(`Invalid --device value "${value}"`);
  if (parsed.pathname && parsed.pathname !== '/') {
    throw new Error('Invalid --device value (paths are not supported)');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Invalid --device value (query/hash are not supported)');
  }
  return parsed.port ? { host, port: parsePort(parsed.port) } : { host };
}

export function parseDeviceTarget(raw: string): DeviceTarget {
  const value = raw.trim();
  if (!value) {
    throw new Error('Invalid --device value (cannot be empty)');
  }

  const urlLike = parseUrlLike(value);
  if (urlLike) return urlLike;

  const ipv6Bracket = value.match(/^\[([^[\]]+)\](?::(\d+))?$/);
  if (ipv6Bracket) {
    const host = ipv6Bracket[1]!.trim();
    if (!host) throw new Error(`Invalid --device value "${raw}"`);
    return ipv6Bracket[2] ? { host, port: parsePort(ipv6Bracket[2]) } : { host };
  }

  const hostPort = value.match(/^([^:\s]+):(\d+)$/);
  if (hostPort) {
    const host = hostPort[1]!.trim();
    if (!host) throw new Error(`Invalid --device value "${raw}"`);
    return { host, port: parsePort(hostPort[2]!) };
  }

  if (/\s/.test(value)) {
    throw new Error(`Invalid --device value "${raw}"`);
  }
  return { host: value };
}

/**
 * Apply a one-shot device target for this CLI process.
 * loadConfig() will consume these env vars as connection overrides.
 */
export function applyDeviceTargetEnv(raw: string): DeviceTarget {
  const target = parseDeviceTarget(raw);
  process.env['OPTA_HOST'] = target.host;
  if (target.port !== undefined) {
    process.env['OPTA_PORT'] = String(target.port);
  } else {
    delete process.env['OPTA_PORT'];
  }
  return target;
}
