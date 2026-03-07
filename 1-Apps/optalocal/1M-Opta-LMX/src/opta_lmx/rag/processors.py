"""Document processors for RAG ingestion — convert files to plain text.

Supports PDF, Markdown, HTML, and source code files. Each processor
extracts text content and returns it with source metadata for the
chunking pipeline.
"""

from __future__ import annotations

import hashlib
import html
import importlib
import logging
import re
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol, cast

try:
    import yaml as _yaml

    _YAML_AVAILABLE = True
except ImportError:
    _yaml = None  # type: ignore[assignment]
    _YAML_AVAILABLE = False

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
_HTML_SCRIPT_STYLE_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_SPACES_COLLAPSE_RE = re.compile(r"[ \t]+")


class _PdfPage(Protocol):
    """Structural type for pypdf page objects."""

    def extract_text(self) -> str | None:
        """Extract text from a page."""


class _PdfReaderLike(Protocol):
    """Structural type for pypdf PdfReader."""

    pages: Sequence[_PdfPage]


class _PyPdfModule(Protocol):
    """Structural type for the optional pypdf module."""

    PdfReader: Callable[[str], _PdfReaderLike]


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


def _file_stats(path: Path) -> dict[str, Any]:
    """Return file system metadata for a path."""
    try:
        stat = path.stat()
        raw = path.read_bytes()
        return {
            "file_path": str(path),
            "filename": path.name,
            "size_bytes": stat.st_size,
            "file_modified_at": stat.st_mtime,
            "file_hash": hashlib.sha256(raw).hexdigest()[:12],
        }
    except OSError:
        return {"file_path": str(path), "filename": path.name}


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
    stats = _file_stats(path)

    if processor_type == "pdf":
        doc = process_pdf(path)
        doc.metadata.update(stats)
        return doc

    # Read text-based files
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = path.read_text(encoding="latin-1")

    if processor_type == "markdown":
        doc = process_markdown(content, source=str(path))
        doc.metadata.update(stats)
        return doc
    if processor_type == "html":
        doc = process_html(content, source=str(path))
        doc.metadata.update(stats)
        return doc
    if processor_type == "code":
        doc = process_code(content, source=str(path), language=path.suffix.lstrip("."))
        doc.metadata.update(stats)
        return doc

    return ProcessedDocument(
        text=content,
        metadata=stats,
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
        module = cast(_PyPdfModule, importlib.import_module("pypdf"))
        pdf_reader_cls = module.PdfReader
    except ImportError:
        logger.warning("pypdf_not_installed_cannot_process_pdf")
        return ProcessedDocument(
            text="",
            metadata={"error": "pypdf not installed", "filename": path.name},
            source=str(path),
            processor="pdf",
        )

    try:
        reader = pdf_reader_cls(str(path))
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
        logger.error(
            "pdf_processing_failed",
            extra={
                "path": str(path),
                "error": str(e),
            },
        )
        return ProcessedDocument(
            text="",
            metadata={"error": str(e), "filename": path.name},
            source=str(path),
            processor="pdf",
        )


def _parse_frontmatter(content: str) -> dict[str, Any]:
    """Extract YAML frontmatter fields as a metadata dict.

    Returns an empty dict if frontmatter is absent, malformed, or yaml is not installed.
    """
    if not _YAML_AVAILABLE or _yaml is None:
        return {}
    match = _MARKDOWN_FRONTMATTER_RE.match(content)
    if not match:
        return {}
    raw_yaml = match.group(0)
    # Strip the --- delimiters to get the YAML body
    body = re.sub(r"^---\s*\n|---\s*$", "", raw_yaml, flags=re.MULTILINE).strip()
    try:
        parsed = _yaml.safe_load(body)
        if not isinstance(parsed, dict):
            return {}
        # Normalise known fields; preserve others under their original keys
        return {
            "fm_type": parsed.get("type", ""),
            "fm_project": parsed.get("project", ""),
            "fm_tags": parsed.get("tags", []),
            "fm_summary": parsed.get("summary", ""),
            "fm_ai_read_when": parsed.get("ai-read-when", []),
            "fm_last_updated": parsed.get("last-updated", ""),
            "fm_status": parsed.get("status", ""),
        }
    except Exception:
        return {}


def process_markdown(content: str, source: str = "") -> ProcessedDocument:
    """Process Markdown into clean text for embedding.

    Strips YAML frontmatter from the indexed text but preserves its fields
    as document metadata (type, project, tags, summary, ai-read-when, etc.).
    Also strips image references and converts links to display text.
    """
    # Extract frontmatter metadata BEFORE stripping it from text
    fm_meta = _parse_frontmatter(content)

    text = content

    # Strip frontmatter from indexed text (keep clean prose)
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

    metadata: dict[str, Any] = {"char_count": len(text), "format": "markdown"}
    metadata.update(fm_meta)

    return ProcessedDocument(
        text=text,
        metadata=metadata,
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
    text = _HTML_SCRIPT_STYLE_RE.sub("", text)

    # Remove tags
    text = _HTML_TAG_RE.sub(" ", text)

    # Decode entities
    text = html.unescape(text)

    # Collapse whitespace
    text = _WHITESPACE_COLLAPSE_RE.sub("\n\n", text)
    text = _SPACES_COLLAPSE_RE.sub(" ", text)
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
    non_empty = [line for line in lines if line.strip()]

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
