/**
 * Redirect URL allowlist for SSO security.
 *
 * All `redirect_to` and `next` query parameters are validated against
 * these patterns. Any URL that doesn't match is rejected to prevent
 * open redirect attacks.
 */

const ALLOWED_PATTERNS: RegExp[] = [
  // Same-domain subdomains (*.optalocal.com)
  /^https:\/\/[a-z0-9-]+\.optalocal\.com(\/.*)?$/,
  // Life Manager (external domain)
  /^https:\/\/life\.opta\.app(\/.*)?$/,
  // CLI localhost callback (127.0.0.1 only, never 0.0.0.0)
  /^http:\/\/127\.0\.0\.1:\d+(\/.*)?$/,
  // Local development callback support
  /^http:\/\/localhost:\d+(\/.*)?$/,
  // iOS deep link
  /^opta-life:\/\/auth\/callback$/,
];

/**
 * Returns true if the given URL is an allowed redirect target.
 * Relative paths (starting with /) are always allowed for same-domain navigation.
 */
export function isAllowedRedirect(url: string): boolean {
  // Relative paths are always safe (same-domain)
  if (url.startsWith('/')) return true;

  return ALLOWED_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Validates and returns the redirect URL, or falls back to '/profile'.
 */
export function sanitizeRedirect(url: string | null | undefined): string {
  if (!url) return '/profile';
  if (isAllowedRedirect(url)) return url;
  return '/profile';
}
