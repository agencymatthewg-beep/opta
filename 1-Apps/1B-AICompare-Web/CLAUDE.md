# AICompare Web

AI model comparison tool - Next.js 16 dashboard for benchmarking and comparing LLM provider capabilities.

## Tech Stack
- **Next.js** 16.1.6 | **React** 19.2 | **TypeScript** 5
- **Tailwind CSS** 4 (with PostCSS)
- **Radix UI** (dialog, dropdown, select, tooltip)
- **Framer Motion** (animations)
- **Fuse.js** (fuzzy search)
- **GSAP** (advanced animations)

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
src/
├── app/             # Next.js App Router pages
│   └── layout.tsx   # Root layout
├── components/      # React components
├── lib/             # Utilities & helpers
└── styles/          # Global CSS (Tailwind)
```

## Key Features
- Interactive AI model comparison matrix
- Real-time search & filtering (Fuse.js)
- Responsive design (Radix UI)
- Smooth animations (GSAP, Framer Motion)
- Dark mode support

## Current Status
- Full feature set implemented
- Radix UI components integrated
- Search functionality complete
- Ready for data integration

## Build Notes
- React 19+ with strict mode
- Tailwind CSS 4 latest
- Fully typed TypeScript
- Supports SWR for data fetching (no API yet)
- Deploy to Vercel or any Node host
