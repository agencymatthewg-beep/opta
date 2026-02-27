'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface UseScrollAnchorReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  showScrollButton: boolean;
  scrollToBottom: (smooth?: boolean) => void;
  autoScroll: () => void;
}

/**
 * Auto-scroll hook for streaming chat using IntersectionObserver.
 *
 * Tracks whether the user is at the bottom of the message list via an
 * invisible anchor element. Auto-scrolls during streaming only when
 * the user hasn't scrolled up. Shows a "scroll to bottom" button when
 * the anchor is not visible.
 */
export function useScrollAnchor(): UseScrollAnchorReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track if user is at bottom via IntersectionObserver
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsAtBottom(entry.isIntersecting);
          setShowScrollButton(!entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom (smooth or instant)
  const scrollToBottom = useCallback((smooth = true) => {
    anchorRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);

  // Auto-scroll when at bottom and content changes (for streaming)
  const autoScroll = useCallback(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        anchorRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    }
  }, [isAtBottom]);

  return {
    containerRef,
    anchorRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
    autoScroll,
  };
}
