"""Text chunking utilities for RAG document ingestion.

Provides token-aware chunking with configurable overlap for
splitting documents into embedding-sized pieces.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A text chunk with position metadata."""

    text: str
    index: int
    start_char: int
    end_char: int


def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
    separator: str = "\n",
) -> list[Chunk]:
    """Split text into overlapping chunks by token estimate.

    Uses ~4 chars/token heuristic for chunk sizing (consistent with
    the token estimation used in embeddings endpoint). Splits on
    separator boundaries when possible to preserve semantic units.

    Args:
        text: Input text to chunk.
        chunk_size: Target tokens per chunk.
        chunk_overlap: Token overlap between consecutive chunks.
        separator: Preferred split boundary (default: newline).

    Returns:
        List of Chunk objects with position metadata.
    """
    if not text.strip():
        return []

    # Convert token targets to approximate char counts
    chars_per_chunk = chunk_size * 4
    chars_overlap = chunk_overlap * 4

    # Split on separator first
    segments = text.split(separator)
    chunks: list[Chunk] = []
    current_parts: list[str] = []
    current_len = 0
    chunk_start = 0
    char_pos = 0

    for i, segment in enumerate(segments):
        seg_len = len(segment) + (len(separator) if i < len(segments) - 1 else 0)

        if current_len + seg_len > chars_per_chunk and current_parts:
            # Emit current chunk
            chunk_text_str = separator.join(current_parts)
            chunks.append(Chunk(
                text=chunk_text_str,
                index=len(chunks),
                start_char=chunk_start,
                end_char=chunk_start + len(chunk_text_str),
            ))

            # Calculate overlap: keep trailing parts that fit within overlap
            overlap_parts: list[str] = []
            overlap_len = 0
            for part in reversed(current_parts):
                if overlap_len + len(part) > chars_overlap:
                    break
                overlap_parts.insert(0, part)
                overlap_len += len(part) + len(separator)

            if overlap_parts:
                current_parts = overlap_parts
                current_len = sum(len(p) + len(separator) for p in current_parts)
                chunk_start = char_pos - current_len
            else:
                current_parts = []
                current_len = 0
                chunk_start = char_pos

        current_parts.append(segment)
        current_len += seg_len
        char_pos += seg_len

    # Emit remaining
    if current_parts:
        chunk_text_str = separator.join(current_parts)
        if chunk_text_str.strip():
            chunks.append(Chunk(
                text=chunk_text_str,
                index=len(chunks),
                start_char=chunk_start,
                end_char=chunk_start + len(chunk_text_str),
            ))

    return chunks


def chunk_code(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """Chunk source code, preferring function/class boundaries.

    Splits on double-newlines first (function/class boundaries),
    then falls back to single newlines for large blocks.
    """
    # Try splitting on double newlines (blank lines = function boundaries)
    chunks = chunk_text(text, chunk_size, chunk_overlap, separator="\n\n")

    # If any chunk is still too large, re-split on single newlines
    refined: list[Chunk] = []
    chars_per_chunk = chunk_size * 4
    for chunk in chunks:
        if len(chunk.text) > chars_per_chunk * 1.5:
            sub_chunks = chunk_text(
                chunk.text, chunk_size, chunk_overlap, separator="\n",
            )
            for sc in sub_chunks:
                sc.start_char += chunk.start_char
                sc.end_char += chunk.start_char
                sc.index = len(refined)
                refined.append(sc)
        else:
            chunk.index = len(refined)
            refined.append(chunk)

    return refined
