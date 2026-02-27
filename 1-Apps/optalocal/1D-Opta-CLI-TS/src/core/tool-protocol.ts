const PSEUDO_TOOL_TAG_NAMES = [
  'execute_command',
  'run_command',
  'read_file',
  'write_file',
  'edit_file',
  'multi_edit',
  'delete_file',
  'web_search',
  'web_fetch',
  'browser_open',
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_snapshot',
  'browser_screenshot',
  'browser_close',
] as const;

const OPEN_TAG_REGEX = /<([a-z_][a-z0-9_-]*)\b[^>]*>/gi;
const CLOSE_TAG_REGEX = /<\/([a-z_][a-z0-9_-]*)>/gi;
const PLAIN_DIRECTIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'run_command', pattern: /\brun(?:_shell)?_command\s+command\s*:/i },
  { name: 'search_files', pattern: /\bsearch_files\s+path\s*:/i },
  { name: 'read_file', pattern: /\bread_file\s+path\s*:/i },
  { name: 'write_file', pattern: /\bwrite_file\s+path\s*:/i },
  { name: 'edit_file', pattern: /\bedit_file\s+path\s*:/i },
  { name: 'browser_open', pattern: /\bbrowser_open\b/i },
  { name: 'browser_navigate', pattern: /\bbrowser_navigate\b/i },
  { name: 'browser_click', pattern: /\bbrowser_click\b/i },
  { name: 'browser_type', pattern: /\bbrowser_type\b/i },
];

export interface PseudoToolMarkupDetection {
  detected: boolean;
  toolTags: string[];
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

export function detectPseudoToolMarkup(text: string): PseudoToolMarkupDetection {
  if (!text || !text.includes('<')) {
    const plainMatches = PLAIN_DIRECTIVE_PATTERNS
      .filter((entry) => entry.pattern.test(text))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    return { detected: plainMatches.length > 0, toolTags: plainMatches };
  }

  const toolTagSet = new Set<string>(PSEUDO_TOOL_TAG_NAMES);
  const openTags = new Set<string>();
  const closeTags = new Set<string>();

  let openMatch: RegExpExecArray | null;
  while ((openMatch = OPEN_TAG_REGEX.exec(text)) !== null) {
    const tag = normalizeTag(openMatch[1] ?? '');
    if (toolTagSet.has(tag as typeof PSEUDO_TOOL_TAG_NAMES[number])) {
      openTags.add(tag);
    }
  }

  let closeMatch: RegExpExecArray | null;
  while ((closeMatch = CLOSE_TAG_REGEX.exec(text)) !== null) {
    const tag = normalizeTag(closeMatch[1] ?? '');
    if (toolTagSet.has(tag as typeof PSEUDO_TOOL_TAG_NAMES[number])) {
      closeTags.add(tag);
    }
  }

  const matched = [...openTags].filter((tag) => closeTags.has(tag)).sort((a, b) => a.localeCompare(b));
  const plainMatches = PLAIN_DIRECTIVE_PATTERNS
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const allMatches = [...new Set([...matched, ...plainMatches])].sort((a, b) => a.localeCompare(b));
  return {
    detected: allMatches.length > 0,
    toolTags: allMatches,
  };
}

export function buildPseudoToolCorrectionMessage(
  detection: PseudoToolMarkupDetection,
  browserEnabled: boolean,
): string {
  const tags = detection.toolTags.length > 0 ? detection.toolTags.join(', ') : 'unknown';
  const lines = [
    'Protocol correction: your previous response used pseudo tool tags in plain text.',
    `Detected pseudo tags: ${tags}.`,
    'Do NOT emit XML/HTML tool wrappers (for example: <execute_command>...</execute_command>).',
    'Use native JSON tool calls only.',
  ];
  if (browserEnabled) {
    lines.push('For web tasks, use browser_open/browser_navigate/browser_click/browser_type/browser_snapshot/browser_screenshot/browser_close.');
  }
  return lines.join(' ');
}
