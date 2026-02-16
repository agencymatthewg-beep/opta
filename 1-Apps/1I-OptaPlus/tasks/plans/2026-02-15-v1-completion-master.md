# OptaPlus v1.0 Completion — Master Plan

**Goal:** Complete Telegram replacement. Every feature needed for Matthew to stop using Telegram for bot communication.

**Last updated:** 2026-02-15

---

## Feature Execution Order

Ordered by dependency chain + impact. Each feature = 1 Claude Code session.

| # | Feature | Phase File | Depends On | Est. Lines | Est. Time |
|---|---------|------------|------------|------------|-----------|
| 1 | **Bot Management UI completion** | `phase-05-bot-management.md` | Protocol layer (done) | ~300 | 1h |
| 2 | **Cron Creation fix** | `phase-06-cron-fix.md` | Protocol layer (done) | ~150 | 30min |
| 3 | **File/Image Sharing** | `phase-07-file-sharing.md` | None | ~500 | 2h |
| 4 | **Message Search** | `phase-08-message-search.md` | None | ~350 | 1.5h |
| 5 | **Offline Message Queue** | `phase-09-offline-queue.md` | None | ~250 | 1h |
| 6 | **Voice Messages** | `phase-10-voice-messages.md` | File sharing (#3) | ~450 | 2h |
| 7 | **@mention Cross-Bot** | `phase-11-crossbot-mention.md` | None | ~300 | 1.5h |
| 8 | **Markdown Polish** | `phase-12-markdown-polish.md` | None | ~200 | 1h |
| 9 | **App Store Preparation** | `phase-13-app-store.md` | All above | ~150 | 2h |

**Total:** ~2,650 new lines, ~12.5 hours of Claude Code time

---

## Parallelization Strategy

```
Session 1: #1 Bot Management + #2 Cron Fix (same files, do together)
Session 2: #3 File Sharing + #4 Message Search (independent)
Session 3: #5 Offline Queue + #7 @mention (independent)
Session 4: #6 Voice Messages (depends on #3)
Session 5: #8 Markdown Polish
Session 6: #9 App Store Prep (last)
```

**Minimum sessions:** 6 sequential Claude Code runs
**With parallelism:** 4 runs (if spawning 2 Claude Code instances)

---

## Claude Code Chain Pattern

Each phase file is self-contained. Run them in order:

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions
# Paste: Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/<phase-file>.md
```

Each plan includes:
- Context files to read
- Exact changes with signatures
- Test checklist
- "Done when" criteria
- Notification command on completion

---

## v1.0 Success Criteria (from APP.md)

- [ ] Matthew uses OptaPlus instead of Telegram for all bots
- [ ] All 7+ bots manageable from both platforms
- [ ] Zero crashes per week, <1s message latency
- [ ] Every Telegram bot feature replicated or improved
- [ ] Published on App Store
- [ ] Multi-window macOS (already working)
- [ ] Siri "Ask [bot] to [action]" (deferred to v1.1)
- [ ] iCloud sync (deferred to v1.1)
