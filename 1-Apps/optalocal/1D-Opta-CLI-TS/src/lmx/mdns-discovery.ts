/**
 * Zero-config LMX auto-discovery via mDNS and LAN subnet sweep.
 *
 * Uses ONLY Node.js built-ins (dgram, os, net, http) — no external packages.
 */

import dgram from 'node:dgram';
import os from 'node:os';
import http from 'node:http';

// ── Public types ────────────────────────────────────────────────────────────

export interface DiscoveredHost {
  host: string;
  port: number;
  latencyMs: number;
  source: 'mdns' | 'sweep';
  modelCount?: number;
}

// ── mDNS PTR query ──────────────────────────────────────────────────────────

const MDNS_MULTICAST_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const SERVICE_NAME = '_opta-lmx._tcp.local';

/** Encode a DNS domain name into label-format bytes. */
function encodeDnsName(name: string): Buffer {
  const labels = name.split('.');
  const parts: Buffer[] = [];
  for (const label of labels) {
    const encoded = Buffer.from(label, 'utf-8');
    parts.push(Buffer.from([encoded.length]), encoded);
  }
  parts.push(Buffer.from([0])); // null terminator
  return Buffer.concat(parts);
}

/** Build a minimal DNS query packet for PTR record (type=12, class=1). */
function buildMdnsQuery(): Buffer {
  // Header: 12 bytes
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x0000, 0); // Transaction ID
  header.writeUInt16BE(0x0000, 2); // Flags: standard query
  header.writeUInt16BE(1, 4);      // QDCOUNT: 1 question
  header.writeUInt16BE(0, 6);      // ANCOUNT
  header.writeUInt16BE(0, 8);      // NSCOUNT
  header.writeUInt16BE(0, 10);     // ARCOUNT

  // Question section
  const name = encodeDnsName(SERVICE_NAME);
  const qFooter = Buffer.alloc(4);
  qFooter.writeUInt16BE(12, 0);    // QTYPE: PTR
  qFooter.writeUInt16BE(1, 2);     // QCLASS: IN

  return Buffer.concat([header, name, qFooter]);
}

/** Parse a DNS name from a response buffer, handling compression pointers. */
function parseDnsName(buf: Buffer, offset: number): { name: string; newOffset: number } {
  const labels: string[] = [];
  let currentOffset = offset;
  let jumped = false;
  let returnOffset = offset;

  for (let i = 0; i < 128; i++) { // safety limit
    if (currentOffset >= buf.length) break;
    const len = buf[currentOffset]!;
    if (len === 0) {
      if (!jumped) returnOffset = currentOffset + 1;
      break;
    }
    // Compression pointer
    if ((len & 0xc0) === 0xc0) {
      if (currentOffset + 1 >= buf.length) break;
      if (!jumped) returnOffset = currentOffset + 2;
      currentOffset = ((len & 0x3f) << 8) | buf[currentOffset + 1]!;
      jumped = true;
      continue;
    }
    currentOffset++;
    if (currentOffset + len > buf.length) break;
    labels.push(buf.subarray(currentOffset, currentOffset + len).toString('utf-8'));
    currentOffset += len;
  }

  return { name: labels.join('.'), newOffset: jumped ? returnOffset : currentOffset };
}

interface MdnsResult {
  host: string;
  port: number;
}

/** Extract SRV + A records from mDNS response to find host:port. */
function parseMdnsResponse(buf: Buffer): MdnsResult[] {
  if (buf.length < 12) return [];

  const ancount = buf.readUInt16BE(6);
  const nscount = buf.readUInt16BE(8);
  const arcount = buf.readUInt16BE(10);
  const totalRecords = ancount + nscount + arcount;

  // Skip questions
  const qdcount = buf.readUInt16BE(4);
  let offset = 12;
  for (let i = 0; i < qdcount && offset < buf.length; i++) {
    const { newOffset } = parseDnsName(buf, offset);
    offset = newOffset + 4; // skip QTYPE + QCLASS
  }

  const srvRecords: Array<{ target: string; port: number }> = [];
  const aRecords = new Map<string, string>(); // name -> IP

  for (let i = 0; i < totalRecords && offset < buf.length; i++) {
    const { name, newOffset } = parseDnsName(buf, offset);
    offset = newOffset;
    if (offset + 10 > buf.length) break;

    const rtype = buf.readUInt16BE(offset);
    const rdlength = buf.readUInt16BE(offset + 8);
    offset += 10;

    if (offset + rdlength > buf.length) break;

    // SRV record (type 33)
    if (rtype === 33 && rdlength >= 6) {
      const port = buf.readUInt16BE(offset + 4);
      const { name: target } = parseDnsName(buf, offset + 6);
      srvRecords.push({ target, port });
    }

    // A record (type 1)
    if (rtype === 1 && rdlength === 4) {
      const ip = `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
      aRecords.set(name.toLowerCase(), ip);
    }

    offset += rdlength;
  }

  const results: MdnsResult[] = [];
  for (const srv of srvRecords) {
    const ip = aRecords.get(srv.target.toLowerCase());
    if (ip) {
      results.push({ host: ip, port: srv.port });
    }
  }
  return results;
}

async function discoverViaMdns(timeoutMs: number): Promise<DiscoveredHost[]> {
  return new Promise((resolve) => {
    const hosts: DiscoveredHost[] = [];
    const seen = new Set<string>();
    const started = Date.now();

    let socket: dgram.Socket;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch {
      resolve([]);
      return;
    }

    const finish = () => {
      try { socket.close(); } catch { /* ignore */ }
      resolve(hosts);
    };

    const timer = setTimeout(finish, timeoutMs);

    socket.on('error', () => {
      clearTimeout(timer);
      finish();
    });

    socket.on('message', (msg) => {
      const results = parseMdnsResponse(msg);
      for (const r of results) {
        const key = `${r.host}:${r.port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hosts.push({
          host: r.host,
          port: r.port,
          latencyMs: Date.now() - started,
          source: 'mdns',
        });
      }
    });

    socket.bind(0, () => {
      try {
        socket.addMembership(MDNS_MULTICAST_ADDR);
      } catch {
        // Some systems don't support multicast — proceed anyway
      }
      const query = buildMdnsQuery();
      socket.send(query, 0, query.length, MDNS_PORT, MDNS_MULTICAST_ADDR, (err) => {
        if (err) {
          clearTimeout(timer);
          finish();
        }
      });
    });
  });
}

// ── LAN subnet sweep ────────────────────────────────────────────────────────

const DEFAULT_LMX_PORT = 1234;
const SWEEP_CONCURRENCY = 32;

/** Get all local IPv4 addresses (non-loopback). */
function getLocalIpv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

/** Compute /24 subnet IPs from a given local address. */
function computeSubnetIps(localIp: string): string[] {
  const parts = localIp.split('.');
  if (parts.length !== 4) return [];
  const prefix = parts.slice(0, 3).join('.');
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${prefix}.${i}`);
  }
  return ips;
}

interface WellKnownResponse {
  name?: string;
  version?: string;
  models?: unknown;
  service?: string;
  loaded_models?: unknown[];
}

/** Probe a single IP for the LMX well-known endpoint. */
function probeLmxWellKnown(
  ip: string,
  port: number,
  probeTimeoutMs: number,
): Promise<DiscoveredHost | null> {
  const started = Date.now();
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: ip,
        port,
        path: '/.well-known/opta-lmx',
        timeout: probeTimeoutMs,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume(); // drain
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as WellKnownResponse;
            if (body.name || body.version || body.models || body.service) {
              const modelCount = Array.isArray(body.loaded_models) ? body.loaded_models.length : undefined;
              resolve({
                host: ip,
                port,
                latencyMs: Date.now() - started,
                source: 'sweep',
                modelCount,
              });
              return;
            }
          } catch { /* not valid JSON */ }
          resolve(null);
        });
        res.on('error', () => resolve(null));
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function discoverViaSubnetSweep(timeoutMs: number): Promise<DiscoveredHost[]> {
  const addresses = getLocalIpv4Addresses();
  if (addresses.length === 0) return [];

  // Collect unique candidate IPs across all local subnets
  const candidateSet = new Set<string>();
  for (const addr of addresses) {
    for (const ip of computeSubnetIps(addr)) {
      candidateSet.add(ip);
    }
  }
  const candidates = Array.from(candidateSet);

  const probeTimeoutMs = Math.min(800, timeoutMs);
  const hosts: DiscoveredHost[] = [];
  let active = 0;
  let index = 0;

  return new Promise((resolve) => {
    const overallTimer = setTimeout(() => resolve(hosts), timeoutMs);

    function scheduleNext(): void {
      while (active < SWEEP_CONCURRENCY && index < candidates.length) {
        const ip = candidates[index++]!;
        active++;
        probeLmxWellKnown(ip, DEFAULT_LMX_PORT, probeTimeoutMs).then((result) => {
          active--;
          if (result) hosts.push(result);
          if (index >= candidates.length && active === 0) {
            clearTimeout(overallTimer);
            resolve(hosts);
            return;
          }
          scheduleNext();
        }).catch(() => {
          active--;
          if (index >= candidates.length && active === 0) {
            clearTimeout(overallTimer);
            resolve(hosts);
            return;
          }
          scheduleNext();
        });
      }
    }

    scheduleNext();

    // Edge case: no candidates at all
    if (candidates.length === 0) {
      clearTimeout(overallTimer);
      resolve(hosts);
    }
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Discover Opta-LMX servers on the local network.
 *
 * Runs two strategies concurrently:
 * 1. mDNS PTR query for `_opta-lmx._tcp.local`
 * 2. LAN /24 subnet sweep probing `/.well-known/opta-lmx`
 *
 * Results are merged, deduplicated by host IP, and sorted by latency.
 */
export async function discoverLmxHosts(timeoutMs = 3000): Promise<DiscoveredHost[]> {
  const mdnsTimeout = Math.min(2000, timeoutMs);
  const sweepTimeout = timeoutMs;

  const [mdnsResult, sweepResult] = await Promise.allSettled([
    discoverViaMdns(mdnsTimeout),
    discoverViaSubnetSweep(sweepTimeout),
  ]);

  const allHosts: DiscoveredHost[] = [];
  if (mdnsResult.status === 'fulfilled') allHosts.push(...mdnsResult.value);
  if (sweepResult.status === 'fulfilled') allHosts.push(...sweepResult.value);

  // Deduplicate by host IP, keeping the entry with lowest latency
  const byHost = new Map<string, DiscoveredHost>();
  for (const host of allHosts) {
    const existing = byHost.get(host.host);
    if (!existing || host.latencyMs < existing.latencyMs) {
      byHost.set(host.host, host);
    }
  }

  // Sort by latency (fastest first)
  return Array.from(byHost.values()).sort((a, b) => a.latencyMs - b.latencyMs);
}
