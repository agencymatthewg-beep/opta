export interface TriggerHighlightMatch {
  start: number;
  end: number;
  trigger: string;
}

export interface TriggerHighlightChunk {
  text: string;
  highlighted: boolean;
}

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string): string {
  return value.replace(REGEX_ESCAPE_PATTERN, '\\$&');
}

export function normalizeTriggerWords(words: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of words) {
    const candidate = raw.trim().toLowerCase();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

export function collectTriggerHighlightMatches(
  line: string,
  triggerWords: string[],
): TriggerHighlightMatch[] {
  if (!line || triggerWords.length === 0) return [];

  const matches: TriggerHighlightMatch[] = [];
  for (const trigger of normalizeTriggerWords(triggerWords)) {
    const pattern = new RegExp(`\\b${escapeRegex(trigger)}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const found = match[0];
      const start = match.index;
      if (found.length <= 0 || start < 0) continue;
      const end = start + found.length;
      matches.push({ start, end, trigger });

      if (pattern.lastIndex === match.index) {
        pattern.lastIndex += 1;
      }
    }
  }

  return matches.sort((left, right) => (
    left.start - right.start || left.end - right.end || left.trigger.localeCompare(right.trigger)
  ));
}

export function buildTriggerHighlightMask(
  lineLength: number,
  matches: TriggerHighlightMatch[],
): boolean[] {
  const mask = new Array<boolean>(Math.max(0, lineLength)).fill(false);

  for (const match of matches) {
    const start = Math.max(0, Math.min(match.start, mask.length));
    const end = Math.max(start, Math.min(match.end, mask.length));
    for (let index = start; index < end; index += 1) {
      mask[index] = true;
    }
  }

  return mask;
}

export function chunkTextByTriggerMask(
  text: string,
  startIndex: number,
  mask: boolean[],
): TriggerHighlightChunk[] {
  if (!text) return [];

  const chunks: TriggerHighlightChunk[] = [];
  let current = '';
  let highlighted = Boolean(mask[startIndex]);

  for (let offset = 0; offset < text.length; offset += 1) {
    const absoluteIndex = startIndex + offset;
    const nextHighlighted = Boolean(mask[absoluteIndex]);
    const char = text[offset] ?? '';

    if (offset === 0) {
      highlighted = nextHighlighted;
      current = char;
      continue;
    }

    if (nextHighlighted === highlighted) {
      current += char;
      continue;
    }

    chunks.push({ text: current, highlighted });
    current = char;
    highlighted = nextHighlighted;
  }

  if (current.length > 0) {
    chunks.push({ text: current, highlighted });
  }

  return chunks;
}
