# Opta CLI - Optimization & Debugging Plan

**Generated:** 2026-02-19
**Status:** Ready for Claude Code session

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| Build | ✅ Clean | ESM + DTS success |
| TypeScript | ✅ 0 errors | |
| LMX | ✅ Running | MiniMax-M2.5-5bit loaded |
| Commands | 16 files | |
| TUI Components | 21 files | |

---

## Issues to Fix

### 1. Performance
- [ ] **TTFT** - First token time ~2s (cold), aim for <1s
- [ ] **Token speed** - Currently ~15 tok/s, aim for 25+
- [ ] **Model warming** - No auto-load on startup

### 2. UI/UX
- [ ] **Purple border** - Just added, test thoroughly
- [ ] **Help overlay** - Still shows removed keybindings (FIXED)
- [ ] **Scrolling** - Verify message scroll works
- [ ] **Input handling** - Test edge cases

### 3. Functionality
- [ ] **Tool calls** - Verify tools work end-to-end
- [ ] **Model switching** - Test `/model` command
- [ ] **Sessions** - Test session save/load
- [ ] **Config** - Verify config persistence

### 4. Stability
- [ ] **Error handling** - Test with bad inputs
- [ ] **Memory** - Monitor during long sessions
- [ ] **Reconnects** - Test LMX disconnect/reconnect

---

## Optimization Opportunities

### High Priority
1. **Model pre-load** - Configure LMX presets to auto-load model
2. **Connection pooling** - Keep LMX connection warm
3. **Streaming** - Optimize token streaming buffer

### Medium Priority
1. **Caching** - Cache command list, model list
2. **Lazy loading** - Load heavy components on-demand
3. **Bundle size** - Tree-shake unused dependencies

### Low Priority
1. **Keyboard shortcuts** - Add more convenient shortcuts
2. **Themes** - Add dark/light/purple themes
3. **Animations** - Smooth transitions

---

## Testing Checklist

- [ ] Run CLI in real terminal
- [ ] Send message, verify purple border appears
- [ ] Test `/help` - no panel keys
- [ ] Test `/model` - switch models
- [ ] Test `/clear` - clear screen
- [ ] Test tool calls - verify execution
- [ ] Test long response - verify scrolling
- [ ] Test Ctrl+C - graceful exit

---

## Commands for Testing

```bash
# Start CLI
cd ~/Synced/Opta/1-Apps/1D-Opta-CLI-TS
npm run dev -- chat

# Test commands
/help
/model
/clear
/exit

# Check LMX
curl http://192.168.188.11:1234/v1/models
```

---

## Recommended Next Steps

1. **Fix TypeScript** (DONE) ✅
2. **Test in real terminal** - Verify purple border, all commands
3. **Run full test suite** - npm test
4. **Performance tuning** - Model pre-load, connection pooling
5. **Document** - Update APP.md with new features

---

## Files Changed Today

- `src/tui/MessageList.tsx` - Purple border for LLM responses
- `src/tui/keybindings.ts` - Removed panel switching
- `src/tui/hooks/useKeyboard.ts` - Removed Tab handlers
- `src/tui/App.tsx` - Removed FocusContext, blue borders
- `src/tui/HelpOverlay.tsx` - Removed panel keys from help
