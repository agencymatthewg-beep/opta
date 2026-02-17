"""Document processors for RAG ingestion — convert files to plain text.

Supports PDF, Markdown, HTML, and source code files. Each processor
extracts text content and returns it with source metadata for the
chunking pipeline.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# File extensions mapped to processor types
_EXTENSION_MAP: dict[str, str] = {
    ".pdf": "pdf",
    ".md": "markdown",
    ".markdown": "markdown",
    ".html": "html",
    ".htm": "html",
    ".py": "code",
    ".ts": "code",
    ".tsx": "code",
    ".js": "code",
    ".jsx": "code",
    ".rs": "code",
    ".go": "code",
    ".java": "code",
    ".swift": "code",
    ".c": "code",
    ".cpp": "code",
    ".h": "code",
    ".rb": "code",
    ".sh": "code",
    ".yaml": "code",
    ".yml": "code",
    ".toml": "code",
    ".json": "code",
    ".txt": "text",
    ".csv": "text",
    ".log": "text",
}

# Regex patterns
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_MARKDOWN_FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
_MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_WHITESPACE_COLLAPSE_RE = re.compile(r"\n{3,}")


@dataclass
class ProcessedDocument:
    """Result of processing a file into plain text."""

    text: str
    metadata: dict[str, Any] = field(default_factory=dict)
    source: str = ""
    processor: str = ""


def detect_processor(filename: str) -> str:
    """Detect the appropriate processor type from a filename.

    Args:
        filename: File name or path.

    Returns:
        Processor type string: "pdf", "markdown", "html", "code", or "text".
    """
    ext = Path(filename).suffix.lower()
    return _EXTENSION_MAP.get(ext, "text")


def process_file(path: Path) -> ProcessedDocument:
    """Process a file from disk into plain text.

    Args:
        path: Path to the file.

    Returns:
        ProcessedDocument with extracted text and metadata.

    Raises:
        FileNotFoundError: If the file doesn't exist.
        ValueError: If the file type is unsupported or processing fails.
    """
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    processor_type = detect_processor(path.name)

    if processor_type == "pdf":
        return process_pdf(path)

    # Read text-based files
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")

    if processor_type == "markdown":
        return process_markdown(content, source=str(path))
    if processor_type == "html":
        return process_html(content, source=str(path))
    if processor_type == "code":
        return process_code(content, source=str(path), language=path.suffix.lstrip("."))

    return ProcessedDocument(
        text=content,
        metadata={"filename": path.name, "size_bytes": path.stat().st_size},
        source=str(path),
        processor="text",
    )


def process_text(content: str, source: str = "") -> ProcessedDocument:
    """Process raw text (passthrough with metadata)."""
    return ProcessedDocument(
        text=content,
        metadata={"char_count": len(content)},
        source=source,
        processor="text",
    )


def process_pdf(path: Path) -> ProcessedDocument:
    """Extract text from a PDF file.

    Requires pypdf (optional dependency). Falls back to empty text
    with a warning if pypdf is not installed.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("pypdf_not_installed_cannot_process_pdf")
        return ProcessedDocument(
            text="",
            metadata={"error": "pypdf not installed", "filename": path.name},
            source=str(path),
            processor="pdf",
        )

    try:
        reader = PdfReader(str(path))
        pages: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)

        full_text = "\n\n".join(pages)
        return ProcessedDocument(
            text=full_text,
            metadata={
                "filename": path.name,
                "page_count": len(reader.pages),
                "char_count": len(full_text),
            },
            source=str(path),
            processor="pdf",
        )
    except Exception as e:
        logger.error("pdf_processing_failed", extra={
            "path": str(path), "error": str(e),
        })
        return ProcessedDocument(
            text="",
            metadata={"error": str(e), "filename": path.name},
            source=str(path),
            processor="pdf",
        )


def process_markdown(content: str, source: str = "") -> ProcessedDocument:
    """Process Markdown into clean text for embedding.

    Strips YAML frontmatter, image references, and converts links
    to their display text. Preserves headings and structure.
    """
    text = content

    # Strip frontmatter
    text = _MARKDOWN_FRONTMATTER_RE.sub("", text)

    # Remove image references (images can't be embedded as text)
    text = _MARKDOWN_IMAGE_RE.sub("", text)

    # Convert links to display text
    text = _MARKDOWN_LINK_RE.sub(r"\1", text)

    # Strip HTML tags that might be in the markdown
    text = _HTML_TAG_RE.sub("", text)

    # Collapse excessive whitespace
    text = _WHITESPACE_COLLAPSE_RE.sub("\n\n", text)
    text = text.strip()

    return ProcessedDocument(
        text=text,
        metadata={"char_count": len(text), "format": "markdown"},
        source=source,
        processor="markdown",
    )


def process_html(content: str, source: str = "") -> ProcessedDocument:
    """Extract readable text from HTML content.

    Removes tags, scripts, styles, and comments. Decodes HTML entities.
    """
    text = content

    # Remove comments
    text = _HTML_COMMENT_RE.sub("", text)

    # Remove script and style blocks
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", text, flags=re.DOTALL | re.IGNORECASE)

    # Remove tags
    text = _HTML_TAG_RE.sub(" ", text)

    # Decode entities
    text = html.unescape(text)

    # Collapse whitespace
    text = _WHITESPACE_COLLAPSE_RE.sub("\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = text.strip()

    return ProcessedDocument(
        text=text,
        metadata={"char_count": len(text), "format": "html"},
        source=source,
        processor="html",
    )


def process_code(
    content: str,
    source: str = "",
    language: str = "",
) -> ProcessedDocument:
    """Process source code for embedding.

    Preserves the code as-is (code structure is valuable for search)
    but adds language metadata for downstream processing.
    """
    lines = content.split("\n")
    non_empty = [l for l in lines if l.strip()]

    return ProcessedDocument(
        text=content,
        metadata={
            "char_count": len(content),
            "line_count": len(lines),
            "non_empty_lines": len(non_empty),
            "language": language,
            "format": "code",
        },
        source=source,
        processor="code",
    )


def process_content(
    content: str,
    filename: str = "",
    processor_type: str | None = None,
) -> ProcessedDocument:
    """Process content string using auto-detected or specified processor.

    Args:
        content: Raw content to process.
        filename: Original filename (used for type detection).
        processor_type: Override auto-detection ("text", "markdown", "html", "code").

    Returns:
        ProcessedDocument with extracted text.
    """
    ptype = processor_type or detect_processor(filename)

    if ptype == "markdown":
        return process_markdown(content, source=filename)
    if ptype == "html":
        return process_html(content, source=filename)
    if ptype == "code":
        ext = Path(filename).suffix.lstrip(".") if filename else ""
        return process_code(content, source=filename, language=ext)

    return process_text(content, source=filename)
