import { createHash } from 'node:crypto';

const OPENCLAW_AGENT_PREFIX = 'opta-bridge';
const OPENCLAW_AGENT_HASH_LENGTH = 24;

export function normalizeOpenClawScope(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function deriveOpenClawAgentId(scope: string): string {
  const normalized = scope.trim();
  const digest = createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, OPENCLAW_AGENT_HASH_LENGTH);
  return `${OPENCLAW_AGENT_PREFIX}-${digest}`;
}
