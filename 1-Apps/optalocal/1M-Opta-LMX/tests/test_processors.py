"""Tests for RAG document processors (rag/processors.py)."""

from __future__ import annotations

from pathlib import Path

import pytest

from opta_lmx.rag.processors import (
    detect_processor,
    process_code,
    process_content,
    process_file,
    process_html,
    process_markdown,
    process_text,
)

# ─── detect_processor ────────────────────────────────────────────────────────


class TestDetectProcessor:
    def test_markdown_extensions(self) -> None:
        assert detect_processor("README.md") == "markdown"
        assert detect_processor("notes.markdown") == "markdown"

    def test_html_extensions(self) -> None:
        assert detect_processor("page.html") == "html"
        assert detect_processor("index.htm") == "html"

    def test_code_extensions(self) -> None:
        assert detect_processor("main.py") == "code"
        assert detect_processor("app.ts") == "code"
        assert detect_processor("lib.rs") == "code"
        assert detect_processor("go.go") == "code"
        assert detect_processor("Main.java") == "code"
        assert detect_processor("view.swift") == "code"
        assert detect_processor("config.yaml") == "code"
        assert detect_processor("data.json") == "code"

    def test_text_extensions(self) -> None:
        assert detect_processor("notes.txt") == "text"
        assert detect_processor("data.csv") == "text"
        assert detect_processor("app.log") == "text"

    def test_pdf_extension(self) -> None:
        assert detect_processor("paper.pdf") == "pdf"

    def test_unknown_extension_defaults_to_text(self) -> None:
        assert detect_processor("file.xyz") == "text"
        assert detect_processor("noext") == "text"

    def test_case_insensitive(self) -> None:
        assert detect_processor("README.MD") == "markdown"
        assert detect_processor("page.HTML") == "html"

    def test_path_with_directory(self) -> None:
        assert detect_processor("/home/user/docs/README.md") == "markdown"


# ─── process_markdown ────────────────────────────────────────────────────────


class TestProcessMarkdown:
    def test_strips_frontmatter(self) -> None:
        content = "---\ntitle: Test\ndate: 2024\n---\n\n# Hello World"
        result = process_markdown(content)
        assert "title: Test" not in result.text
        assert "Hello World" in result.text

    def test_removes_images(self) -> None:
        content = "Text before ![alt](image.png) text after"
        result = process_markdown(content)
        assert "![alt]" not in result.text
        assert "image.png" not in result.text
        assert "Text before" in result.text

    def test_converts_links_to_display_text(self) -> None:
        content = "Check [this link](https://example.com) out"
        result = process_markdown(content)
        assert "this link" in result.text
        assert "https://example.com" not in result.text

    def test_strips_inline_html(self) -> None:
        content = "Hello <strong>bold</strong> world"
        result = process_markdown(content)
        assert "<strong>" not in result.text
        assert "bold" in result.text

    def test_collapses_whitespace(self) -> None:
        content = "Line 1\n\n\n\n\n\nLine 2"
        result = process_markdown(content)
        assert "\n\n\n" not in result.text

    def test_metadata(self) -> None:
        result = process_markdown("Hello", source="test.md")
        assert result.processor == "markdown"
        assert result.source == "test.md"
        assert result.metadata["format"] == "markdown"
        assert result.metadata["char_count"] == 5


# ─── process_html ────────────────────────────────────────────────────────────


class TestProcessHtml:
    def test_strips_tags(self) -> None:
        content = "<p>Hello <b>world</b></p>"
        result = process_html(content)
        assert "<p>" not in result.text
        assert "<b>" not in result.text
        assert "Hello" in result.text
        assert "world" in result.text

    def test_removes_scripts(self) -> None:
        content = "<p>Content</p><script>alert('xss')</script><p>More</p>"
        result = process_html(content)
        assert "alert" not in result.text
        assert "Content" in result.text
        assert "More" in result.text

    def test_removes_styles(self) -> None:
        content = "<style>body { color: red; }</style><p>Text</p>"
        result = process_html(content)
        assert "color: red" not in result.text
        assert "Text" in result.text

    def test_removes_comments(self) -> None:
        content = "<!-- comment -->Visible"
        result = process_html(content)
        assert "comment" not in result.text
        assert "Visible" in result.text

    def test_decodes_entities(self) -> None:
        content = "<p>5 &gt; 3 &amp; 2 &lt; 4</p>"
        result = process_html(content)
        assert "5 > 3 & 2 < 4" in result.text

    def test_metadata(self) -> None:
        result = process_html("<p>Test</p>", source="page.html")
        assert result.processor == "html"
        assert result.metadata["format"] == "html"


# ─── process_code ────────────────────────────────────────────────────────────


class TestProcessCode:
    def test_preserves_code(self) -> None:
        code = "def hello():\n    print('world')\n"
        result = process_code(code, language="py")
        assert result.text == code

    def test_metadata(self) -> None:
        code = "line1\nline2\n\nline4\n"
        result = process_code(code, source="main.py", language="py")
        assert result.processor == "code"
        assert result.metadata["language"] == "py"
        assert result.metadata["line_count"] == 5
        assert result.metadata["non_empty_lines"] == 3
        assert result.metadata["format"] == "code"


# ─── process_text ────────────────────────────────────────────────────────────


class TestProcessText:
    def test_passthrough(self) -> None:
        result = process_text("Raw content", source="file.txt")
        assert result.text == "Raw content"
        assert result.processor == "text"
        assert result.metadata["char_count"] == 11


# ─── process_content ─────────────────────────────────────────────────────────


class TestProcessContent:
    def test_auto_detect_markdown(self) -> None:
        result = process_content("# Title\nBody", filename="doc.md")
        assert result.processor == "markdown"

    def test_auto_detect_html(self) -> None:
        result = process_content("<p>Body</p>", filename="page.html")
        assert result.processor == "html"

    def test_auto_detect_code(self) -> None:
        result = process_content("def main(): pass", filename="main.py")
        assert result.processor == "code"

    def test_auto_detect_text(self) -> None:
        result = process_content("Plain text", filename="notes.txt")
        assert result.processor == "text"

    def test_override_processor(self) -> None:
        result = process_content("# Title\nBody", filename="doc.txt", processor_type="markdown")
        assert result.processor == "markdown"

    def test_unknown_extension_defaults_to_text(self) -> None:
        result = process_content("data", filename="file.xyz")
        assert result.processor == "text"

    def test_no_filename(self) -> None:
        result = process_content("data")
        assert result.processor == "text"


# ─── process_file ────────────────────────────────────────────────────────────


class TestProcessFile:
    def test_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError):
            process_file(Path("/nonexistent/file.txt"))

    def test_reads_text_file(self, tmp_path: Path) -> None:
        f = tmp_path / "test.txt"
        f.write_text("Hello world")
        result = process_file(f)
        assert result.text == "Hello world"
        assert result.processor == "text"

    def test_reads_markdown_file(self, tmp_path: Path) -> None:
        f = tmp_path / "doc.md"
        f.write_text("---\ntitle: Test\n---\n\n# Heading\nBody text")
        result = process_file(f)
        assert result.processor == "markdown"
        assert "Heading" in result.text
        assert "title: Test" not in result.text

    def test_reads_html_file(self, tmp_path: Path) -> None:
        f = tmp_path / "page.html"
        f.write_text("<html><body><p>Content</p></body></html>")
        result = process_file(f)
        assert result.processor == "html"
        assert "Content" in result.text
        assert "<p>" not in result.text

    def test_reads_code_file(self, tmp_path: Path) -> None:
        f = tmp_path / "main.py"
        f.write_text("def foo():\n    pass\n")
        result = process_file(f)
        assert result.processor == "code"
        assert result.metadata["language"] == "py"

    def test_handles_latin1_encoding(self, tmp_path: Path) -> None:
        f = tmp_path / "legacy.txt"
        f.write_bytes(b"caf\xe9")  # latin-1 encoded 'café'
        result = process_file(f)
        assert "caf" in result.text
