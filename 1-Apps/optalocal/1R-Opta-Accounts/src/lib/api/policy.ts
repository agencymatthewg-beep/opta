export const TRUST_STATES = ['trusted', 'restricted', 'quarantined', 'revoked'] as const;
export type TrustState = (typeof TRUST_STATES)[number];

export const PROVIDERS = ['google', 'apple', 'openai', 'anthropic', 'gemini'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const HIGH_RISK_SCOPES = new Set(['automation.high_risk', 'lmx.admin']);

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function parseTrustState(value: unknown): TrustState | null {
  if (typeof value !== 'string') return null;
  return TRUST_STATES.includes(value as TrustState) ? (value as TrustState) : null;
}

export function parseProvider(value: string): Provider | null {
  return PROVIDERS.includes(value as Provider) ? (value as Provider) : null;
}

export function parseString(value: unknown, maxLength = 160): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function isIsoDateInPast(value: string | null): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  return time < Date.now();
}
