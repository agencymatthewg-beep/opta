# Opta CLI TypeScript

Modern TypeScript implementation of AI coding assistant with multi-provider support. **Note: May be deprecated — check status before major work.**

## Tech Stack
- **Node.js** 20+ | **TypeScript** 5.7+
- **Commander.js** (CLI framework)
- **Anthropic, OpenAI, Google, Groq** SDK support
- **Zod** for validation

## Key Commands
```bash
npm install
npm run dev          # Development with tsx watch
npm run build        # Build to dist/
npm start            # Run production build
npm run lint         # ESLint
npm run test         # Vitest
```

## Architecture
```
src/
├── index.ts         # Entry point
├── commands/        # CLI command handlers
├── core/            # Core logic (config, utils)
├── memory/          # State & persistence layer
├── providers/       # LLM provider adapters
├── skills/          # Extensible skill system
└── ui/              # CLI UI components (Ink, Ora)
```

## Key Features
- Multi-provider LLM support (Anthropic Claude, OpenAI, Google Gemini, Groq)
- MCP (Model Context Protocol) integration
- Memory & persistence layer
- Advanced CLI UI (Ink, Ora spinners)
- Skill system for extensibility

## Current Status
- **BETA** - Unfinished Aider fork
- All dependencies pinned & verified
- Build pipeline complete
- **⚠️ Check before large changes** - may be marked for deletion

## Build Notes
- ESM module format
- TypeScript compiled to ESM JavaScript
- Binary entry: `opta` command
- Requires Node 20+
