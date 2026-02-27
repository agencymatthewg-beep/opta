# Task: Thinking Display + Status Bar for Opta CLI

## Overview
Two UI enhancements inspired by Claude Code:
1. **Thinking display** — Show `<think>` content in a distinct dimmed/italic block (not stripped entirely)
2. **Status bar** — Persistent bottom bar showing model, tokens, speed, session info

## Current State
- `ThinkTagStripper` in `src/core/agent.ts` currently STRIPS thinking entirely
- `collectStream()` handles streaming chunks with onText callback
- `src/ui/spinner.ts` has ora-based spinner
- `src/ui/output.ts` has basic formatting helpers
- Chat loop in `src/commands/chat.ts` uses `agentLoop()` which calls `collectStream()`

## Requirements

### 1. Thinking Display
- When `<think>` content streams in, render it in a **collapsible dimmed block**
- Format: dim italic text, prefixed with `⚙ thinking` header
- After `</think>`, collapse to single line: `⚙ thinking (N tokens)` in dim
- The actual response renders normally below
- Thinking is NOT stored in message history (keep the strip from history)
- Thinking IS visible during streaming (real-time, dim)

### 2. Status Bar (Bottom of Terminal)
Claude Code style persistent status bar showing:
- **Left:** Model name (shortened), session ID
- **Center:** Token count (prompt + completion), cost estimate
- **Right:** Speed (tokens/sec), elapsed time

Format example:
```
 M2.5-4bit │ Dh5S9hpG │ 1.1K tokens │ 37 t/s │ 6.7s
```

Update in real-time during streaming.

## Files to Create/Modify

### NEW: `src/ui/thinking.ts`
```typescript
// ThinkingRenderer — handles <think> tag display
// - Streams thinking content in dim italic
// - Collapses after </think> closes
// - Tracks thinking token count
```

### NEW: `src/ui/statusbar.ts`
```typescript
// StatusBar — persistent bottom-of-terminal status line
// - Uses ANSI save/restore cursor + bottom line positioning
// - Updates during streaming (throttled to 100ms)
// - Shows: model, session, tokens, speed, time
// - Cleans up on exit
```

### MODIFY: `src/core/agent.ts`
- Replace `ThinkTagStripper` with `ThinkingRenderer` integration
- `collectStream()` gets new callbacks: `onThinking(text)`, `onStatusUpdate(stats)`
- Track timing: start time, tokens received, compute speed
- Pass stats to status bar

### MODIFY: `src/commands/chat.ts`
- Initialize StatusBar at session start
- Pass to agentLoop options
- Update after each turn with cumulative stats
- Clean up on exit

## Implementation Notes

### Thinking Display Approach
Use ANSI dim + italic for thinking text:
```
⚙ thinking...
  The user is asking about X. I should consider Y and Z...
  Let me check the configuration...
```
After complete:
```
⚙ thinking (47 tokens)

[actual response here]
```

### Status Bar Approach
Reserve the last terminal line. Use ANSI escape sequences:
- `\x1b[s` save cursor position
- `\x1b[${rows};1H` move to last row
- Write status line (full width, inverse colors)
- `\x1b[u` restore cursor position

Throttle updates to avoid flicker (100ms debounce).

### Token Speed Calculation
- Track `Date.now()` at first chunk received
- Count completion tokens from chunks
- speed = completion_tokens / elapsed_seconds
- Update status bar each chunk (throttled)

## Testing
- Unit test ThinkingRenderer with partial chunks
- Unit test StatusBar formatting
- Manual test with M2.5 on LMX

## Acceptance Criteria
- [x] Thinking shows in dim italic during streaming
- [x] Thinking collapses to summary after completion
- [x] Thinking is NOT in message history
- [x] Status bar shows model, tokens, speed in real-time
- [x] Status bar persists between turns
- [x] No visual glitches or cursor corruption
- [x] Works in non-TTY mode (graceful fallback)
- [x] All existing tests still pass
