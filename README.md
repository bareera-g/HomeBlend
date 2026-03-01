# HomeBlend

**Find your blend together** — a collaborative house-hunting app where groups swipe on properties, vote, and discover their top picks in real time.

Built with React + Vite (web), React Native + Expo (mobile), Express (API), and Firebase Firestore (database).

> For a high-level overview see [docs/PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md).  
> For full end-to-end user flows see [docs/USER_WORKFLOW.md](docs/USER_WORKFLOW.md).  
> For the Firestore data model see [docs/SCHEMA.md](docs/SCHEMA.md).  
> For the property dataset spec see [docs/DATASET.md](docs/DATASET.md).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js** ≥ 18 | [nodejs.org](https://nodejs.org/) |
| **npm** | ships with Node |
| **Mapbox token** | required — [get one here](https://account.mapbox.com/access-tokens/) |
| **OpenAI API key** | optional — enables AI-powered insights — [get one here](https://platform.openai.com/api-keys) |
| **Expo CLI** | optional — only for mobile (`npx expo`) |

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd HomeBlend

# Web frontend
npm install

# Express API server
cd server && npm install && cd ..

# Mobile app (optional)
cd apps/mobile && npm install && cd ../..
```

### 2. Environment variables

#### Frontend (root)

```bash
cp .env.example .env.local
```

```dotenv
# Required — Mapbox map
VITE_MAPBOX_TOKEN=pk.xxxxx

# Optional — AI insights (proxied server-side, never shipped to browser)
OPENAI_API_KEY=sk-xxxxx
```

> Firebase config is hardcoded in `src/lib/firebase-config.js` — no env vars needed for Firestore.

#### Express server (`server/`)

```bash
cd server
touch .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express listen port |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated) |
| `CHROME_PATH` | *(auto)* | Custom Chrome/Chromium path for Puppeteer scraping |

### 3. Firebase / Firestore

HomeBlend uses **Firestore only** (no Firebase Auth, Storage, or Realtime Database).

The repo ships pre-configured for the `homeblend-5192f` project. To use your own:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable **Firestore Database** (test mode for development)
3. Update the config in `src/lib/firebase-config.js`

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions.

### 4. Run

You need **two terminals** (three for mobile):

```bash
# Terminal 1 — Express API
cd server
npm run dev
# → http://localhost:3001

# Terminal 2 — Vite web app
npm run dev
# → http://localhost:5173

# Terminal 3 — Expo mobile (optional)
cd apps/mobile
npm run dev
# → Expo DevTools / QR code
```

### 5. Seed demo data (optional)

Populates Firestore with four demo users, three rooms, properties, and votes:

```bash
node scripts/seedRooms.mjs
```

---

## Available Scripts

### Frontend (root)

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |

### Express Server (`server/`)

| Command | Description |
|---|---|
| `npm run dev` | Server with auto-reload (nodemon) |
| `npm start` | Server without auto-reload |
| `npm run scrape` | Multi-mode property scraper |
| `npm run scrape:zillow` | Scrape from Zillow |
| `npm run scrape:redfin` | Scrape from Redfin |
| `npm run scrape:apartments` | Scrape Apartments.com + enrich |
| `npm run scrape:preview` | Dry-run scrape (no data written) |

### Mobile (`apps/mobile/`)

| Command | Description |
|---|---|
| `npm run dev` | Expo start |
| `npm run android` | Expo on Android emulator |
| `npm run ios` | Expo on iOS simulator |

### Utility Scripts

| Command | Description |
|---|---|
| `node scripts/seedRooms.mjs` | Seed Firestore with demo rooms & users |
| `node scripts/expandIrvineTo50.mjs` | Expand Irvine dataset to 50 properties |

---

## Project Structure

```
HomeBlend/
├── src/                        # React web app (Vite)
│   ├── components/             # Dashboard, RoomView, MapPanel, BlendPanel …
│   ├── lib/                    # firebase.js, auth.jsx, blendAlgorithm.js, llm.js
│   ├── data/                   # Static PROPERTIES array (~500+ listings)
│   ├── App.jsx                 # React Router: /auth, /dashboard, /room/:code
│   ├── Brand.jsx               # Design tokens, icons, LogoMark
│   └── index.css               # Global styles & animations
│
├── server/                     # Express API
│   └── src/
│       ├── routes/             # sessions, swipes, listings, leaderboard, stream (SSE)
│       ├── scraper/            # Zillow, Redfin, Rent.com, Apartments.com, generator
│       ├── utils/              # blendEngine, codeGenerator, insights, validate
│       ├── data/               # listings.json, properties.json, scraped-listings.json
│       ├── index.js            # Entry point
│       └── store.js            # In-memory session store
│
├── apps/
│   └── mobile/                 # React Native + Expo
│       ├── src/
│       │   ├── screens/        # LoginScreen, RoomCodeScreen, SwipeScreen
│       │   ├── components/     # PropertyCard, OverlayLabel
│       │   ├── context/        # AuthContext
│       │   └── lib/            # firebase.js, api.js, config.js, theme.js, storage.js
│       └── App.js
│
├── scripts/                    # CLI utilities (seed, expand dataset)
├── docs/                       # Project documentation
│   ├── PROJECT_DESCRIPTION.md
│   ├── USER_WORKFLOW.md
│   ├── SCHEMA.md
│   └── DATASET.md
├── firestore.rules             # Firestore security rules
├── FIREBASE_SETUP.md           # Firebase setup guide
└── vite.config.js              # Vite + OpenAI proxy plugin
```

---

## Architecture Overview

```
┌─────────────┐                   ┌──────────────┐
│  React Web  │───Firestore───▶   │   Firebase   │
│  (Vite)     │◀──onSnapshot──    │  Firestore   │
└──────┬──────┘                   └──────────────┘
       │ HTTP                            ▲
       ▼                                 │
┌──────────────┐                  ┌──────┴───────┐
│   Express    │                  │ React Native │
│   Server     │◀────HTTP────────│   (Expo)     │
│   :3001      │                  └──────────────┘
└──────────────┘
  ├─ Session CRUD
  ├─ Swipe engine
  ├─ Leaderboard / Blend
  ├─ SSE real-time stream
  └─ Property scraper
```

**Two real-time channels:**
1. **Firestore `onSnapshot`** — room-level updates (votes, members, properties) for both web and mobile
2. **Server-Sent Events** — session-level updates during swiping (swipe counts, user ready states)

---

## Key Features

- **Collaborative rooms** — create or join with a 6-character code
- **Property discovery** — filterable grid with category, price, beds, baths, amenities
- **Interactive map** — Mapbox GL with markers, convex hull area highlight
- **Drag-to-room** — drag any property card onto a room to add it
- **Voting** — like / dislike properties within a room
- **Blend analysis** — radar chart, compatibility matrix, group compatibility %
- **AI insights** — GPT-4o-mini powered blend narrative, group picks, property recommendations
- **Mobile swiping** — Tinder-style swipe cards on React Native / Expo
- **Real-time sync** — Firestore subscriptions keep all clients in sync
- **Property scraping** — multi-source scraper (Zillow, Redfin, Rent.com, Apartments.com)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Map doesn't load | Set `VITE_MAPBOX_TOKEN` in `.env.local` and restart Vite |
| AI insights not working | Set `OPENAI_API_KEY` in `.env.local` and restart Vite |
| Backend connection errors | Ensure server is running on port 3001 |
| Firestore permission denied | Use test-mode rules — see [FIREBASE_SETUP.md](FIREBASE_SETUP.md) |
| Port already in use | Change `PORT` in `server/.env` or kill the occupying process |
| Mobile can't reach server | Check `apps/mobile/src/lib/config.js` — auto-detects LAN IP from Expo |
| Expo build errors | Run `npx expo install --check` to fix version mismatches |

---

## License

Private — not licensed for redistribution.
