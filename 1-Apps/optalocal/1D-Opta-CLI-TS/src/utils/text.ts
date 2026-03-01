 
/**
 * Deduplicate and trim a string array, preserving insertion order.
 * Used by MCP bootstrap, registry, and policy normalization.
 */
export function normalizeStringList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

const ANSI_ESCAPE_RE = /\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g;

/**
 * Strip ANSI escape codes while preserving textual content.
 */
export function stripAnsi(input: string): string {
  if (!input) return '';
  return input.replace(ANSI_ESCAPE_RE, '');
}

/**
 * Strip ANSI escape codes and non-printable control characters that can
 * corrupt Ink layout measurement.
 */
export function sanitizeTerminalText(input: string): string {
  if (!input) return '';

  return stripAnsi(input)
    // Keep Windows CRLF as newline, but drop lone CR (commonly used for
    // in-place progress updates) by converting to a space so tokens don't
    // collapse into a single merged word.
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, ' ')
    // Normalize tabs to spaces so table/log output remains deterministic in Ink.
    .replace(/\t/g, '  ')
    // Remove all remaining control chars except \n.
     
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    // Remove zero-width formatting chars that can break width estimation.
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Normalize trailing line whitespace to prevent pathological line wrapping.
    .replace(/[ \t]+$/gm, '')
    // Space-only lines are effectively blank lines in terminal rendering.
    .replace(/^[ \t]+$/gm, '')
    // Keep user-visible spacing but cap runaway blank-line growth.
    .replace(/\n{4,}/g, '\n\n\n');
}

/**
 * Sanitize a streaming token chunk without trimming edge whitespace.
 *
 * Token streams can carry semantic spaces at either the beginning or end of
 * each chunk. Unlike `sanitizeTerminalText`, this keeps those spaces intact so
 * incrementally concatenated output does not collapse words together.
 */
export function sanitizeTerminalTokenChunk(input: string): string {
  if (!input) return '';

  return stripAnsi(input)
    .replace(/\r\n/g, '\n')
    // Preserve token boundaries for chunked streams that emit lone CR.
    .replace(/\r/g, ' ')
    .replace(/\t/g, '  ')
    // Remove control chars but preserve visible whitespace (\n and spaces).
     
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

function normalizeInlineMarkdownHeadings(input: string): string {
  return input
    // Start headings on a fresh paragraph when models inline them.
    .replace(/([^\n])\s+(#{1,6}\s)/g, '$1\n\n$2')
    // Avoid over-gapped heading stacks.
    .replace(/\n{3,}(#{1,6}\s)/g, '\n\n$1');
}

function splitDenseDashLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;
  if (trimmed.startsWith('#')) return line;
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) return line;
  if (trimmed.startsWith('```')) return line;
  if (trimmed.includes('http://') || trimmed.includes('https://')) return line;

  const matchCount = (line.match(/\s-\s/g) ?? []).length;
  if (matchCount < 2) return line;

  const parts = line.split(/\s-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return line;

  const first = parts[0] ?? '';
  const rest = parts.slice(1);
  const colonIdx = first.indexOf(':');
  if (colonIdx > 0 && colonIdx < first.length - 1) {
    const prefix = first.slice(0, colonIdx + 1).trim();
    const firstItem = first.slice(colonIdx + 1).trim();
    const items = [firstItem, ...rest].filter(Boolean);
    if (items.length === 0) return line;
    return `${prefix}\n- ${items.join('\n- ')}`;
  }

  return `${first}\n- ${rest.join('\n- ')}`;
}

function expandDenseLabels(line: string): string {
  if (line.length < 120) return line;
  const labelMatches = line.match(/\b[a-z][a-z0-9_-]{1,20}:\s/gi) ?? [];
  if (labelMatches.length < 2) return line;
  return line.replace(/\s+([a-z][a-z0-9_-]{1,20}:\s)/gi, '\n$1');
}

function normalizeMissingInlineSpaces(line: string): string {
  // Insert missing spaces after punctuation in dense prose (`foo,bar` -> `foo, bar`)
  // and between collapsed camel boundaries in non-code prose (`toolStatus` -> `tool Status`).
  return line
    .replace(/([,:;.!?])(?=[A-Za-z])/g, '$1 ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

const HARD_TOKEN_WRAP_LIMIT = 48;

function breakOverlongTokens(line: string): string {
  if (line.length < HARD_TOKEN_WRAP_LIMIT * 2) return line;

  return line
    .split(/(\s+)/)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment)) return segment;
      if (segment.length < HARD_TOKEN_WRAP_LIMIT * 2) return segment;
      if (segment.includes('://')) return segment;
      if (segment.includes('`')) return segment;
      if (!/[A-Za-z0-9]/.test(segment)) return segment;
      const chunks = segment.match(new RegExp(`.{1,${HARD_TOKEN_WRAP_LIMIT}}`, 'g'));
      if (!chunks || chunks.length <= 1) return segment;
      return chunks.join('\n');
    })
    .join('');
}

function splitLongProseLine(line: string, streaming: boolean): string {
  if (streaming) return breakOverlongTokens(line);
  if (line.length < 140) return line;

  const trimmed = line.trim();
  if (!trimmed) return line;
  if (trimmed.startsWith('#')) return line;
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) return line;
  if (trimmed.startsWith('```')) return line;
  if (trimmed.startsWith('|') || trimmed.includes('|')) return line;
  if (trimmed.includes('http://') || trimmed.includes('https://')) return line;

  let next = breakOverlongTokens(normalizeMissingInlineSpaces(line));
  next = next.replace(/([.!?;])\s+(?=[A-Z0-9#])/g, '$1\n');
  if (next.length >= 140) {
    next = next.replace(/,\s+(?=[A-Za-z0-9])/g, ',\n');
  }
  if (next.length >= 140) {
    next = next.replace(/\)\s+(?=[A-Za-z0-9])/g, ')\n');
  }
  return next;
}

function formatDenseNonCodeSegment(segment: string, streaming: boolean): string {
  let formatted = normalizeInlineMarkdownHeadings(segment)
    // Start numbered list markers on new lines when inline-packed.
    .replace(/([^\n])\s+(\d{1,3}\.\s)/g, '$1\n$2')
    // Encourage clear bullets when models emit sentence-style " - " separators.
    .replace(/([.!?;:])\s+-\s+/g, '$1\n- ');

  const lines = formatted
    .split('\n')
    .map((line) => expandDenseLabels(line))
    .map((line) => (streaming ? line : splitDenseDashLine(line)))
    .map((line) => splitLongProseLine(line, streaming));

  formatted = lines.join('\n');

  // Keep clear spacing, but avoid runaway blank vertical gaps.
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return formatted;
}

/**
 * Premium display formatter for assistant responses.
 *
 * Preserves code-fence blocks verbatim while restructuring dense prose into
 * headings/lists with clearer spacing for terminal readability.
 */
export function formatAssistantDisplayText(
  input: string,
  options?: { streaming?: boolean },
): string {
  const base = sanitizeTerminalText(input);
  if (!base) return '';

  const streaming = Boolean(options?.streaming);
  const lines = base.split('\n');
  const out: string[] = [];
  const proseBuffer: string[] = [];
  let inFence = false;

  const flushProseBuffer = (): void => {
    if (proseBuffer.length === 0) return;
    const segment = proseBuffer.join('\n');
    proseBuffer.length = 0;
    if (!segment.trim()) {
      out.push(segment);
      return;
    }
    out.push(formatDenseNonCodeSegment(segment, streaming));
  };

  for (const line of lines) {
    const fenceToggle = line.trim().startsWith('```');
    if (fenceToggle) {
      flushProseBuffer();
      out.push(line);
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    proseBuffer.push(line);
  }

  flushProseBuffer();

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Keep leading indentation but drop trailing blank lines/whitespace.
 */
export function trimDisplayTail(input: string): string {
  return input.replace(/[ \t]+\n/g, '\n').replace(/\s+$/, '');
}

function isZeroWidthCodePoint(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) || // Combining Diacritical Marks
    (cp >= 0x1ab0 && cp <= 0x1aff) || // Combining Diacritical Marks Extended
    (cp >= 0x1dc0 && cp <= 0x1dff) || // Combining Diacritical Marks Supplement
    (cp >= 0x20d0 && cp <= 0x20ff) || // Combining Diacritical Marks for Symbols
    (cp >= 0xfe20 && cp <= 0xfe2f) || // Combining Half Marks
    (cp >= 0xfe00 && cp <= 0xfe0f) || // Variation Selectors
    cp === 0x200d // Zero-width joiner
  );
}

function isWideCodePoint(cp: number): boolean {
  return cp >= 0x1100 && (
    cp <= 0x115f ||
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

function normalizeForWidth(input: string): string {
  if (!input) return '';
  return stripAnsi(input)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    // Keep tabs/newlines and spaces intact for layout math.
     
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
}

/**
 * Approximate terminal cell width for sanitized text.
 */
export function visibleTextWidth(input: string): number {
  const text = normalizeForWidth(input);
  let width = 0;

  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue;
    if (ch === '\t') {
      width += 2;
      continue;
    }

    const cp = ch.codePointAt(0);
    if (!cp) continue;
    if (cp < 32 || (cp >= 0x7f && cp <= 0x9f)) continue;
    if (isZeroWidthCodePoint(cp)) continue;
    width += isWideCodePoint(cp) ? 2 : 1;
  }

  return width;
}
