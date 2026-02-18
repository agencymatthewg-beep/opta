"""Tests for RAG text chunking utilities (rag/chunker.py)."""

from __future__ import annotations

from opta_lmx.rag.chunker import Chunk, chunk_code, chunk_text


# ─── chunk_text ──────────────────────────────────────────────────────────────


class TestChunkText:
    def test_empty_text(self) -> None:
        assert chunk_text("") == []

    def test_whitespace_only(self) -> None:
        assert chunk_text("   \n  \n  ") == []

    def test_short_text_single_chunk(self) -> None:
        text = "Hello world"
        chunks = chunk_text(text, chunk_size=100)
        assert len(chunks) == 1
        assert chunks[0].text == text
        assert chunks[0].index == 0

    def test_chunk_positions(self) -> None:
        text = "Hello world"
        chunks = chunk_text(text, chunk_size=100)
        assert chunks[0].start_char == 0
        assert chunks[0].end_char == len(text)

    def test_splits_into_multiple_chunks(self) -> None:
        # Create text with ~200 chars per line, 10 lines = ~2000 chars
        # chunk_size=50 tokens = 200 chars
        lines = [f"Line {i}: " + "x" * 180 for i in range(10)]
        text = "\n".join(lines)
        chunks = chunk_text(text, chunk_size=50, chunk_overlap=0)
        assert len(chunks) > 1

    def test_preserves_all_content(self) -> None:
        lines = [f"Paragraph {i}" for i in range(5)]
        text = "\n".join(lines)
        chunks = chunk_text(text, chunk_size=10, chunk_overlap=0)
        # All paragraphs should appear somewhere in the chunks
        all_text = " ".join(c.text for c in chunks)
        for line in lines:
            assert line in all_text

    def test_overlap_parameter_accepted(self) -> None:
        # Use newline-separated lines so the separator-based chunker can split
        lines = [f"Line {i} with some padding text here" for i in range(30)]
        text = "\n".join(lines)
        chunks_no_overlap = chunk_text(text, chunk_size=20, chunk_overlap=0)
        chunks_with_overlap = chunk_text(text, chunk_size=20, chunk_overlap=5)
        assert len(chunks_no_overlap) >= 2
        assert len(chunks_with_overlap) >= 2
        # With overlap, we get at least as many chunks (often more)
        assert len(chunks_with_overlap) >= len(chunks_no_overlap)

    def test_indices_sequential(self) -> None:
        lines = [f"Line {i}: " + "x" * 200 for i in range(5)]
        text = "\n".join(lines)
        chunks = chunk_text(text, chunk_size=50, chunk_overlap=0)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_custom_separator(self) -> None:
        text = "Part A||Part B||Part C"
        chunks = chunk_text(text, chunk_size=100, separator="||")
        assert len(chunks) == 1
        assert "Part A" in chunks[0].text

    def test_chunk_dataclass_fields(self) -> None:
        chunk = Chunk(text="hello", index=0, start_char=0, end_char=5)
        assert chunk.text == "hello"
        assert chunk.index == 0
        assert chunk.start_char == 0
        assert chunk.end_char == 5


# ─── chunk_code ──────────────────────────────────────────────────────────────


class TestChunkCode:
    def test_empty_code(self) -> None:
        assert chunk_code("") == []

    def test_short_code_single_chunk(self) -> None:
        code = "def hello():\n    print('world')\n"
        chunks = chunk_code(code, chunk_size=100)
        assert len(chunks) == 1

    def test_splits_on_blank_lines(self) -> None:
        # Create functions separated by blank lines
        functions = []
        for i in range(5):
            func = f"def func_{i}():\n" + "\n".join(f"    line_{j} = {j}" for j in range(20))
            functions.append(func)
        code = "\n\n".join(functions)
        chunks = chunk_code(code, chunk_size=50, chunk_overlap=0)
        assert len(chunks) > 1

    def test_refines_oversized_chunks(self) -> None:
        # Create a single giant function (no blank lines) that exceeds 1.5x chunk size
        lines = [f"    line_{i} = {i}" for i in range(200)]
        code = "def giant():\n" + "\n".join(lines)
        chunks = chunk_code(code, chunk_size=30, chunk_overlap=0)
        # Should be re-split on single newlines
        chars_per_chunk = 30 * 4  # 120 chars
        for chunk in chunks:
            # No chunk should be wildly oversized after refinement
            assert len(chunk.text) < chars_per_chunk * 2

    def test_indices_sequential(self) -> None:
        code = "\n\n".join(f"def f{i}():\n    pass" for i in range(10))
        chunks = chunk_code(code, chunk_size=20, chunk_overlap=0)
        for i, chunk in enumerate(chunks):
            assert chunk.index == i
