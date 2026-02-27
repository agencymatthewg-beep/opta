/**
 * auth-utils — Shared authentication constants and helpers.
 *
 * Used by AppShell (for post-sign-in redirect logic) and the sign-in page
 * (for setting the next-path intent). Centralised here to avoid silent
 * divergence between the two consumers.
 */

/** sessionStorage key that records where to redirect after sign-in. */
export const POST_SIGN_IN_NEXT_KEY = 'opta-local:post-sign-in-next';

/**
 * Validate and sanitise a next-redirect path.
 *
 * Returns null if the path is missing, not root-relative, or looks like
 * a protocol-relative URL (`//…`) that could be used for open-redirect.
 */
export function sanitizeNextPath(nextPath: string | null): string | null {
  if (!nextPath) return null;
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return null;
  return nextPath;
}
