# 10-06 Summary: Investigation Mode

## Status: Complete

## What Was Built

Investigation Mode provides full transparency for power users who want to see exactly what Opta is doing under the hood.

### Components Created

1. **Investigation Types** (`src/types/investigation.ts`)
   - `ChangeType`: registry, config, command, service, file
   - `ChangePlatform`: windows, macos, linux, all
   - `InvestigationChange`: Individual modifications with before/after, technical details, rollback
   - `InvestigationDependency`: requires, conflicts, affects relationships
   - `InvestigationImpact`: performance, stability, compatibility, security analysis
   - `InvestigationReport`: Complete transparency report

2. **Investigation Backend** (`mcp-server/src/opta_mcp/investigation.py`)
   - `get_investigation_report()`: Generates platform-aware transparency reports
   - `get_game_config_path()`: Platform-specific config file locations
   - Dataclasses for type-safe report generation
   - MCP tool registration in server.py

3. **Investigation Panel** (`src/components/InvestigationPanel.tsx`)
   - Slide-in panel from right side
   - Expandable change cards with location, before/after, technical details
   - Copy-to-clipboard for locations and rollback commands
   - Dependency status indicators (ok, warning, blocked)
   - Impact analysis with severity levels and mitigations
   - Rollback availability and steps

4. **Investigation Mode Integration**
   - `InvestigationModeProvider`: Context with localStorage persistence
   - Toggle in Settings Privacy section
   - "Investigate" button appears in GameOptimizationPreview when enabled
   - Panel opens with full report when clicked

### User Experience

- Power users enable Investigation Mode in Settings > Privacy
- When viewing a game's optimization settings, an "Investigate" button appears
- Clicking opens a detailed panel showing:
  - Exact files/registry keys that will be modified
  - Before and after values
  - Technical explanations
  - Dependencies and conflicts
  - Impact analysis with mitigations
  - Full rollback instructions

### Design System Compliance

- All animations use Framer Motion
- Glass effects for panels and cards
- Lucide icons only (Eye, FileCode, Terminal, Database, etc.)
- Semantic colors for status indicators
- Consistent spacing and typography

## Commits

1. `aa0c382` - feat(10-06): create investigation data types
2. `2d3c3a4` - feat(10-06): create investigation backend
3. `18b5e36` - feat(10-06): create Investigation Panel component
4. `68a92a7` - feat(10-06): add Investigation Mode toggle and integration

## Technical Notes

- Investigation reports are generated client-side for now
- Backend MCP tool ready for production use with real registry/config scanning
- Platform-specific paths configured for Windows, macOS, Linux
- State persisted in localStorage for user preference

## Files Changed

- `src/types/investigation.ts` (new)
- `mcp-server/src/opta_mcp/investigation.py` (new)
- `mcp-server/src/opta_mcp/server.py` (modified)
- `src/components/InvestigationPanel.tsx` (new)
- `src/components/InvestigationMode.tsx` (new)
- `src/components/GameOptimizationPreview.tsx` (modified)
- `src/pages/Settings.tsx` (modified)
- `src/App.tsx` (modified)
