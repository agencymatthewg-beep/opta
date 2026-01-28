# Gemini Deep Research Extractor (GemDeRe)

Extract, summarize, and organize knowledge from Gemini Deep Research documents.

## Purpose

This skill processes unorganized Gemini Deep Research `.md` files and:
1. **Extracts** key findings, data, stats, and technical patterns
2. **Creates** a GenUI HTML summary with visual explanations
3. **Organizes** the file by moving it to its correct location

## Invocation

```
/gemdere [file-path]           # Process a specific file
/gemdere                       # Process all unorganized files in research folder
/gemdere --list                # List unorganized files awaiting processing
```

## Process

### Step 1: Identify Target Files

Check the Gemini Deep Research folder for unorganized `.md` files:
```
/Users/matthewbyrden/Documents/Opta/Gemini Deep Research/
```

Unorganized files are those at the root level (not in subfolders). Organized structure:
- `Hardware & Platform Knowledge/` - Platform-specific docs (macOS, Windows, iOS, etc.)
- `Opta-Specific/` - Opta architecture and implementation research
- `Universal - Premium App Development/` - General premium app dev patterns

### Step 2: Read and Extract Knowledge

For each file, extract:

| Category | What to Extract |
|----------|-----------------|
| **Core Concepts** | Main architectural patterns, paradigm shifts |
| **Technical Data** | Specific values, formulas, constants |
| **Code Patterns** | Reusable code snippets with explanations |
| **Tables/Comparisons** | Syntax mappings, compatibility matrices |
| **Visual Concepts** | Diagrams, workflows, hierarchies |
| **Opta Applications** | How findings apply to Opta specifically |
| **References** | Citation count and categories |

### Step 3: Generate GenUI Summary

Create an HTML summary at:
```
/tmp/genui_{topic}_research_summary_{YYYYMMDD_HHMMSS}.html
```

Include these sections:
1. **Header** - Title, subtitle, source info
2. **Key Stats** - Sections, references, code patterns, key concepts
3. **Core Concepts** - Visual cards with explanations
4. **Technical Data** - Tables, formulas with LaTeX-style rendering
5. **Code Patterns** - Syntax-highlighted WGSL/Rust/Swift snippets
6. **Visual Diagrams** - Flowcharts, hierarchies, architectures
7. **Opta Applications** - Direct implementation mapping
8. **References** - Categorized citation summary

Use the GenUI dark theme with purple/cyan/green accent gradients.

### Step 4: Organize File

Move the processed file to appropriate subfolder:

| Content Type | Destination Folder |
|--------------|-------------------|
| Platform-specific (macOS, Windows, iOS, Android) | `Hardware & Platform Knowledge/` |
| Opta architecture, integration, specific features | `Opta-Specific/` |
| General patterns (UI, shaders, FFI, architecture) | `Universal - Premium App Development/` |

Rename if needed for clarity:
```bash
# Example
mv "3. WGSL for Premium UI Effects.md" "Universal - Premium App Development/WGSL-Premium-UI-Effects.md"
```

### Step 5: Update Index

If a `README.md` exists in the research folder, update it with:
- Document name and destination
- Key topics covered
- Processing date

## Output Format

```
## Gemini Deep Research Extraction Complete

**File:** {filename}
**Size:** {bytes} bytes | {lines} lines
**Destination:** {subfolder}

### Extracted Knowledge

- **Core Concepts:** {count}
- **Code Patterns:** {count}
- **Tables:** {count}
- **References:** {count}

### GenUI Summary

Opened: /tmp/genui_{topic}_research_summary_{timestamp}.html

### File Moved

From: {original_path}
To: {destination_path}
```

## Example

```
User: /gemdere "3. WGSL for Premium UI Effects.md"

Output:
- Reads 37,562 bytes of WGSL research
- Extracts 8 major sections, 12 code patterns, 37 references
- Creates visual GenUI with:
  - Bind group hierarchy diagram
  - GLSL→WGSL syntax comparison table
  - Fresnel/Beer-Lambert formulas
  - SDF primitive gallery
  - Compute shader patterns
  - Dual Kawase blur chain visualization
- Opens in browser
- Moves to "Universal - Premium App Development/WGSL-Premium-UI-Effects.md"
```

## Batch Processing

When invoked without arguments, process all unorganized files:

```
/gemdere

Processing 3 unorganized research documents...

1. wgpu iOS_macOS SwiftUI Integration.md
   → Hardware & Platform Knowledge/wgpu-SwiftUI-Integration.md

2. UniFFI_ Rust to Swift_Kotlin Bindings.md
   → Universal - Premium App Development/UniFFI-Rust-Bindings.md

3. WGSL for Premium UI Effects.md
   → Universal - Premium App Development/WGSL-Premium-UI-Effects.md

Created 3 GenUI summaries. All files organized.
```

## Integration with Opta Roadmap

After extraction, note which Opta phases benefit from the research:

| Research Topic | Relevant Phases |
|----------------|-----------------|
| wgpu/SwiftUI | Phase 60, 62 |
| UniFFI bindings | Phase 59, 63 |
| WGSL shaders | Phase 61, 64 |
| Platform security | Phase 62, 67 |

This connects research directly to implementation planning.
