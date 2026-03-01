import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Text } from 'ink';
import { formatMarkdownTables } from '../ui/markdown.js';
import { colorizeOptaWord } from '../ui/brand.js';
import { sanitizeTerminalText } from '../utils/text.js';

/** Streaming flush windows tuned for ~60 FPS target under token bursts. */
const STREAMING_FLUSH_FAST_MS = 8;
const STREAMING_FLUSH_NORMAL_MS = 16;
const STREAMING_FLUSH_BURST_MS = 32;
const STREAMING_SMALL_DELTA_CHARS = 16;
const STREAMING_LARGE_DELTA_CHARS = 128;

/** Maximum cache entries before evicting oldest. */
const MAX_CACHE_SIZE = 800;
const DEFAULT_RENDER_WIDTH = 100;

// Module-level render cache: key = `${width}:${text}`, value = rendered ANSI string.
const renderCache = new Map<string, string>();

// Lazy-loaded renderers keyed by width.
const renderersByWidth = new Map<number, (md: string) => string>();
let defaultRenderer: ((md: string) => string) | null = null;
let rendererReady = false;
let rendererDegraded = false;

function cacheKey(text: string, width: number): string {
  return `${width}:${text}`;
}

function evictIfNeeded(): void {
  if (renderCache.size > MAX_CACHE_SIZE) {
    // Evict oldest entry (first key in insertion order)
    const firstKey = renderCache.keys().next().value;
    if (firstKey !== undefined) {
      renderCache.delete(firstKey);
    }
  }
}

function streamingDelayMs(previousText: string, nextText: string): number {
  if (nextText.includes('\n')) return 0;
  const delta = Math.abs(nextText.length - previousText.length);
  if (delta <= STREAMING_SMALL_DELTA_CHARS) return STREAMING_FLUSH_FAST_MS;
  if (delta <= STREAMING_LARGE_DELTA_CHARS) return STREAMING_FLUSH_NORMAL_MS;
  return STREAMING_FLUSH_BURST_MS;
}

function setPlainRendererFallback(): void {
  rendererDegraded = true;
  defaultRenderer = (md: string) => md;
  renderersByWidth.clear();
  renderersByWidth.set(DEFAULT_RENDER_WIDTH, defaultRenderer);
  (initMarkdownRenderer as { _factory?: (w: number) => (md: string) => string })._factory = (_w: number) => (md: string) => md;
}

async function initMarkdownRenderer(): Promise<void> {
  if (rendererReady) return;
  if (rendererDegraded) {
    setPlainRendererFallback();
    rendererReady = true;
    return;
  }
  try {
    const chalk = (await import('chalk')).default;
    const { Marked } = await import('marked');
    const { markedTerminal } = await import('marked-terminal');

    // Create a renderer factory for a given width
    const createRenderer = (width: number): ((md: string) => string) => {
      const marked = new Marked(
        markedTerminal({
          code: chalk.hex('#F59E0B'),
          codespan: chalk.hex('#F59E0B').bold,
          firstHeading: chalk.hex('#8B5CF6').bold.underline,
          heading: chalk.hex('#3B82F6').bold,
          strong: chalk.bold,
          em: chalk.italic,
          del: chalk.dim.strikethrough,
          blockquote: chalk.hex('#71717A').italic,
          link: chalk.hex('#3B82F6').underline,
          href: chalk.hex('#3B82F6').underline,
          listitem: chalk.reset,
          table: chalk.reset,
          hr: chalk.dim,
          paragraph: chalk.reset,
          html: chalk.dim,
          width,
          reflowText: false,
          showSectionPrefix: false,
          unescape: true,
          emoji: true,
          tab: 2,
        })
      );

      return (md: string) => {
        try {
          const result = marked.parse(md, { async: false });
          return typeof result === 'string' ? result : String(result);
        } catch {
          setPlainRendererFallback();
          return md;
        }
      };
    };

    // Create default renderer once; width-specific renderers are created lazily.
    defaultRenderer = createRenderer(DEFAULT_RENDER_WIDTH);
    renderersByWidth.set(DEFAULT_RENDER_WIDTH, defaultRenderer);

    // Store the factory for creating width-specific renderers on demand
    (initMarkdownRenderer as { _factory?: (w: number) => (md: string) => string })._factory = createRenderer;
  } catch {
    setPlainRendererFallback();
  } finally {
    rendererReady = true;
  }
}

function getRendererForWidth(width: number): ((md: string) => string) | null {
  if (!rendererReady) return null;
  if (rendererDegraded) return defaultRenderer;

  let renderer = renderersByWidth.get(width);
  if (renderer) return renderer;

  // Create a new renderer for this width using the stored factory
  const factory = (initMarkdownRenderer as { _factory?: (w: number) => (md: string) => string })._factory;
  if (!factory) return defaultRenderer;

  renderer = factory(width);
  renderersByWidth.set(width, renderer);
  return renderer;
}

interface RenderSyncOptions {
  cache?: boolean;
}

// Synchronous render, with optional caching. Falls back to raw text on failure.
function renderSync(text: string, width: number, options?: RenderSyncOptions): string {
  if (!text) return '';
  const useCache = options?.cache ?? true;
  const safeText = sanitizeTerminalText(text);
  const preparedText = formatMarkdownTables(safeText, width);
  if (rendererDegraded) return colorizeOptaWord(preparedText);
  const key = cacheKey(preparedText, width);
  if (useCache) {
    const cached = renderCache.get(key);
    if (cached !== undefined) return cached;
  }

  // No renderer yet: fall back to raw text
  const renderer = getRendererForWidth(width);
  if (!renderer) return colorizeOptaWord(preparedText);

  try {
    const result = renderer(preparedText);
    // Strip trailing newlines that marked-terminal adds
    const cleaned = sanitizeTerminalText(result).replace(/\n+$/, '');
    const branded = colorizeOptaWord(cleaned);
    if (useCache) {
      evictIfNeeded();
      renderCache.set(key, branded);
    }
    return branded;
  } catch {
    setPlainRendererFallback();
    return colorizeOptaWord(preparedText);
  }
}

interface MarkdownTextProps {
  text: string;
  /** Whether this message is actively streaming tokens. */
  isStreaming?: boolean;
  /** Width for marked-terminal layout. Defaults to 100. */
  width?: number;
  /**
   * Optional preprocessed plain text used only for layout estimation in ScrollView.
   * This keeps virtualized height math aligned with the rendered markdown output.
   */
  estimatedText?: string;
}

export const MarkdownText = memo(function MarkdownText({
  text,
  isStreaming = false,
  width = 100,
  // Layout-only prop consumed by ScrollView's estimator via element props.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  estimatedText,
}: MarkdownTextProps) {
  const [rendered, setRendered] = useState(() => renderSync(text, width));
  const prevText = useRef(text);
  const prevWidth = useRef(width);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef(text);

  // Keep latestText always up to date
  latestText.current = text;

  const doRender = useCallback((t: string, w: number, cache = true) => {
    setRendered(renderSync(t, w, { cache }));
  }, []);

  // Initialize renderer on first mount
  useEffect(() => {
    let cancelled = false;
    initMarkdownRenderer().then(() => {
      if (!cancelled) {
        doRender(latestText.current, width);
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle text changes with streaming-aware debounce
  useEffect(() => {
    const previousText = prevText.current;
    const textChanged = text !== previousText;
    const widthChanged = width !== prevWidth.current;
    if (!textChanged && !widthChanged) return;
    prevText.current = text;
    prevWidth.current = width;

    if (widthChanged) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      doRender(text, width, !isStreaming);
      return;
    }

    if (!isStreaming) {
      // Not streaming: render immediately
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      doRender(text, width, true);
    } else {
      const delay = streamingDelayMs(previousText, text);
      if (delay === 0) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
        doRender(text, width, false);
        return;
      }

      // Streaming: adaptive debounce re-renders and skip cache churn.
      if (!debounceTimer.current) {
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;
          doRender(latestText.current, width, false);
        }, delay);
      }
    }
  }, [text, width, isStreaming, doRender]);

  // Force final render when streaming ends (isStreaming transitions true -> false)
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      // Streaming just ended: flush any pending debounce and force render
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      doRender(text, width, true);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, text, width, doRender]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  if (!text) return null;

  return <Text wrap="wrap">{rendered}</Text>;
});
