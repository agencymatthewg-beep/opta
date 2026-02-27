'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClipboardContentType =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'sql'
  | 'shell'
  | 'code'
  | 'url'
  | 'markdown'
  | 'text';

interface ClipboardSuggestionSet {
  icon: string;
  label: string;
  prompts: readonly string[];
}

// ---------------------------------------------------------------------------
// Suggestion Templates
// ---------------------------------------------------------------------------

const SUGGESTIONS: Record<ClipboardContentType, ClipboardSuggestionSet> = {
  python: {
    icon: 'Code2',
    label: 'Python code detected',
    prompts: ['Review this code', 'Explain this code', 'Refactor this code', 'Find bugs'],
  },
  javascript: {
    icon: 'Code2',
    label: 'JavaScript detected',
    prompts: ['Review this code', 'Convert to TypeScript', 'Optimize performance', 'Explain this code'],
  },
  typescript: {
    icon: 'Code2',
    label: 'TypeScript detected',
    prompts: ['Review this code', 'Explain this code', 'Improve types', 'Refactor this code'],
  },
  html: {
    icon: 'Code2',
    label: 'HTML detected',
    prompts: ['Review this markup', 'Improve accessibility', 'Convert to React', 'Explain this code'],
  },
  css: {
    icon: 'Paintbrush',
    label: 'CSS detected',
    prompts: ['Review this CSS', 'Convert to Tailwind', 'Optimize selectors', 'Explain this code'],
  },
  json: {
    icon: 'Braces',
    label: 'JSON detected',
    prompts: ['Explain this structure', 'Validate this JSON', 'Generate TypeScript types', 'Summarize data'],
  },
  yaml: {
    icon: 'FileCode2',
    label: 'YAML detected',
    prompts: ['Explain this config', 'Validate this YAML', 'Convert to JSON', 'Find issues'],
  },
  sql: {
    icon: 'Database',
    label: 'SQL detected',
    prompts: ['Explain this query', 'Optimize performance', 'Find issues', 'Add indexes'],
  },
  shell: {
    icon: 'Terminal',
    label: 'Shell script detected',
    prompts: ['Explain this script', 'Find issues', 'Make it portable', 'Add error handling'],
  },
  code: {
    icon: 'Code2',
    label: 'Code detected',
    prompts: ['Review this code', 'Explain this code', 'Refactor this code', 'Find bugs'],
  },
  url: {
    icon: 'Link',
    label: 'URL detected',
    prompts: ['Summarize this page', 'Extract key points', 'Analyze the content'],
  },
  markdown: {
    icon: 'FileText',
    label: 'Markdown detected',
    prompts: ['Summarize', 'Improve writing', 'Extract action items', 'Reformat'],
  },
  text: {
    icon: 'FileText',
    label: 'Text detected',
    prompts: ['Summarize', 'Rewrite clearly', 'Extract action items', 'Proofread'],
  },
};

// ---------------------------------------------------------------------------
// Detection Heuristics
// ---------------------------------------------------------------------------

function detectContentType(text: string): ClipboardContentType {
  const trimmed = text.trim();

  // URL check — must come early since URLs are short and distinctive
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return 'url';
  }

  // JSON — starts with { or [ and parses successfully
  if (/^\s*[{\[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue detection
    }
  }

  // HTML — doctype or common tags
  if (/<!DOCTYPE|<html|<head|<body|<div|<span|<p\s|<a\s|<img\s|<table/i.test(trimmed)) {
    return 'html';
  }

  // SQL — keywords at start of statement
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WITH\s)/im.test(trimmed)) {
    return 'sql';
  }

  // Shell — shebang, common shell patterns
  if (/^#!\/bin\/(ba)?sh|^#!\/usr\/bin\/env\s+(ba)?sh/.test(trimmed)) {
    return 'shell';
  }
  const shellPatterns = [/^\s*\$\s/, /\becho\s/, /\bcd\s/, /\bsudo\s/, /\bchmod\s/, /\|\s*grep\b/, /\|\s*awk\b/, /\|\s*sed\b/];
  const shellMatches = shellPatterns.filter((p) => p.test(trimmed)).length;
  if (shellMatches >= 2) {
    return 'shell';
  }

  // Python — distinctive keywords and patterns
  const pythonPatterns = [/\bimport\s+\w/, /\bfrom\s+\w+\s+import\b/, /\bdef\s+\w+\(/, /\bclass\s+\w+[:(]/, /\bprint\(/, /\bif\s+__name__\s*==/, /\bself\.\w+/, /\belif\b/, /\basync\s+def\b/];
  const pythonMatches = pythonPatterns.filter((p) => p.test(trimmed)).length;
  if (pythonMatches >= 2) {
    return 'python';
  }

  // TypeScript — has type annotations or TS-specific keywords
  const tsPatterns = [/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /:\s*(string|number|boolean|void|never|unknown)\b/, /\bas\s+\w+/, /<\w+>/, /\benum\s+\w+/];
  const tsMatches = tsPatterns.filter((p) => p.test(trimmed)).length;
  if (tsMatches >= 2) {
    return 'typescript';
  }

  // JavaScript — ES6+ patterns
  const jsPatterns = [/\bconst\s+\w+/, /\blet\s+\w+/, /\bfunction\s+\w+/, /=>\s*[{(]/, /\bimport\s*\{/, /\bexport\s+(default\s+)?/, /\bconsole\.\w+/, /\bawait\s+/, /\basync\s+function/, /\brequire\(/];
  const jsMatches = jsPatterns.filter((p) => p.test(trimmed)).length;
  if (jsMatches >= 2) {
    return 'javascript';
  }

  // CSS — property patterns and selectors
  const cssPatterns = [/\{[^}]*\}/, /\b(color|margin|padding|display|flex|grid|font-size|background|border)\s*:/, /@media\s/, /@keyframes\s/, /\.([\w-]+)\s*\{/, /#([\w-]+)\s*\{/];
  const cssMatches = cssPatterns.filter((p) => p.test(trimmed)).length;
  if (cssMatches >= 2) {
    return 'css';
  }

  // YAML — key-value with colon, indentation-based, no braces
  const yamlPatterns = [/^\w[\w\s-]*:\s*.+/m, /^\s{2,}\w[\w\s-]*:/m, /^---\s*$/m, /^-\s+\w/m];
  const yamlMatches = yamlPatterns.filter((p) => p.test(trimmed)).length;
  if (yamlMatches >= 2 && !trimmed.includes('{')) {
    return 'yaml';
  }

  // Markdown — heading, list, code fence, bold/italic
  const mdPatterns = [/^#{1,6}\s+/m, /^[-*+]\s+/m, /^```/m, /\*\*.+\*\*/, /\[.+\]\(.+\)/, /^>\s+/m, /^- \[ \]/m];
  const mdMatches = mdPatterns.filter((p) => p.test(trimmed)).length;
  if (mdMatches >= 2) {
    return 'markdown';
  }

  // Generic code — indentation, brackets, semicolons
  const lines = trimmed.split('\n');
  const indentedLines = lines.filter((l) => /^\s{2,}\S/.test(l)).length;
  const hasBrackets = /[{}()[\]]/.test(trimmed);
  const hasSemicolons = /;\s*$/m.test(trimmed);
  if (lines.length > 3 && indentedLines / lines.length > 0.3 && (hasBrackets || hasSemicolons)) {
    return 'code';
  }

  return 'text';
}

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

export interface UseClipboardDetectorReturn {
  detectedType: ClipboardContentType | null;
  pastedContent: string | null;
  suggestions: readonly string[];
  icon: string | null;
  label: string | null;
  dismiss: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Detects clipboard content type on paste events for a textarea element.
 *
 * - Listens for paste events on the provided ref
 * - Detects content type using heuristics
 * - Returns suggested prompts for the detected type
 * - Auto-dismisses after 10 seconds or when user starts typing
 * - Debounces detection to avoid flash on rapid pastes (300ms)
 */
export function useClipboardDetector(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
): UseClipboardDetectorReturn {
  const [detectedType, setDetectedType] = useState<ClipboardContentType | null>(null);
  const [pastedContent, setPastedContent] = useState<string | null>(null);

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setDetectedType(null);
    setPastedContent(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // Listen for paste events on the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text || text.trim().length === 0) return;

      // Debounce to avoid flash on rapid pastes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const type = detectContentType(text);
        setDetectedType(type);
        setPastedContent(text);

        // Auto-dismiss after 10 seconds
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }
        dismissTimerRef.current = setTimeout(() => {
          dismiss();
        }, 10_000);
      }, 300);
    };

    textarea.addEventListener('paste', handlePaste);
    return () => {
      textarea.removeEventListener('paste', handlePaste);
    };
  }, [textareaRef, dismiss]);

  // Dismiss when user starts typing (not paste)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !detectedType) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys, navigation, and Enter (which submits)
      const ignoreKeys = new Set([
        'Shift', 'Control', 'Alt', 'Meta', 'Tab', 'Escape',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Enter', 'Home', 'End', 'PageUp', 'PageDown',
      ]);
      if (!ignoreKeys.has(e.key)) {
        dismiss();
      }
    };

    textarea.addEventListener('keydown', handleKeyDown);
    return () => {
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  }, [textareaRef, detectedType, dismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const suggestionSet = detectedType ? SUGGESTIONS[detectedType] : null;

  return {
    detectedType,
    pastedContent,
    suggestions: suggestionSet?.prompts ?? [],
    icon: suggestionSet?.icon ?? null,
    label: suggestionSet?.label ?? null,
    dismiss,
  };
}
