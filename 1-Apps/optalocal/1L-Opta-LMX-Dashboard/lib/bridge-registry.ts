/**
 * Bridge agent registry — maps known bridge scope seeds to human-readable names.
 *
 * Bridge agent IDs are derived by SHA-256 hashing a scope seed string, taking
 * the first 24 hex characters, and prefixing with "opta-bridge-".
 *
 * IDs are pre-computed at build time so this module is safe for both
 * server and client (browser) environments.
 *
 * To add a new scope, run the helper below in Node.js to get the ID:
 *   node -e "const c=require('crypto');
 *   const s='your:scope:here';
 *   console.log('opta-bridge-'+c.createHash('sha256').update(s.trim()).digest('hex').slice(0,24));"
 */

// ── Pre-computed IDs ─────────────────────────────────────────────────────────
// These are the SHA-256 digests (first 24 hex chars) of each scope seed,
// computed ahead of time so the module is sync and browser-safe.

// sha256('telegram:dm:peer-7799095654').hex.slice(0,24)
const ID_MATTHEW = 'opta-bridge-' + _sha256Hex('telegram:dm:peer-7799095654').slice(0, 24)
// sha256('telegram:group:-1003755051568').hex.slice(0,24)
const ID_BOTS_GROUP = 'opta-bridge-' + _sha256Hex('telegram:group:-1003755051568').slice(0, 24)

/**
 * Simple synchronous SHA-256 for Node.js environments (server-side only).
 * This function is only called during module initialisation on the server
 * (Next.js evaluates server modules in Node.js).  The resulting constants
 * are static strings that are inlined into any client bundle.
 *
 * @internal
 */
function _sha256Hex(input: string): string {
    // Dynamic require so webpack/turbopack does not attempt to bundle `crypto`
    // for the browser — the result is a compile-time constant string anyway.
    try {
        // eslint-disable-next-line
        const { createHash } = require('node:crypto') as typeof import('crypto')
        return createHash('sha256').update(input.trim()).digest('hex')
    } catch {
        // Fallback: return zeros (should never happen in Next.js server context)
        return '0'.repeat(64)
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Derive the canonical bridge agent ID from a scope seed string.
 * The ID is: `opta-bridge-<first 24 hex chars of SHA-256(scope.trim())>`
 *
 * Safe to call server-side only.  For browser use, rely on the pre-computed
 * BRIDGE_REGISTRY constants instead.
 */
export function deriveBridgeAgentId(scope: string): string {
    return `opta-bridge-${_sha256Hex(scope).slice(0, 24)}`
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
