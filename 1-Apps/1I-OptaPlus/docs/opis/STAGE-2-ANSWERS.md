# OptaPlus — OPIS Stage 2 Answers (Deep Dive)

**Date:** 2026-02-15

---

## A1: Connection & Auth
All 3 methods — manual IP/port, LAN auto-discovery, cloud relay (Cloudflare tunnel). As autonomous and easy as possible.

## A2: Multi-Device Sync
Full chat history sync across ALL devices via iCloud. Any bot remembers chat history equally regardless of which device you use.

## A3: Chat Feature Parity
ALL features with a bot use case: markdown, code blocks, image/file sending, voice messages, etc.

**Human-only features → ADAPTED for bot utility:**
- 👍 Reaction → "proceed with next steps"
- ❓ Reaction → "explain what you just said"
- @bot mention in another bot's chat → tagged bot analyzes recent chats, updates knowledge, or takes over work
- Reply-to → reference specific messages for context

Features with no bot utility are removed entirely.

## A4: Push Notifications
Configurable per bot per notification type.

## A5: Bot Config Editing
Maximum functionality — edit configs, models, system prompts, skills. Not just view+restart.

## A6: Automation Management
Full CRUD — create, read, update, delete cron jobs and automations.

## A7: Distribution
App Store — friends should be able to download and test.

## A8: v1.0 Scope
Feature-rich. Siri + widgets included. Not a minimal MVP — a complete Telegram replacement with bot management.
