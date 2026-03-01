/**
 * auth-utils — Shared authentication constants and helpers.
 *
 * Used by AppShell (for post-sign-in redirect logic) and the sign-in page
 * (for setting the next-path intent). Centralised here to avoid silent
 * divergence between the two consumers.
 */

/** sessionStorage key that records where to redirect after sign-in. */
export const POST_SIGN_IN_NEXT_KEY = 'opta-local:post-sign-in-next';

const DEFAULT_ACCOUNTS_SITE_URL = 'https://accounts.optalocal.com';

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

function normalizeOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function resolveAccountsSiteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL?.trim();
  if (configured) return normalizeOrigin(configured);
  if (process.env.NODE_ENV === 'production') return DEFAULT_ACCOUNTS_SITE_URL;
  return null;
}

function buildLocalSignInHref(nextPath: string): string {
  if (nextPath === '/sign-in') return '/sign-in';
  return `/sign-in?next=${encodeURIComponent(nextPath)}`;
}

/**
 * Build the preferred sign-in URL.
 *
 * In production this routes through accounts.optalocal.com so every app uses
 * a single auth portal; in local dev, it gracefully falls back to in-app
 * /sign-in unless NEXT_PUBLIC_ACCOUNTS_SITE_URL is explicitly configured.
 */
export function buildAccountSignInHref(nextPath: string, currentOrigin?: string): string {
  const safeNext = sanitizeNextPath(nextPath) ?? '/';
  const accountsSiteUrl = resolveAccountsSiteUrl();
  if (!accountsSiteUrl) return buildLocalSignInHref(safeNext);

  const runtimeOrigin =
    currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : null);

  if (!runtimeOrigin) return buildLocalSignInHref(safeNext);
  const normalizedOrigin = normalizeOrigin(runtimeOrigin);
  if (!normalizedOrigin) return buildLocalSignInHref(safeNext);

  const redirectTo = new URL(safeNext, normalizedOrigin).toString();
  const accountsSignInUrl = new URL('/sign-in', accountsSiteUrl);
  accountsSignInUrl.searchParams.set('redirect_to', redirectTo);
  return accountsSignInUrl.toString();
}
