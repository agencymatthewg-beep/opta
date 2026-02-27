export const POST_SIGN_IN_NEXT_KEY = 'opta-local:post-sign-in-next';

/**
 * Accept only relative in-app paths.
 * Rejects absolute URLs and protocol-relative paths.
 */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
