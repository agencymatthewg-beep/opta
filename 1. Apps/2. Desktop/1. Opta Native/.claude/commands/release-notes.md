# /release-notes - Generate Release Notes

Generate comprehensive release notes for a version or phase using GenUI output.

## Usage

```
/release-notes              # Generate for current phase
/release-notes v5.0         # Generate for specific version
/release-notes phase:39     # Generate for specific phase
/release-notes branch       # Generate from branch commits vs main
```

## Instructions

1. Determine scope (current phase, version, or branch)
2. Gather changes from:
   - Git commits and their messages
   - ROADMAP.md phase descriptions
   - STATE.md progress notes
   - Actual code changes (git diff)
3. Categorize changes by type
4. Generate GenUI HTML report

## Output Format

**Uses GenUI** - Generates an HTML report saved to `/tmp/genui_release_{version}_{timestamp}.html` and opens in browser.

The GenUI report includes:

### Header Section
- Version badge and release date
- One-line summary
- Key stats (commits, files changed, contributors)

### Highlights Section
- **New Features Card**: Major additions with descriptions
- **Improvements Card**: Enhancements to existing features
- **Bug Fixes Card**: Issues resolved

### Breaking Changes Section (if any)
- Red alert cards for breaking changes
- Migration guidance for each

### Technical Details Section
- **Files Changed Table**: Grouped by directory
- **Dependencies Updated**: Any package changes
- **Performance Notes**: Any performance-related changes

### Screenshots/Demos Section (if applicable)
- Placeholder for visual changes
- Before/after comparisons

### Credits Section
- Contributors list
- Co-authored commits

After generating the HTML report, output a brief console summary:

```
Release notes generated. Report: /tmp/genui_release_{version}_{timestamp}.html

Version: {version} | Date: {date}
Features: X | Improvements: Y | Fixes: Z | Breaking: W
```

## Change Categories

| Category | Description | Icon |
|----------|-------------|------|
| `feat` | New features | Green badge |
| `improve` | Enhancements | Blue badge |
| `fix` | Bug fixes | Yellow badge |
| `perf` | Performance | Purple badge |
| `breaking` | Breaking changes | Red badge |
| `docs` | Documentation | Gray badge |
| `refactor` | Code refactoring | Teal badge |

## Opta-Specific Sections

For Opta releases, include:
- **Design System Compliance**: New patterns or components
- **Platform Support**: macOS/Windows/Linux changes
- **AI Integration**: LLM or optimization intelligence updates
- **Visual Enhancements**: UI/UX improvements with screenshots

## Example

```
/release-notes v5.0
```

Generates release notes for v5.0 Premium Visual Experience milestone.

## Related Commands

- `/commit` - Create commits with proper messages
- `/phase-done` - Complete a phase
- `/guphase` - Generate phase summary (similar but phase-focused)

## Notes

- Parses conventional commit messages for categorization
- Links to relevant PRs/issues if available
- Can be used for internal releases or public changelog
- Respects `.planning/` documentation for context
