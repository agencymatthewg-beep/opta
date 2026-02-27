# Opta Life Web

Next.js 15 dashboard for Opta Life - task management, calendar, and AI insights. React 18 + TypeScript.

## Tech Stack
- **Next.js** 15.5.9 | **React** 18.3 | **TypeScript** 5
- **Tailwind CSS** 4 (with PostCSS)
- **Framer Motion** (animations)
- **NextAuth** 5-beta (auth)
- **Google APIs** (Generative AI, Calendar)

## Key Commands
```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Build for production
npm start            # Run production build
npm run lint         # ESLint
```

## Architecture
```
app/                 # Next.js App Router
├── api/             # API routes & handlers
├── (routes)/        # Main app pages
└── layout.tsx       # Root layout

components/          # React components (25+ files)
contextsHooks/       # Context providers & custom hooks
auth.ts             # NextAuth configuration
globals.css         # Global Tailwind styles
```

**Note:** This app uses `app/` at project root (not `src/app/` like AICompare and AI Components).

## Environment

Requires `.env.local` (gitignored):
```
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Key Features
- Task dashboard with real-time updates
- Calendar integration (Google Calendar)
- AI-powered insights (Google Generative AI)
- Next.js 15 with App Router
- Vercel deployment ready

## Current Status
- Production-ready for core features
- Authentication configured (NextAuth)
- Google API integration complete
- Vercel hosting configured (.vercel/)

## Build Notes
- Uses Tailwind CSS 4 with PostCSS
- Framer Motion for page transitions & animations
- Deployed to Vercel (see .vercelignore)
- Node.js 18+ required
