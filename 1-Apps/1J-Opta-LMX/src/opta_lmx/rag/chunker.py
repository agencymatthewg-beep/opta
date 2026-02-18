"""Text chunking utilities for RAG document ingestion.

Provides token-aware chunking with configurable overlap for
splitting documents into embedding-sized pieces.
"""

from __future__ import annotations

import logging
import re
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


_HEADER_RE = re.compile(r"^(#{1,2})\s+(.+)$", re.MULTILINE)


def chunk_markdown(
    text: str,
    max_chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """Split markdown at H1/H2 header boundaries.

    Each chunk contains one H2 section with any parent H1 prepended
    as context. Sections exceeding max_chunk_size (in tokens, ~4 chars/token)
    are sub-split using chunk_text().

    Args:
        text: Markdown text to chunk.
        max_chunk_size: Target tokens per chunk.
        chunk_overlap: Token overlap for sub-splitting large sections.

    Returns:
        List of Chunk objects with position metadata.
    """
    if not text.strip():
        return []

    chars_per_chunk = max_chunk_size * 4
    parent_h1 = ""
    sections: list[tuple[str, int]] = []  # (section_text, start_char)

    # Find all H1/H2 header positions
    headers = list(_HEADER_RE.finditer(text))

    if not headers:
        # No headers — return as single chunk
        return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

    # Extract H1 if present at the start (before first H2)
    first_header = headers[0]
    if first_header.group(1) == "#":
        parent_h1 = first_header.group(0)

    # Build sections: each H2 (or H1 acting as section) starts a new chunk
    for i, match in enumerate(headers):
        level = match.group(1)
        if level == "#":
            parent_h1 = match.group(0)
            # If this H1 is not followed by an H2, it becomes its own section
            next_idx = i + 1
            if next_idx >= len(headers):
                # H1 is the last header — everything after it is one section
                section_text = text[match.start():].strip()
                sections.append((section_text, match.start()))
            elif headers[next_idx].group(1) == "#":
                # Next header is also H1 — this H1's content is a section
                section_text = text[match.start():headers[next_idx].start()].strip()
                if section_text:
                    sections.append((section_text, match.start()))
            # If next is H2, the H1 content before it will be included with the H2
            continue

        # H2 header — extract content until next H1/H2
        end_pos = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        section_text = text[match.start():end_pos].strip()
        if section_text:
            # Prepend parent H1 as context (if exists and not already in section)
            if parent_h1 and not section_text.startswith(parent_h1):
                section_text = parent_h1 + "\n\n" + section_text
            sections.append((section_text, match.start()))

    if not sections:
        return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

    # Build chunks, sub-splitting oversized sections
    chunks: list[Chunk] = []
    for section_text, start_char in sections:
        if len(section_text) > chars_per_chunk * 1.5:
            # Sub-split but preserve header in each sub-chunk
            lines = section_text.split("\n")
            header_line = lines[0] if lines else ""
            body = "\n".join(lines[1:]).strip()
            sub_chunks = chunk_text(body, max_chunk_size, chunk_overlap)
            for sc in sub_chunks:
                full_text = header_line + "\n" + sc.text if header_line else sc.text
                chunks.append(Chunk(
                    text=full_text,
                    index=len(chunks),
                    start_char=start_char + sc.start_char,
                    end_char=start_char + sc.end_char,
                ))
        else:
            chunks.append(Chunk(
                text=section_text,
                index=len(chunks),
                start_char=start_char,
                end_char=start_char + len(section_text),
            ))

    return chunks
