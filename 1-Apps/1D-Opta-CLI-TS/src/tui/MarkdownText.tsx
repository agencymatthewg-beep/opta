import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Text } from 'ink';

/** Debounce interval (ms) for re-rendering during streaming. */
const STREAMING_DEBOUNCE_MS = 150;

/** Maximum cache entries before evicting oldest. */
const MAX_CACHE_SIZE = 200;

// Module-level render cache: key = `${width}:${text}`, value = rendered ANSI string.
const renderCache = new Map<string, string>();

// Lazy-loaded renderers keyed by width.
const renderersByWidth = new Map<number, (md: string) => string>();
let defaultRenderer: ((md: string) => string) | null = null;
let rendererReady = false;

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

async function initMarkdownRenderer(): Promise<void> {
  if (rendererReady) return;

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
        showSectionPrefix: true,
        unescape: true,
        emoji: true,
        tab: 2,
      })
    );

    return (md: string) => {
      const result = marked.parse(md, { async: false });
      return typeof result === 'string' ? result : String(result);
    };
  };

  // Create default renderer (width 100)
  defaultRenderer = createRenderer(100);
  renderersByWidth.set(100, defaultRenderer);

  // Store the factory for creating width-specific renderers on demand
  (initMarkdownRenderer as { _factory?: (w: number) => (md: string) => string })._factory = createRenderer;

  rendererReady = true;
}

function getRendererForWidth(width: number): ((md: string) => string) | null {
  if (!rendererReady) return null;

  let renderer = renderersByWidth.get(width);
  if (renderer) return renderer;

  // Create a new renderer for this width using the stored factory
  const factory = (initMarkdownRenderer as { _factory?: (w: number) => (md: string) => string })._factory;
  if (!factory) return defaultRenderer;

  renderer = factory(width);
  renderersByWidth.set(width, renderer);
  return renderer;
}

// Synchronous render using cached renderer, falls back to raw text
function renderSync(text: string, width: number): string {
  if (!text) return '';

  // Check cache first
  const key = cacheKey(text, width);
  const cached = renderCache.get(key);
  if (cached !== undefined) return cached;

  // No renderer yet: fall back to raw text
  const renderer = getRendererForWidth(width);
  if (!renderer) return text;

  try {
    const result = renderer(text);
    // Strip trailing newlines that marked-terminal adds
    const cleaned = result.replace(/\n+$/, '');
    // Cache the result
    evictIfNeeded();
    renderCache.set(key, cleaned);
    return cleaned;
  } catch {
    return text;
  }
}

interface MarkdownTextProps {
  text: string;
  /** Whether this message is actively streaming tokens. */
  isStreaming?: boolean;
  /** Width for marked-terminal layout. Defaults to 100. */
  width?: number;
}

export const MarkdownText = memo(function MarkdownText({
  text,
  isStreaming = false,
  width = 100,
}: MarkdownTextProps) {
  const [rendered, setRendered] = useState(() => renderSync(text, width));
  const prevText = useRef(text);
  const prevWidth = useRef(width);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef(text);

  // Keep latestText always up to date
  latestText.current = text;

  const doRender = useCallback((t: string, w: number) => {
    setRendered(renderSync(t, w));
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
    const textChanged = text !== prevText.current;
    const widthChanged = width !== prevWidth.current;
    if (!textChanged && !widthChanged) return;
    prevText.current = text;
    prevWidth.current = width;

    if (!isStreaming) {
      // Not streaming: render immediately
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      doRender(text, width);
    } else {
      // Streaming: debounce re-renders
      if (!debounceTimer.current) {
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null;
          doRender(latestText.current, width);
        }, STREAMING_DEBOUNCE_MS);
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
      doRender(text, width);
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
