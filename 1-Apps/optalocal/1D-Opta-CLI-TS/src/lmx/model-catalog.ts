/**
 * model-catalog.ts — User-configurable model groups for the /model picker.
 *
 * A ModelGroup is the single unit of configuration: name, label, color, patterns.
 * Groups are checked in array order; the first group whose patterns match wins.
 * Any model that matches no group falls into the last group if it has empty
 * patterns (treat it as a catch-all), or into an implicit "Other" bucket.
 *
 * Users can replace DEFAULT_GROUPS entirely via config.model.groups, or manage
 * groups with /model group commands.
 *
 * Pattern syntax (each string in the patterns array):
 *   "dolphin"          plain substring — case-insensitive contains match
 *   "/deepseek-r1/i"   regex — string wrapped in /…/flags parsed as RegExp
 */

export interface ModelGroup {
  name: string;
  label: string;
  color?: string;
  /** Plain substrings or "/regex/flags" strings. */
  patterns: string[];
}

/** Built-in groups — used when the user has not defined custom groups. */
export const DEFAULT_GROUPS: ModelGroup[] = [
  {
    name: 'jailbroken',
    label: '⚡ Jailbroken',
    color: '#f87171',
    patterns: ['dolphin', 'airoboros', 'manticore', 'samantha', 'abliterat', 'uncensored', 'wizard-vicuna', 'jailbreak'],
  },
  {
    name: 'embedding',
    label: '⊞ Embedding',
    color: '#60a5fa',
    patterns: ['embed', 'bge-', 'bge_', 'e5-', 'all-minilm', 'gte-'],
  },
  {
    name: 'vision',
    label: '◉ Vision',
    color: '#34d399',
    patterns: ['llava', 'moondream', 'minicpm-v', 'internvl', 'pixtral', 'paligemma', 'cogvlm', 'idefics', '-vl', 'vision'],
  },
  {
    name: 'reasoning',
    label: '◈ Reasoning',
    color: '#a78bfa',
    patterns: ['deepseek-r1', 'r1-distill', '-r1', 'qwq', 'thinking', 'reasoning', 'o1-', 'o3-'],
  },
  {
    name: 'coding',
    label: '⌨ Coding',
    color: '#22d3ee',
    patterns: ['coder', 'codestral', 'starcoder', 'granite-code', 'devstral', 'wizardcoder', 'codegemma', 'codellama', 'code-llama'],
  },
  {
    name: 'fast',
    label: '◌ Fast',
    color: '#fbbf24',
    patterns: ['tinyllama', 'smollm', 'orca-mini', 'phi-1.', 'phi-2', 'gemma-2b', 'gemma-2-2b', '-1b', '-2b', '-3b'],
  },
  {
    name: 'chat',
    label: '◎ Chat',
    color: '#94a3b8',
    patterns: [], // empty = catch-all
  },
];

/**
 * Compile a user-facing pattern string into a RegExp.
 *   "/deepseek-r1/i" → new RegExp("deepseek-r1", "i")
 *   "dolphin"        → /dolphin/i  (plain substring, case-insensitive)
 */
export function compilePattern(pattern: string): RegExp {
  const regexMatch = /^\/(.+)\/([gimsuy]*)$/.exec(pattern);
  if (regexMatch) {
    return new RegExp(regexMatch[1]!, regexMatch[2] || 'i');
  }
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

/**
 * Returns true if modelId matches any pattern in the group.
 * A group with empty patterns always matches (catch-all).
 */
export function groupMatches(modelId: string, group: ModelGroup): boolean {
  if (group.patterns.length === 0) return true;
  return group.patterns.some(p => compilePattern(p).test(modelId));
}

/**
 * Find the first matching group for a model ID.
 * Returns the last group if it has empty patterns (catch-all) or null if nothing matches.
 */
export function classifyModel(modelId: string, groups: ModelGroup[]): ModelGroup | null {
  for (const group of groups) {
    if (groupMatches(modelId, group)) return group;
  }
  return null;
}
