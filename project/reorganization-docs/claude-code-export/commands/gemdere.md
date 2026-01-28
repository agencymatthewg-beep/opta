# /gemdere - Gemini Deep Research Extractor

Extract and organize knowledge from Gemini Deep Research documents.

## Usage

```
/gemdere [file-path]    # Process specific file
/gemdere                # Process all unorganized files
/gemdere --list         # List files awaiting processing
```

## Process

### 1. Identify Unorganized Files

Check `Gemini Deep Research/` folder root for `.md` files not yet organized into subfolders:
- `Hardware & Platform Knowledge/`
- `Opta-Specific/`
- `Universal - Premium App Development/`

### 2. Extract Knowledge

For each file, identify and extract:
- **Core Concepts** - Architecture patterns, paradigms
- **Technical Data** - Values, formulas, constants
- **Code Patterns** - Reusable snippets
- **Tables** - Comparisons, mappings
- **Opta Applications** - Phase relevance

### 3. Generate GenUI Summary

Create visual HTML summary at `/tmp/genui_{topic}_research_summary_{timestamp}.html`:
- Dark theme with purple/cyan gradients
- Syntax-highlighted code blocks
- Visual diagrams and flowcharts
- Formula rendering
- Interactive sections

Open in browser automatically.

### 4. Organize File

Move processed file to appropriate subfolder:

| Content | Destination |
|---------|-------------|
| Platform (macOS, Windows, iOS) | `Hardware & Platform Knowledge/` |
| Opta architecture/features | `Opta-Specific/` |
| General patterns (UI, FFI) | `Universal - Premium App Development/` |

### 5. Report Results

```
## Gemini Deep Research Extraction Complete

**File:** {filename}
**Size:** {bytes} bytes | {lines} lines

### Extracted
- Core Concepts: {n}
- Code Patterns: {n}
- Tables: {n}
- References: {n}

### Output
GenUI: /tmp/genui_{topic}_research_summary_{timestamp}.html
Moved: {destination_path}

### Opta Relevance
- Phase 61: WGSL Shaders
- Phase 64: Animation System
```

## Full Specification

See `.claude/skills/gemdere/gemdere.md` for complete process documentation.
