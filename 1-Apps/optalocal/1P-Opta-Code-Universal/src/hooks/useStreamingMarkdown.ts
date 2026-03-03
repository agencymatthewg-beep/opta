import { useState, useEffect } from "react";

/**
 * A hook that buffers rapid markdown token streams to prevent excessive
 * React re-renders and DOM thrashing during high-throughput local inference.
 */
export function useStreamingMarkdown(
  rawContent: string,
  isStreaming: boolean,
  delayMs = 50,
) {
  const [debouncedContent, setDebouncedContent] = useState(rawContent);

  useEffect(() => {
    if (!isStreaming) {
      // If we stop streaming, immediately snap to the final content
      setDebouncedContent(rawContent);
      return;
    }

    const handler = setTimeout(() => {
      setDebouncedContent(rawContent);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [rawContent, isStreaming, delayMs]);

  return debouncedContent;
}
