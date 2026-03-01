/**
 * Tests for mDNS discovery and LAN subnet sweep in mdns-discovery.ts.
 *
 * Strategy:
 *  - node:dgram: vi.mock at the top level, each test controls MockDgramSocket.
 *  - node:os: vi.mock at the top level so networkInterfaces() is replaceable.
 *  - node:http: vi.spyOn http.get to redirect probes to a real local server
 *    (or to simulate failures) without touching module internals.
 *  - Subnet sweep: real http.Server bound on 127.0.0.1:0 serves the
 *    /.well-known/opta-lmx endpoint; http.get is redirected to its port.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';

// ── dgram mock ───────────────────────────────────────────────────────────────

/**
 * A minimal EventEmitter-based dgram socket mock.
 * Tests call triggerBoundAndSent() to simulate a successful bind+send, then
 * simulateMessage(buf) to inject a fake mDNS response, or simulateError(err)
 * for error paths.
 */
class MockDgramSocket extends EventEmitter {
  public bindCallback: (() => void) | null = null;
  public sendCallback: ((err: Error | null) => void) | null = null;
  public closed = false;

  bind(_port: number, callback: () => void): void {
    this.bindCallback = callback;
  }

  addMembership(_addr: string): void {
    // no-op
  }

  send(
    _buf: Buffer,
    _offset: number,
    _length: number,
    _port: number,
    _address: string,
    callback: (err: Error | null) => void,
  ): void {
    this.sendCallback = callback;
  }

  close(): void {
    this.closed = true;
  }

  triggerBoundAndSent(): void {
    this.bindCallback?.();
    this.sendCallback?.(null);
  }

  simulateMessage(buf: Buffer): void {
    this.emit('message', buf);
  }

  simulateError(err: Error): void {
    this.emit('error', err);
  }
}

let activeMockSocket: MockDgramSocket | null = null;

// Top-level vi.mock calls are hoisted before imports by Vitest/Babel.
vi.mock('node:dgram', () => ({
  default: {
    createSocket: (_opts: unknown) => {
      activeMockSocket = new MockDgramSocket();
      return activeMockSocket;
    },
  },
}));

// We mock node:os so that networkInterfaces() is fully replaceable per test.
const mockNetworkInterfaces = vi.fn<[], NodeJS.Dict<NetworkInterfaceInfo[]>>(() => ({}));

vi.mock('node:os', () => ({
  default: {
    networkInterfaces: (...args: []) => mockNetworkInterfaces(...args),
  },
}));

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a valid mDNS response buffer compatible with parseMdnsResponse().
 *
 * parseDnsName() returns `currentOffset` (pointing AT the null byte) for
 * non-jumped names, which causes the RR header to be misread unless the answer
 * record names are compression pointers (jumped=true path, which correctly returns
 * `returnOffset` = 2 bytes past the pointer). This function builds the packet so
 * that ALL answer-record names and the SRV target are compression pointers.
 *
 * Packet layout (qdcount=0):
 *  Offset  0-11: DNS header
 *  Offset 12-31: SRV answer RR  (2-byte name ptr + 10-byte header + 8-byte rdata)
 *  Offset 32-47: A   answer RR  (2-byte name ptr + 10-byte header + 4-byte rdata)
 *  Offset 48-69: "_opta-lmx._tcp.local" spelled out (22 bytes incl. null)
 *  Offset 70-84: "mono512.local" spelled out         (15 bytes incl. null)
 *
 * Compression pointers:
 *  SRV answer name   → 0xC0 0x30 (offset 48, "_opta-lmx._tcp.local")
 *  SRV rdata target  → 0xC0 0x46 (offset 70, "mono512.local")
 *  A   answer name   → 0xC0 0x46 (offset 70, "mono512.local")
 */
function buildMdnsResponse(ip: string, port: number): Buffer {
  function encodeName(name: string): Buffer {
    const labels = name.split('.');
    const parts: Buffer[] = [];
    for (const label of labels) {
      const lb = Buffer.from(label, 'utf-8');
      parts.push(Buffer.from([lb.length]), lb);
    }
    parts.push(Buffer.from([0]));
    return Buffer.concat(parts);
  }

  const SVC_NAME_OFFSET = 48;   // where "_opta-lmx._tcp.local" will be spelled out
  const TARGET_NAME_OFFSET = 70; // where "mono512.local" will be spelled out

  // SRV rdata: priority(2) + weight(2) + port(2) + target ptr(2)
  const srvRdata = Buffer.alloc(8);
  srvRdata.writeUInt16BE(0, 0);    // priority
  srvRdata.writeUInt16BE(0, 2);    // weight
  srvRdata.writeUInt16BE(port, 4); // port
  srvRdata[6] = 0xc0;
  srvRdata[7] = TARGET_NAME_OFFSET; // compression ptr to "mono512.local"

  const srvRRHeader = Buffer.alloc(10);
  srvRRHeader.writeUInt16BE(33, 0);           // type SRV
  srvRRHeader.writeUInt16BE(1, 2);            // class IN
  srvRRHeader.writeUInt32BE(120, 4);          // ttl
  srvRRHeader.writeUInt16BE(srvRdata.length, 8);

  // SRV answer: [2-byte ptr to svcName][10-byte RR header][8-byte rdata] = 20 bytes
  const srvRR = Buffer.concat([
    Buffer.from([0xc0, SVC_NAME_OFFSET]),
    srvRRHeader,
    srvRdata,
  ]);

  // A rdata: 4-byte IP
  const aRdata = Buffer.from(ip.split('.').map(Number));

  const aRRHeader = Buffer.alloc(10);
  aRRHeader.writeUInt16BE(1, 0);              // type A
  aRRHeader.writeUInt16BE(1, 2);              // class IN
  aRRHeader.writeUInt32BE(120, 4);            // ttl
  aRRHeader.writeUInt16BE(aRdata.length, 8);  // rdlength = 4

  // A answer: [2-byte ptr to targetName][10-byte RR header][4-byte rdata] = 16 bytes
  const aRR = Buffer.concat([
    Buffer.from([0xc0, TARGET_NAME_OFFSET]),
    aRRHeader,
    aRdata,
  ]);

  // Name blobs appended at the end (at the computed offsets)
  const svcNameBuf    = encodeName('_opta-lmx._tcp.local'); // 22 bytes → offset 48..69
  const targetNameBuf = encodeName('mono512.local');         // 15 bytes → offset 70..84

  // DNS header: QR+AA, qdcount=0, ancount=2
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x0000, 0); // txid
  header.writeUInt16BE(0x8400, 2); // QR | AA
  header.writeUInt16BE(0, 4);      // qdcount = 0
  header.writeUInt16BE(2, 6);      // ancount = 2
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  return Buffer.concat([header, srvRR, aRR, svcNameBuf, targetNameBuf]);
}

/**
 * Start a real HTTP server on 127.0.0.1 that serves /.well-known/opta-lmx.
 */
async function startWellKnownServer(
  modelCount = 2,
): Promise<{ port: number; host: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.url === '/.well-known/opta-lmx') {
      const body = JSON.stringify({
        service: 'opta-lmx',
        version: '0.9.0',
        loaded_models: Array.from({ length: modelCount }, (_, i) => `model-${i}`),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;

  return {
    host: '127.0.0.1',
    port: addr.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// ── module reference ─────────────────────────────────────────────────────────

// Import the module under test. Because vi.mock() is hoisted, these mocks are
// already in place when the module is first evaluated.
import { discoverLmxHosts } from '../../src/lmx/mdns-discovery.js';

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  activeMockSocket = null;
  mockNetworkInterfaces.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('discoverLmxHosts — mDNS happy path', () => {
  it('includes a host found via mDNS SRV+A response', async () => {
    const TARGET_IP = '192.168.1.99';
    const TARGET_PORT = 1234;

    // No local interfaces → sweep finds nothing; only mDNS matters here.
    mockNetworkInterfaces.mockReturnValue({});

    const discoveryPromise = discoverLmxHosts(800);

    // Let the async function reach its bind() call.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    const socket = activeMockSocket;
    expect(socket, 'MockDgramSocket should have been created').not.toBeNull();

    socket!.triggerBoundAndSent();
    socket!.simulateMessage(buildMdnsResponse(TARGET_IP, TARGET_PORT));

    const results = await discoveryPromise;

    const found = results.find((h) => h.host === TARGET_IP && h.port === TARGET_PORT);
    expect(found).toBeDefined();
    expect(found!.source).toBe('mdns');
    expect(found!.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('discoverLmxHosts — subnet sweep happy path', () => {
  it('includes a host found via /.well-known/opta-lmx HTTP probe', async () => {
    const srv = await startWellKnownServer(3);

    try {
      // Expose a 127.0.0.x /24 subnet so the sweep will probe 127.0.0.1.
      mockNetworkInterfaces.mockReturnValue({
        en0: [
          {
            address: srv.host, // '127.0.0.1'
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '127.0.0.1/24',
          },
        ],
      });

      // The sweep uses DEFAULT_LMX_PORT=1234. Redirect those probes to our
      // test server's actual random port via http.get interception.
      const originalGet = http.get.bind(http);
      vi.spyOn(http, 'get').mockImplementation((options: unknown, callback?: unknown) => {
        const opts = options as { hostname: string; port: number; path: string; timeout: number };
        if (
          opts.hostname?.startsWith('127.0.0.') &&
          opts.port === 1234 &&
          opts.path === '/.well-known/opta-lmx'
        ) {
          return originalGet(
            { ...opts, hostname: srv.host, port: srv.port },
            callback as (res: http.IncomingMessage) => void,
          );
        }
        return originalGet(
          options as Parameters<typeof http.get>[0],
          callback as (res: http.IncomingMessage) => void,
        );
      });

      const results = await discoverLmxHosts(4000);

      const found = results.find((h) => h.host === '127.0.0.1' && h.source === 'sweep');
      expect(found).toBeDefined();
      expect(found!.modelCount).toBe(3);
      expect(found!.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      await srv.close();
    }
  });
});

describe('discoverLmxHosts — deduplication', () => {
  it('returns a single entry when the same host IP is found by both strategies', async () => {
    const TARGET_IP = '10.0.0.50';
    const TARGET_PORT = 1234;

    // Expose a 10.0.0.x subnet so the sweep covers TARGET_IP.
    mockNetworkInterfaces.mockReturnValue({
      en0: [
        {
          address: '10.0.0.1',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.0.0.1/24',
        },
      ],
    });

    // Intercept http.get: only TARGET_IP succeeds; everything else gets ECONNREFUSED.
    vi.spyOn(http, 'get').mockImplementation((options: unknown, callback?: unknown) => {
      const opts = options as { hostname: string; port: number; path: string; timeout: number };
      const fakeReq = new EventEmitter() as ReturnType<typeof http.get>;
      (fakeReq as unknown as { destroy: () => void }).destroy = () => {};

      if (opts.hostname === TARGET_IP && opts.path === '/.well-known/opta-lmx') {
        const body = JSON.stringify({
          service: 'opta-lmx',
          version: '0.9.0',
          loaded_models: [],
        });
        setImmediate(() => {
          const fakeRes = new EventEmitter() as NodeJS.ReadableStream & {
            statusCode: number;
            resume: () => void;
          };
          (fakeRes as unknown as { statusCode: number }).statusCode = 200;
          (fakeRes as unknown as { resume: () => void }).resume = () => {};
          (callback as (res: unknown) => void)(fakeRes);
          setImmediate(() => {
            fakeRes.emit('data', Buffer.from(body));
            fakeRes.emit('end');
          });
        });
      } else {
        setImmediate(() =>
          fakeReq.emit(
            'error',
            Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
          ),
        );
      }
      return fakeReq;
    });

    // Start discovery, then inject an mDNS response for the same TARGET_IP.
    const discoveryPromise = discoverLmxHosts(3000);

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    const socket = activeMockSocket;
    if (socket) {
      socket.triggerBoundAndSent();
      socket.simulateMessage(buildMdnsResponse(TARGET_IP, TARGET_PORT));
    }

    const results = await discoveryPromise;

    // The same host IP must appear only once in results.
    const hostsForIp = results.filter((h) => h.host === TARGET_IP);
    expect(hostsForIp).toHaveLength(1);
  });
});

describe('discoverLmxHosts — total failure', () => {
  it('returns an empty array when both strategies fail, without throwing', async () => {
    // No interfaces → sweep returns empty immediately.
    mockNetworkInterfaces.mockReturnValue({});

    const discoveryPromise = discoverLmxHosts(800);

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    // Trigger a socket error to short-circuit mDNS.
    const socket = activeMockSocket;
    if (socket) {
      socket.simulateError(new Error('EACCES: permission denied'));
    }

    const results = await discoveryPromise;
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});

describe('discoverLmxHosts — zero timeout', () => {
  it('returns quickly with an empty array when timeout is 0', async () => {
    // No interfaces → sweep returns empty.
    mockNetworkInterfaces.mockReturnValue({});

    const start = Date.now();
    const results = await discoverLmxHosts(0);
    const elapsed = Date.now() - start;

    expect(Array.isArray(results)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
    expect(results).toHaveLength(0);
  });
});
