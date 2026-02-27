# Opta CLI Deep Debug & Optimize Session

You're optimizing the Opta CLI (TypeScript/Ink TUI). The CLI is mostly functional but needs debugging and polish.

## Context

- **Location:** `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/`
- **LMX:** Running on 192.168.188.11:1234 with MiniMax-M2.5-5bit
- **Recent changes:** Added purple border around LLM responses, removed dead panel system

## Your Mission

Run the CLI, test thoroughly, and fix issues. Focus on:

### Priority 1: Test Everything
1. Start CLI: `cd ~/Synced/Opta/1-Apps/1D-Opta-CLI-TS && npm run dev -- chat`
2. Test these commands: `/help`, `/model`, `/clear`, `/exit`
3. Verify purple border appears around LLM responses
4. Test tool calling: ask to run a shell command
5. Test scrolling with long responses

### Priority 2: Find & Fix Bugs
- Run `npm test` - fix any failing tests
- Run `npm run typecheck` - fix any type errors
- Check console for runtime errors

### Priority 3: Optimize Performance
- Measure TTFT (time to first token)
- Measure token generation speed
- Check if model needs to load on each request

### Priority 4: Polish UI
- Verify purple border looks good
- Check help overlay shows correct keybindings
- Test error messages display properly

## Deliver

1. Fix all found issues
2. Run full test suite
3. Document what was fixed in a reply

## Constraints

- Don't break existing working features
- Keep the purple border (it's the new Opta theme)
- Maintain backward compatibility with existing commands
