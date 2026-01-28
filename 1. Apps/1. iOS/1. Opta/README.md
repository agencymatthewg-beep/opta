# Opta

**Scan Anything. Optimize Everything.**

A universal optimization scanner that analyzes any visual input and provides optimal choices based on your priorities.

## Overview

Opta uses AI vision models to extract options from images (menus, products, listings, documents) and scores them against your personal optimization priorities (budget, health, quality, time, sustainability).

## Architecture

```
opta/
├── apps/
│   └── mobile/          # Expo React Native app
├── packages/
│   ├── api/             # Hono API server with vision pipeline
│   └── shared/          # Shared types, constants, utilities
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # PNPM workspace config
```

## Tech Stack

- **Mobile**: Expo SDK 51, React Native, TypeScript
- **API**: Hono (lightweight Node.js framework)
- **Vision AI**: OpenAI GPT-4 Vision (Claude as fallback)
- **State**: Zustand (client), React Query (server state)
- **Database**: Supabase (Postgres + Auth)
- **Monorepo**: Turborepo + PNPM workspaces

## Getting Started

### Prerequisites

- Node.js 18+
- PNPM 8+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone and install
cd opta
pnpm install

# Copy environment config
cp .env.example .env
# Edit .env with your API keys
```

### Development

```bash
# Start all packages in dev mode
pnpm dev

# Or start individually:
pnpm --filter @opta/api dev      # API server on :3001
pnpm --filter @opta/mobile dev   # Expo dev server

# Type checking
pnpm type-check

# Build all
pnpm build
```

### Mobile Development

```bash
cd apps/mobile

# Start Expo
pnpm dev

# Run on specific platform
pnpm ios      # iOS Simulator
pnpm android  # Android Emulator
```

## Project Structure

### Mobile App (`apps/mobile/`)

- `app/` - Expo Router screens (file-based routing)
  - `index.tsx` - Home screen
  - `scan.tsx` - Camera scanner
  - `results.tsx` - Optimization results
  - `history.tsx` - Scan history
  - `settings.tsx` - Priority configuration
- `src/stores/` - Zustand state management
- `src/services/` - API client

### API Package (`packages/api/`)

- `src/routes/` - API endpoints
- `src/services/`
  - `vision.ts` - GPT-4 Vision extraction
  - `optimizer.ts` - Multi-criteria scoring

### Shared Package (`packages/shared/`)

- `src/types/` - TypeScript interfaces
- `src/constants.ts` - App constants
- `src/utils.ts` - Scoring algorithms

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 Vision | Yes |
| `ANTHROPIC_API_KEY` | Claude API key (fallback) | No |
| `SUPABASE_URL` | Supabase project URL | No* |
| `SUPABASE_ANON_KEY` | Supabase anon key | No* |
| `API_PORT` | API server port (default: 3001) | No |

*Supabase is optional for local development

### Priority Weights

Users can configure optimization priorities in Settings:

| Priority | Default | Description |
|----------|---------|-------------|
| Budget | 30% | Cost-effectiveness |
| Quality | 30% | Premium quality |
| Health | 20% | Health benefits |
| Time | 10% | Speed/convenience |
| Sustainability | 10% | Eco-friendliness |

## API Endpoints

### `POST /api/scan`

Analyze an image and return optimization results.

**Request:**
```json
{
  "image": "base64-encoded-image",
  "priorities": {
    "budget": 0.3,
    "health": 0.2,
    "quality": 0.3,
    "time": 0.1,
    "sustainability": 0.1
  },
  "context": "optional context string"
}
```

**Response:**
```json
{
  "success": true,
  "scanId": "uuid",
  "contentType": "menu",
  "recommendation": {
    "topChoice": { "id": "...", "name": "...", "score": 0.87 },
    "explanation": "This option best matches your priorities..."
  },
  "allOptions": [...],
  "confidence": 92,
  "processingTimeMs": 1450
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm type-check` and `pnpm build`
5. Submit a pull request

## License

MIT
