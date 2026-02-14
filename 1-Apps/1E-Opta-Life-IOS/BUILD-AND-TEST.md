# OptiLife iOS - Build & Test Guide

**Status:** Ready for Testing  
**Date:** 2026-02-14 10:13 AEDT  
**Integration:** Opta512 Personal Assistant Complete

---

## Quick Start

1. Open Xcode on your MacBook (Opta48)
2. Navigate to: `/Users/Shared/312/Opta/1-Apps/1E-Opta-Life-IOS/`
3. Open `OptaLMiOS.xcodeproj`
4. Select target: iPhone 15 Pro simulator (or your device)
5. Press ⌘+R to build and run

---

## What to Verify

### ✅ Build Success Checklist

**Phase 1: Compilation**
- [ ] Project builds without errors
- [ ] All services compile (especially new `Opta512Service.swift`)
- [ ] No missing dependencies
- [ ] All views load properly

**Phase 2: Runtime Verification**
- [ ] App launches successfully
- [ ] Dashboard loads without crashes
- [ ] Personal assistant data appears

### 📊 Dashboard Integration Tests

**1. Tasks Display**
- [ ] Tasks from PRIORITIES.md appear
- [ ] Tasks from Todoist API appear (if configured)
- [ ] Both sources merge correctly
- [ ] Priority colors correct:
  - 🔴 Urgent tasks show red
  - High priority tasks show amber
  - Normal tasks show blue/gray
- [ ] Completion status accurate

**Expected Tasks (from PRIORITIES.md):**
```
✓ OptiLife iOS overnight task (URGENT - red)
✓ Crown check-in instructions (HIGH - amber)
✓ Personal assistant setup (COMPLETED - strikethrough)
```

**2. Calendar/Events Display**
- [ ] Events from SCHEDULE.md appear
- [ ] Events from Google Calendar appear (if configured)
- [ ] Both sources merge correctly
- [ ] Times display accurately
- [ ] All-day events marked correctly

**Expected Events (from SCHEDULE.md today):**
```
✓ 09:00 - Ruby's netball
✓ 17:00 - Ruby's netball
✓ All Day - ANNIVERSARY 🌝
✓ All Day - Crown Promenade booking
✓ All Day - OXYLABS subscription
```

**3. Source Attribution**
- [ ] Can distinguish Opta512 data from API data
- [ ] Calendar source labels visible (optional)
- [ ] Task labels show `opta512` (optional)

**4. Stats Accuracy**
- [ ] "Tasks Today" count = personal assistant tasks + API tasks
- [ ] "Events Today" count = personal assistant events + API events
- [ ] Counts update on refresh

---

## Expected Behavior

### On App Launch

```
1. App initializes
2. Opta512Service.shared loads
3. Service reads:
   - /Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/SCHEDULE.md
   - /Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/PRIORITIES.md
4. Markdown parsed into CalendarEvent and OptaTask objects
5. DashboardView.loadData() called
6. Personal assistant data merged with API data
7. Dashboard displays unified view
```

### On Pull-to-Refresh

```
1. User swipes down on dashboard
2. Opta512Service.syncAll() called
3. Files re-read
4. Data re-parsed
5. Dashboard updates with latest
```

---

## Debugging

### If Build Fails

**Common Issues:**

1. **Missing Xcode**
   - Ensure Xcode 15.2+ installed
   - Run: `xcode-select --install`

2. **Signing Issues**
   - Open project settings
   - Select "Automatically manage signing"
   - Choose your Apple ID team

3. **Swift Compilation Errors**
   - Check `Opta512Service.swift` imports
   - Verify `CalendarEvent` and `OptaTask` models exist
   - Ensure `EventSource.opta512` case exists

### If Data Doesn't Appear

**Troubleshooting Steps:**

1. **Check File Paths**
```swift
// In Opta512Service.swift, verify paths:
private let schedulePath = "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/SCHEDULE.md"
private let prioritiesPath = "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/PRIORITIES.md"
```

2. **Verify Files Exist**
```bash
ls -la "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/"
# Should show SCHEDULE.md and PRIORITIES.md
```

3. **Check Parsing**
- Add breakpoint in `parseSchedule()` method
- Step through parsing logic
- Verify markdown format matches expected patterns

4. **Check Console Logs**
- Look for `[Opta512Service]` prefix logs
- Check for parse errors
- Verify sync completion messages

### If App Crashes

**Common Crash Points:**

1. **File Access Permissions**
   - Ensure app has file system access
   - Check sandbox entitlements

2. **Date Parsing Failures**
   - Verify date format strings
   - Check for nil date handling

3. **Async Race Conditions**
   - Ensure `@MainActor` annotations correct
   - Verify `await` usage in async functions

---

## Performance Verification

### Expected Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| App launch to dashboard | <1s | <2s |
| Markdown parsing | <10ms | <50ms |
| Full data sync | <500ms | <1s |
| Pull-to-refresh | <300ms | <800ms |

### Memory Usage

- **Baseline:** ~50-80MB
- **After sync:** +5-10MB (negligible)
- **No leaks:** Memory should stabilize

### Profiling (Optional)

```bash
# Run in Instruments
# Profile → Time Profiler
# Look for Opta512Service methods
# Should see minimal CPU usage
```

---

## Integration Verification Script

Run this from terminal to verify integration:

```bash
#!/bin/bash
cd /Users/Shared/312/Opta/1-Apps/1E-Opta-Life-IOS

echo "=== Opta512 Personal Assistant Integration Check ==="

# Check service file exists
if [ -f "OptaLMiOS/Services/Opta512Service.swift" ]; then
    echo "✅ Opta512Service.swift exists"
    SIZE=$(stat -f%z "OptaLMiOS/Services/Opta512Service.swift")
    echo "   Size: $SIZE bytes"
else
    echo "❌ Opta512Service.swift MISSING"
fi

# Check dashboard integration
if grep -q "Opta512Service" "OptaLMiOS/Views/Dashboard/DashboardView.swift"; then
    echo "✅ Dashboard integrated with Opta512Service"
else
    echo "❌ Dashboard NOT integrated"
fi

# Check data source files
if [ -f "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/SCHEDULE.md" ]; then
    echo "✅ SCHEDULE.md exists"
    EVENTS=$(grep -c "^- \*\*" "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/SCHEDULE.md")
    echo "   Events found: $EVENTS"
else
    echo "❌ SCHEDULE.md MISSING"
fi

if [ -f "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/PRIORITIES.md" ]; then
    echo "✅ PRIORITIES.md exists"
    TASKS=$(grep -c "^- \[" "/Users/Shared/Opta512 Bot/.openclaw/workspace/personal-assistant/PRIORITIES.md")
    echo "   Tasks found: $TASKS"
else
    echo "❌ PRIORITIES.md MISSING"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Open OptaLMiOS.xcodeproj in Xcode"
echo "2. Build (⌘+B) and verify no errors"
echo "3. Run (⌘+R) on simulator or device"
echo "4. Check dashboard for merged data"
```

---

## Known Limitations

### Current Implementation

1. **No File Watching**
   - Changes to markdown files require manual refresh (pull-to-refresh)
   - Future: Add FSEvents monitoring for real-time updates

2. **Basic Parsing**
   - Only parses specific markdown formats
   - Assumes well-formed markdown
   - Future: Add more robust parsing with error recovery

3. **No Bidirectional Sync**
   - iOS → markdown write-back not implemented
   - Future: Allow task completion to update PRIORITIES.md

4. **No Conflict Resolution**
   - Duplicate tasks/events not merged intelligently
   - Future: Add smart deduplication

---

## Success Criteria

**✅ Integration Successful If:**

1. App builds without errors
2. Dashboard displays tasks from PRIORITIES.md
3. Dashboard displays events from SCHEDULE.md
4. API data (if configured) merges correctly
5. Pull-to-refresh updates data
6. No crashes on launch or refresh
7. Performance remains smooth (<1s loads)

**Ready for Phase 2B (UI Polish) if all criteria met.**

---

## Next Phase Preview

After successful build/test, Phase 2B will add:

- OptiCharacter design polish
- Source badges (visual distinction)
- Enhanced animations
- Settings integration
- Improved error states

---

*Build guide created by Opta512 at 10:13 AEDT*  
*Ready for Matthew to test on MacBook*
