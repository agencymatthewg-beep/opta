import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12; // 96-bit IV — standard for GCM

function resolveKey(): Buffer {
  const hex = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[token-crypto] OAUTH_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts an OAuth token payload using AES-256-GCM.
 *
 * Output format: <iv>.<authTag>.<ciphertext> (all base64url, dot-separated).
 * Safe to store in a TEXT database column without further encoding.
 *
 * GCM's authentication tag catches tampering — decryptOAuthToken will throw
 * if the ciphertext or key does not match.
 */
export function encryptOAuthToken(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

/**
 * Decrypts a token produced by encryptOAuthToken.
 *
 * Throws on tampered ciphertext (GCM authentication failure) or wrong key.
 */
export function decryptOAuthToken(ciphertext: string): string {
  const key = resolveKey();
  const parts = ciphertext.split('.');
  if (parts.length !== 3) throw new Error('[token-crypto] Invalid ciphertext format (expected iv.authTag.data)');
  const [ivB64, authTagB64, encB64] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
