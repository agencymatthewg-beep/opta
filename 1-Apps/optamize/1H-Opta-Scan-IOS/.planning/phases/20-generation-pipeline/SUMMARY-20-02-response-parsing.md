---
phase: 20-generation-pipeline
plan: 02
subsystem: ai
tags: [parsing, error-handling, mlx, response, json, retry]

# Dependency graph
requires:
  - phase: 20-01
    provides: Streaming generation infrastructure with callbacks
provides:
  - ResponseParser utility for robust LLM output parsing
  - Comprehensive MLXError types with recoverability
  - Thermal state checking before generation
  - Retry mechanism for recoverable errors
affects: [21-local-first-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-strategy JSON extraction (code blocks, braces)
    - Error recoverability classification
    - Thermal state pre-check pattern

key-files:
  created:
    - Opta Scan/Services/ResponseParser.swift
  modified:
    - Opta Scan/Services/MLXService.swift
    - Opta Scan/Services/LLMProvider.swift
    - Opta Scan.xcodeproj/project.pbxproj

key-decisions:
  - "Multi-strategy JSON extraction for varied LLM output formats"
  - "isRecoverable property on MLXError for retry decisions"
  - "Thermal critical state check prevents throttled generation"
  - "500ms retry delay to avoid rapid retry loops"

patterns-established:
  - "ResponseParser centralized parsing: All LLM output parsing through ResponseParser enum"
  - "Error recoverability classification: MLXError.isRecoverable for retry logic"
  - "Thermal pre-check: Check ProcessInfo.thermalState before heavy operations"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-22
---

# Plan 20-02: Response Parsing and Error Handling Summary

**Centralized ResponseParser utility with multi-strategy JSON extraction, comprehensive error types with recoverability classification, and retry support for recoverable failures**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T23:33:15Z
- **Completed:** 2026-01-21T23:37:16Z
- **Tasks:** 6/6
- **Files modified:** 4

## Accomplishments

- Created ResponseParser utility with multiple JSON extraction strategies (code blocks, brace matching)
- Expanded MLXError with generationFailed, parsingFailed, outOfMemory, and thermalThrottled cases
- Added isRecoverable property to identify retry-safe errors
- Implemented thermal state check before generation to prevent throttled execution
- Added error mapping in generate() to convert MLX errors to user-friendly MLXError types
- Implemented withRetry helper in LLMServiceManager for automatic retry of recoverable errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ResponseParser utility** - `43b3f96` (feat)
2. **Task 2: Update MLXService to use ResponseParser** - `40b3517` (refactor)
3. **Task 3: Add Generation Error Types** - `fc69fb6` (feat)
4. **Task 4: Add Error Recovery in Generate** - `e252151` (feat)
5. **Task 5: Add Retry Support** - `49d6455` (feat)
6. **Task 6: Build Verification** - `139e669` (chore)

## Files Created/Modified

- `Opta Scan/Services/ResponseParser.swift` - New centralized parser with JSON extraction, analysis/optimization result parsing, highlight/ranking extraction
- `Opta Scan/Services/MLXService.swift` - Removed duplicate parsing code, delegates to ResponseParser, expanded MLXError enum with new cases and isRecoverable property, added thermal check and error mapping
- `Opta Scan/Services/LLMProvider.swift` - Added withRetry helper for automatic retry of recoverable errors
- `Opta Scan.xcodeproj/project.pbxproj` - Added ResponseParser.swift to project

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Multi-strategy JSON extraction | LLMs produce varied output formats - code blocks, raw JSON, mixed text. Multiple strategies improve parsing success rate. |
| isRecoverable on MLXError | Enables callers to decide whether to retry without switch-casing all error types. |
| Thermal critical pre-check | Prevents wasted resources on generation that will be throttled anyway. |
| 500ms retry delay | Balance between responsive retries and avoiding CPU spin. |
| Max 2 retry attempts | Limits retries to prevent infinite loops while giving transient failures a second chance. |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Response parsing and error handling complete
- Phase 20 (Generation Pipeline) is complete
- Ready for Phase 21 (Local-First Polish) which will integrate the streaming UI and finalize the local AI experience

---
*Plan: 20-02 (Response Parsing and Error Handling)*
*Completed: 2026-01-22*
