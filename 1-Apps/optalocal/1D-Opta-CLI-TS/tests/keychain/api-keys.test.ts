/**
 * tests/keychain/api-keys.test.ts
 *
 * Unit tests for the high-level API key helpers (keychain/api-keys.ts).
 * The low-level keychain module is mocked so no real OS keychain is used.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the low-level keychain module
// ---------------------------------------------------------------------------

const mockGetSecret = vi.fn<(service: string, account: string) => Promise<string | null>>();
const mockSetSecret = vi.fn<(service: string, account: string, secret: string) => Promise<void>>();
const mockDeleteSecret = vi.fn<(service: string, account: string) => Promise<void>>();
let mockKeychainAvailable = true;

vi.mock('../../src/keychain/index.js', () => ({
  getSecret: (service: string, account: string) => mockGetSecret(service, account),
  setSecret: (service: string, account: string, secret: string) => mockSetSecret(service, account, secret),
  deleteSecret: (service: string, account: string) => mockDeleteSecret(service, account),
  isKeychainAvailable: () => mockKeychainAvailable,
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import {
  storeAnthropicKey,
  storeLmxKey,
  getAnthropicKey,
  getLmxKey,
  deleteAnthropicKey,
  deleteLmxKey,
  keychainStatus,
} from '../../src/keychain/api-keys.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetSecret.mockReset();
  mockSetSecret.mockReset();
  mockDeleteSecret.mockReset();
  mockKeychainAvailable = true;
});

// ---------------------------------------------------------------------------
// storeAnthropicKey
// ---------------------------------------------------------------------------

describe('storeAnthropicKey', () => {
  it('stores key and returns true when write is verified', async () => {
    const key = 'sk-ant-test-key-abc123';
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockGetSecret.mockResolvedValueOnce(key); // verification read-back

    const result = await storeAnthropicKey(key);

    expect(result).toBe(true);
    expect(mockSetSecret).toHaveBeenCalledWith('opta-cli', 'anthropic-api-key', key);
    expect(mockGetSecret).toHaveBeenCalledWith('opta-cli', 'anthropic-api-key');
  });

  it('returns false when verification read-back returns different value', async () => {
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockGetSecret.mockResolvedValueOnce('different-value'); // mismatch

    const result = await storeAnthropicKey('sk-ant-intended-key');

    expect(result).toBe(false);
  });

  it('returns false when keychain is unavailable', async () => {
    mockKeychainAvailable = false;

    const result = await storeAnthropicKey('sk-ant-test');

    expect(result).toBe(false);
    expect(mockSetSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// storeLmxKey
// ---------------------------------------------------------------------------

describe('storeLmxKey', () => {
  it('stores LMX key and returns true on success', async () => {
    const key = 'opta_sk_lmx_test123';
    mockSetSecret.mockResolvedValueOnce(undefined);
    mockGetSecret.mockResolvedValueOnce(key);

    const result = await storeLmxKey(key);

    expect(result).toBe(true);
    expect(mockSetSecret).toHaveBeenCalledWith('opta-cli', 'lmx-api-key', key);
  });

  it('returns false when keychain is unavailable', async () => {
    mockKeychainAvailable = false;

    const result = await storeLmxKey('opta_sk_test');

    expect(result).toBe(false);
    expect(mockSetSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getAnthropicKey
// ---------------------------------------------------------------------------

describe('getAnthropicKey', () => {
  it('returns the stored key when present', async () => {
    mockGetSecret.mockResolvedValueOnce('sk-ant-stored-key');

    const result = await getAnthropicKey();

    expect(result).toBe('sk-ant-stored-key');
    expect(mockGetSecret).toHaveBeenCalledWith('opta-cli', 'anthropic-api-key');
  });

  it('returns null when key is not stored', async () => {
    mockGetSecret.mockResolvedValueOnce(null);

    const result = await getAnthropicKey();

    expect(result).toBeNull();
  });

  it('returns null when keychain is unavailable', async () => {
    mockKeychainAvailable = false;

    const result = await getAnthropicKey();

    expect(result).toBeNull();
    expect(mockGetSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getLmxKey
// ---------------------------------------------------------------------------

describe('getLmxKey', () => {
  it('returns the stored LMX key when present', async () => {
    mockGetSecret.mockResolvedValueOnce('opta_sk_lmx_stored');

    const result = await getLmxKey();

    expect(result).toBe('opta_sk_lmx_stored');
    expect(mockGetSecret).toHaveBeenCalledWith('opta-cli', 'lmx-api-key');
  });

  it('returns null when keychain is unavailable', async () => {
    mockKeychainAvailable = false;

    const result = await getLmxKey();

    expect(result).toBeNull();
    expect(mockGetSecret).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteAnthropicKey
// ---------------------------------------------------------------------------

describe('deleteAnthropicKey', () => {
  it('calls deleteSecret with correct service and account', async () => {
    mockDeleteSecret.mockResolvedValueOnce(undefined);

    await deleteAnthropicKey();

    expect(mockDeleteSecret).toHaveBeenCalledWith('opta-cli', 'anthropic-api-key');
  });
});

// ---------------------------------------------------------------------------
// deleteLmxKey
// ---------------------------------------------------------------------------

describe('deleteLmxKey', () => {
  it('calls deleteSecret with correct service and account', async () => {
    mockDeleteSecret.mockResolvedValueOnce(undefined);

    await deleteLmxKey();

    expect(mockDeleteSecret).toHaveBeenCalledWith('opta-cli', 'lmx-api-key');
  });
});

// ---------------------------------------------------------------------------
// keychainStatus
// ---------------------------------------------------------------------------

describe('keychainStatus', () => {
  it('reports both keys stored when both are present', async () => {
    mockGetSecret
      .mockResolvedValueOnce('sk-ant-abc')  // anthropic
      .mockResolvedValueOnce('opta_sk_xyz'); // lmx

    const status = await keychainStatus();

    expect(status).toEqual({ available: true, anthropic: true, lmx: true });
  });

  it('reports anthropic false when anthropic key is null', async () => {
    mockGetSecret
      .mockResolvedValueOnce(null)           // anthropic not stored
      .mockResolvedValueOnce('opta_sk_xyz'); // lmx stored

    const status = await keychainStatus();

    expect(status).toEqual({ available: true, anthropic: false, lmx: true });
  });

  it('reports both false when neither key is stored', async () => {
    mockGetSecret
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const status = await keychainStatus();

    expect(status).toEqual({ available: true, anthropic: false, lmx: false });
  });

  it('reports available false when keychain is unavailable (no reads)', async () => {
    mockKeychainAvailable = false;

    const status = await keychainStatus();

    expect(status).toEqual({ available: false, anthropic: false, lmx: false });
    expect(mockGetSecret).not.toHaveBeenCalled();
  });

  it('reports anthropic false when key is empty string', async () => {
    mockGetSecret
      .mockResolvedValueOnce('')    // empty = not stored
      .mockResolvedValueOnce(null);

    const status = await keychainStatus();

    expect(status.anthropic).toBe(false);
  });
});
