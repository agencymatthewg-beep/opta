export type TriggerWorkflowMode = 'normal' | 'plan' | 'research' | 'review';

export interface TriggerModeDefinition {
  word: string;
  modeHint?: TriggerWorkflowMode;
  /**
   * Higher values take precedence in deterministic ordering when multiple
   * trigger words match the same prompt.
   */
  priority?: number;
  capabilities?: string[];
  skills?: string[];
}

export interface TriggerRoutingResult {
  matchedWords: string[];
  matchedDefinitions: TriggerModeDefinition[];
  requestedCapabilities: string[];
  requestedSkills: string[];
  requestedModes: TriggerWorkflowMode[];
  effectiveMode: TriggerWorkflowMode;
}

const MODE_PRECEDENCE: Record<TriggerWorkflowMode, number> = {
  normal: 0,
  research: 1,
  plan: 2,
  review: 3,
};

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string): string {
  return value.replace(REGEX_ESCAPE_PATTERN, '\\$&');
}

function uniqueNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of items) {
    const candidate = raw.trim().toLowerCase();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of items) {
    const candidate = raw.trim();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function isKnownWorkflowMode(value: string | undefined): value is TriggerWorkflowMode {
  return value === 'normal' || value === 'plan' || value === 'research' || value === 'review';
}

export const DEFAULT_TRIGGER_MODE_DEFINITIONS: TriggerModeDefinition[] = [
  {
    word: 'review',
    modeHint: 'review',
    priority: 400,
    skills: ['ai26-3b-code-quality-code-reviewer', 'ai26-3b-code-quality-requesting-code-review'],
    capabilities: ['review'],
  },
  {
    word: 'plan',
    modeHint: 'plan',
    priority: 300,
    skills: ['ai26-3c-productivity-writing-plans'],
    capabilities: ['planning'],
  },
  {
    word: 'research',
    modeHint: 'research',
    priority: 200,
    skills: ['ai26-3i-ai-research-perp'],
    capabilities: ['research'],
  },
  {
    word: 'browser',
    priority: 100,
    skills: ['playwright'],
    capabilities: ['browser'],
  },
];

export function normalizeTriggerModeDefinitions(
  definitions: TriggerModeDefinition[]
): TriggerModeDefinition[] {
  const normalizedWords = uniqueNormalized(definitions.map((definition) => definition.word));
  if (normalizedWords.length === 0) return [];

  const byWord = new Map<string, TriggerModeDefinition>();
  for (const definition of definitions) {
    const normalizedWord = definition.word.trim().toLowerCase();
    if (!normalizedWord || byWord.has(normalizedWord)) continue;

    byWord.set(normalizedWord, {
      word: normalizedWord,
      modeHint:
        definition.modeHint && isKnownWorkflowMode(definition.modeHint)
          ? definition.modeHint
          : undefined,
      priority: Number.isFinite(definition.priority) ? Number(definition.priority) : 0,
      capabilities: uniqueStrings(definition.capabilities ?? []),
      skills: uniqueStrings(definition.skills ?? []),
    });
  }

  return normalizedWords
    .map((word) => byWord.get(word))
    .filter((definition): definition is TriggerModeDefinition => Boolean(definition));
}

export function triggerWordsFromDefinitions(definitions: TriggerModeDefinition[]): string[] {
  return normalizeTriggerModeDefinitions(definitions).map((definition) => definition.word);
}

export function collectMatchedTriggerDefinitions(
  prompt: string,
  definitions: TriggerModeDefinition[]
): TriggerModeDefinition[] {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) return [];

  const normalizedDefinitions = normalizeTriggerModeDefinitions(definitions);
  const matched: TriggerModeDefinition[] = [];

  for (const definition of normalizedDefinitions) {
    const pattern = new RegExp(`\\b${escapeRegex(definition.word)}\\b`, 'i');
    if (pattern.test(normalizedPrompt)) {
      matched.push(definition);
    }
  }

  return matched.sort((left, right) => {
    const leftPriority = left.priority ?? 0;
    const rightPriority = right.priority ?? 0;
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
    return left.word.localeCompare(right.word);
  });
}

export function resolveEffectiveMode(
  currentMode: TriggerWorkflowMode,
  modeHints: TriggerWorkflowMode[]
): TriggerWorkflowMode {
  const candidates = [currentMode, ...modeHints];
  let selected: TriggerWorkflowMode = currentMode;
  let selectedPriority = MODE_PRECEDENCE[currentMode];

  for (const candidate of candidates) {
    const priority = MODE_PRECEDENCE[candidate];
    if (priority > selectedPriority) {
      selected = candidate;
      selectedPriority = priority;
    }
  }

  return selected;
}

export function resolveTriggerRouting(options: {
  prompt: string;
  currentMode: TriggerWorkflowMode;
  definitions?: TriggerModeDefinition[];
}): TriggerRoutingResult {
  const definitions = options.definitions ?? DEFAULT_TRIGGER_MODE_DEFINITIONS;
  const matchedDefinitions = collectMatchedTriggerDefinitions(options.prompt, definitions);
  const matchedWords = matchedDefinitions.map((definition) => definition.word);
  const requestedCapabilities = uniqueStrings(
    matchedDefinitions.flatMap((definition) => definition.capabilities ?? [])
  );
  const requestedSkills = uniqueStrings(
    matchedDefinitions.flatMap((definition) => definition.skills ?? [])
  );
  const requestedModes = uniqueStrings(
    matchedDefinitions.map((definition) => definition.modeHint ?? '')
  ).filter((mode): mode is TriggerWorkflowMode => isKnownWorkflowMode(mode));
  const effectiveMode = resolveEffectiveMode(options.currentMode, requestedModes);

  return {
    matchedWords,
    matchedDefinitions,
    requestedCapabilities,
    requestedSkills,
    requestedModes,
    effectiveMode,
  };
}
