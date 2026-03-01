/**
 * Model display profiles — cosmetic metadata for CLI display.
 *
 * Converts raw repo IDs like "inferencerlabs/MiniMax-M2.5-MLX-6.5bit"
 * into human-friendly names like "MiniMax M2.5 6.5b" with format tags
 * and 3-letter org abbreviations.
 *
 * Separate from core/models.ts (which handles context limits / compaction).
 */

export type ModelFormat = 'MLX' | 'GGUF' | 'CLOUD' | 'UNKNOWN';

export interface ModelDisplayProfile {
  repoId: string;
  displayName: string;
  orgAbbrev: string;
  format: ModelFormat;
}

// --- Org abbreviation map ---

const ORG_ABBREVS: Record<string, string> = {
  'mlx-community': 'MLX',
  'inferencerlabs': 'IFL',
  'inferencelabs': 'IFL',
  'lmstudio-community': 'LMS',
  'huggingface': 'HGF',
  'unsloth': 'UNS',
  'bartowski': 'BAR',
  'microsoft': 'MSF',
  'google': 'GGL',
  'meta-llama': 'MET',
  'anthropic': 'ANT',
  'mistralai': 'MST',
  'qwen': 'QWN',
  'openai': 'OAI',
  'cohere': 'COH',
  '01-ai': 'ZAI',
  'deepseek-ai': 'DSK',
};

function getOrgAbbrev(org: string): string {
  if (ORG_ABBREVS[org]) return ORG_ABBREVS[org];
  // Fallback: first 3 uppercase chars of org
  return org.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'UNK';
}

// --- Format detection ---

function detectFormat(repoId: string, org: string): ModelFormat {
  const lower = repoId.toLowerCase();
  if (lower.includes('.gguf')) return 'GGUF';
  if (org === 'anthropic' || lower.startsWith('claude')) return 'CLOUD';
  if (org === 'mlx-community' || org === 'inferencerlabs' || org === 'inferencelabs') return 'MLX';
  // Default local models to MLX
  return 'MLX';
}

// --- Display name simplification ---

function simplifyName(modelPart: string): string {
  let name = modelPart;

  // Normalize quant suffixes (order matters — longer patterns first)
  name = name.replace(/6\.5bit/gi, '6.5b');
  name = name.replace(/(\d+)bit/gi, '$1b');
  name = name.replace(/Q2_K_XL/gi, 'Q2K');
  name = name.replace(/Q3_K_[A-Z]+/gi, 'Q3K');
  name = name.replace(/Q4_K_M/gi, 'Q4M');
  name = name.replace(/Q4_K_S/gi, 'Q4S');
  name = name.replace(/Q5_K_M/gi, 'Q5M');
  name = name.replace(/Q6_K/gi, 'Q6K');
  name = name.replace(/Q8_0/gi, 'Q8');

  // Remove standalone "MLX" (it's redundant with the format tag)
  name = name.replace(/[-_]MLX(?=[-_]|$)/gi, '');
  name = name.replace(/^MLX[-_]/gi, '');

  // Replace separators with spaces
  name = name.replace(/[-_]/g, ' ');

  // Collapse multiple spaces
  name = name.replace(/\s{2,}/g, ' ').trim();

  return name;
}

// --- Main export ---

export function getDisplayProfile(repoId: string): ModelDisplayProfile {
  const slashIdx = repoId.indexOf('/');

  if (slashIdx === -1) {
    // No org prefix — treat the whole thing as the name
    return {
      repoId,
      displayName: simplifyName(repoId),
      orgAbbrev: 'UNK',
      format: repoId.toLowerCase().includes('.gguf') ? 'GGUF' : 'UNKNOWN',
    };
  }

  const org = repoId.slice(0, slashIdx);
  const modelPart = repoId.slice(slashIdx + 1);

  const orgAbbrev = getOrgAbbrev(org);
  const format = detectFormat(repoId, org);
  const displayName = simplifyName(modelPart);

  return { repoId, displayName, orgAbbrev, format };
}

/** Chalk color string for a format tag (caller must apply to chalk). */
export function formatTagLabel(format: ModelFormat): string {
  switch (format) {
    case 'MLX': return '[MLX]';
    case 'GGUF': return '[GGUF]';
    case 'CLOUD': return '[Cloud]';
    default: return '[?]';
  }
}
