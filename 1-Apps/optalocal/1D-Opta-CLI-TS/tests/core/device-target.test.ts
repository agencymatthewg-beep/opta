import { afterEach, describe, expect, it } from 'vitest';
import { applyDeviceTargetEnv, parseDeviceTarget } from '../../src/core/device-target.js';

const ORIGINAL_OPTA_HOST = process.env['OPTA_HOST'];
const ORIGINAL_OPTA_PORT = process.env['OPTA_PORT'];

afterEach(() => {
  if (ORIGINAL_OPTA_HOST === undefined) {
    delete process.env['OPTA_HOST'];
  } else {
    process.env['OPTA_HOST'] = ORIGINAL_OPTA_HOST;
  }

  if (ORIGINAL_OPTA_PORT === undefined) {
    delete process.env['OPTA_PORT'];
  } else {
    process.env['OPTA_PORT'] = ORIGINAL_OPTA_PORT;
  }
});

describe('device target parsing', () => {
  it('parses host-only values', () => {
    expect(parseDeviceTarget('mono512.local')).toEqual({ host: 'mono512.local' });
  });

  it('parses host:port values', () => {
    expect(parseDeviceTarget('192.168.188.11:1234')).toEqual({
      host: '192.168.188.11',
      port: 1234,
    });
  });

  it('parses URL values', () => {
    expect(parseDeviceTarget('http://mono512.local:9999')).toEqual({
      host: 'mono512.local',
      port: 9999,
    });
  });

  it('parses bracketed ipv6 values', () => {
    expect(parseDeviceTarget('[2001:db8::1]:11434')).toEqual({
      host: '2001:db8::1',
      port: 11434,
    });
  });

  it('rejects invalid ports', () => {
    expect(() => parseDeviceTarget('mono512:70000')).toThrow(/invalid --device port/i);
  });
});

describe('applyDeviceTargetEnv', () => {
  it('sets OPTA_HOST and OPTA_PORT when a port is present', () => {
    const target = applyDeviceTargetEnv('mono512.local:1234');
    expect(target).toEqual({ host: 'mono512.local', port: 1234 });
    expect(process.env['OPTA_HOST']).toBe('mono512.local');
    expect(process.env['OPTA_PORT']).toBe('1234');
  });

  it('clears OPTA_PORT for host-only values', () => {
    process.env['OPTA_PORT'] = '5555';
    const target = applyDeviceTargetEnv('mono512.local');
    expect(target).toEqual({ host: 'mono512.local' });
    expect(process.env['OPTA_HOST']).toBe('mono512.local');
    expect(process.env['OPTA_PORT']).toBeUndefined();
  });
});
