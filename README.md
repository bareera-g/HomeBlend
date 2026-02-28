# HomeBlend

Find your perfect place together. Host creates a session, sets constraints, and participants swipe on listings. Live leaderboard and blend (taste compatibility + conflicts) at the end.

## Structure

- **apps/api** — Express backend (sessions, listings, swipes, leaderboard, blend)
- **apps/web** — Vite + React SPA (host dashboard + mobile voter)
- **packages/types** — Shared TypeScript types

## Run locally

1. Install: `npm install`
2. Build types: `npm run build -w packages/types`
3. Start API: `npm run dev:api` (or `npx tsx apps/api/src/index.ts` from repo root)
4. Start web: `npm run dev:web`

- API: http://localhost:3000  
- Web: http://localhost:5173 (proxies /api to API)

## Env

- **API**: `PORT` (default 3000), `CORS_ORIGIN` (default http://localhost:5173)

## Flows

- **Host**: Landing → Create → Set constraints → Lobby (share code/QR) → Start swiping → Live leaderboard → Reveal Blend
- **Mobile**: Enter code → Join with name → Swipe deck (YES/NO/MAYBE) → Done
