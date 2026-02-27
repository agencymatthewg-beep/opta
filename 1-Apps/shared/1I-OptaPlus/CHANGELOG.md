# Changelog

All notable changes to OptaPlus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-02-14

### Added

- **macOS App** — Full native macOS chat client with Cinematic Void design
- **iOS App** — Complete iOS app with onboarding, bot cards, chat, settings, and iPad optimization
- **Cinematic Void Design System** — Color audit, typography scale (Sora 10–34pt), glass modifiers (subtle/standard/strong), motion tokens, reduce motion compliance
- **OpenClaw Protocol v3** — WebSocket client with NWConnection, connect handshake, event streaming
- **Networking Robustness** — Exponential backoff with jitter, ping/pong health monitoring, offline message queue, chat history pagination, session persistence
- **Rich Markdown Rendering** — Headings, bold, italic, code spans, links, images
- **Syntax-Highlighted Code Blocks** — Multi-language highlighting with one-click copy
- **Dynamic Table Rendering** — Markdown tables with streaming resilience for partial data
- **Collapsible Sections** — Expandable/collapsible content blocks
- **Chart Visualization** — SwiftUI Charts integration for data display
- **Command Palette** (`⌘P`) — Quick actions and bot switching
- **Message Search** (`⌘F`) — Full-text search across chat history
- **Keyboard Shortcuts** — Complete shortcut set with cheat sheet overlay (`⌘/`)
- **ThinkingOverlay** — Expandable and draggable thinking indicator
- **Session Management** — Multiple session modes (Synced, Direct, Isolated), session drawer (`⌘]`)
- **Notifications** — Native macOS notification support
- **Sound Effects** — Send, receive, and connect audio feedback
- **Attachment Support** — File picker with preview and base64 upload
- **Reactions Bar** — Emoji reactions on messages
- **Animations** — Ignition entrance, staggered list animations, ambient float, breathe, hover glow, gradient fade
- **Glassmorphism** — Three-tier glass effects with glow borders and void fade
- **iOS Polish** — Timestamps, copy, emoji, haptics, pull-to-refresh, empty states, app icon
- **macOS Polish** — Toasts, status dots, skeleton loading, sidebar search, scroll FAB, grouped timestamps, reconnect button, emoji-only large font, character count, new messages pill
- **Accessibility** — Full Reduce Motion compliance across all animations
- **Tests** — Unit tests for markdown, code blocks, tables, collapsible sections, typography, glass, animations, networking

### Fixed

- ThinkingOverlay no longer overlaps input bar
- Use `openclaw-control-ui` clientId to bypass device auth
- Connection validation and test improvements

### Changed

- Complete directory reorganization and repository cleanup
- Rewritten documentation with accurate paths and architecture
