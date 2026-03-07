/**
 * Bridge agent registry — maps known bridge scope seeds to human-readable names.
 *
 * Bridge agent IDs are derived by SHA-256 hashing a scope seed string, taking
 * the first 24 hex characters, and prefixing with "opta-bridge-".
 *
 * IDs are pre-computed as string literals so this module is safe for both
 * server and client (browser) environments — no Node.js crypto dependency.
 *
 * To add a new scope, run the helper below in Node.js to get the ID:
 *   node -e "const c=require('crypto');
 *   const s='your:scope:here';
 *   console.log('opta-bridge-'+c.createHash('sha256').update(s.trim()).digest('hex').slice(0,24));"
 */

// ── Pre-computed IDs ─────────────────────────────────────────────────────────
// SHA-256 digests (first 24 hex chars) of each scope seed, pre-computed.

// sha256('telegram:dm:peer-7799095654').hex.slice(0,24)
const ID_MATTHEW = 'opta-bridge-abc1360b6a3eaa23827ab9a4'
// sha256('telegram:group:-1003755051568').hex.slice(0,24)
const ID_BOTS_GROUP = 'opta-bridge-45c4f273eb95b2850a73e376'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Derive the canonical bridge agent ID from a scope seed string.
 * Uses the Web Crypto API (available in both Node.js and browsers).
 *
 * Returns a promise — for synchronous lookups use BRIDGE_REGISTRY directly.
 */
export async function deriveBridgeAgentId(scope: string): Promise<string> {
    const data = new TextEncoder().encode(scope.trim())
    const buf = await crypto.subtle.digest('SHA-256', data)
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return `opta-bridge-${hex.slice(0, 24)}`
}

/**
 * Known bridge registrations.
 * Key: derived bridge agent ID  →  Value: human-readable label
 */
export const BRIDGE_REGISTRY: Record<string, string> = {
    [ID_MATTHEW]: 'Matthew',
    [ID_BOTS_GROUP]: 'Bots Group',
}

/**
 * Resolve a bridge agent ID to a display name.
 * Falls back to a truncated version of the ID if unknown.
 */
export function resolveBridgeName(bridgeId: string): string {
    return BRIDGE_REGISTRY[bridgeId] ?? `${bridgeId.slice(0, 20)}…`
}
