/**
 * Encrypted localStorage wrapper using Web Crypto API.
 *
 * Defense-in-depth: prevents casual exposure of admin keys in devtools/
 * localStorage inspection. Real protection is same-origin policy + no
 * external scripts. XSS can still access keys through the running app.
 *
 * Uses AES-GCM with PBKDF2-derived key from a stable seed
 * (window.location.origin + fixed app identifier).
 */

const APP_IDENTIFIER = 'opta-local-web-v1';
const PBKDF2_ITERATIONS = 100_000;

// ---------------------------------------------------------------------------
// Key derivation (cached per session)
// ---------------------------------------------------------------------------

let cachedKey: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const encoder = new TextEncoder();

  // Use origin as salt so encrypted values are origin-bound
  const salt = encoder.encode(
    typeof window !== 'undefined' ? window.location.origin : 'ssr-fallback',
  );

  // Import the app identifier as raw key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_IDENTIFIER),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return cachedKey;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface EncryptedPayload {
  iv: string; // base64
  ciphertext: string; // base64
}

/** Encrypt a plaintext value using AES-GCM with a PBKDF2-derived key. */
export async function encryptValue(value: string): Promise<string> {
  const key = await getDerivedKey();
  const encoder = new TextEncoder();

  // Random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value),
  );

  const payload: EncryptedPayload = {
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };

  return btoa(JSON.stringify(payload));
}

/** Decrypt a value that was encrypted with encryptValue(). */
export async function decryptValue(encrypted: string): Promise<string> {
  const key = await getDerivedKey();
  const decoder = new TextDecoder();

  const payload = JSON.parse(atob(encrypted)) as EncryptedPayload;
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return decoder.decode(plaintext);
}

/** Encrypt then store a value in localStorage. */
export async function setSecure(key: string, value: string): Promise<void> {
  const encrypted = await encryptValue(value);
  localStorage.setItem(key, encrypted);
}

/** Read from localStorage and decrypt. Returns null if not found or decryption fails. */
export async function getSecure(key: string): Promise<string | null> {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;

  try {
    return await decryptValue(encrypted);
  } catch {
    // Decryption failed (corrupted, wrong origin, etc.) -- treat as missing
    return null;
  }
}

/** Remove a value from localStorage. */
export function removeSecure(key: string): void {
  localStorage.removeItem(key);
}
