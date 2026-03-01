# HomeBlend — Project Description

## What is HomeBlend?

HomeBlend is a **collaborative housing search platform** that helps groups of people — roommates, couples, families — find a home they all love. Think of it as "Tinder for apartments, but for the whole group."

Each member independently votes on listings, and HomeBlend's **Blend Algorithm** analyzes everyone's preferences to surface properties the group is most likely to agree on. The result is a ranked shortlist of homes with real compatibility scores — no more endless group-chat debates over Zillow links.

---

## Problem

Apartment hunting as a group is painful:

- **Information overload** — Hundreds of listings across multiple sites
- **Preference misalignment** — Everyone sends links no one else clicks
- **No structure** — Group chats devolve into "what about this one?" threads
- **Decision paralysis** — Hard to converge when everyone has different priorities

## Solution

HomeBlend introduces a structured, gamified workflow:

1. **Create a room** and invite your group
2. **Everyone swipes** independently — like or dislike each listing
3. **The algorithm blends** everyone's taste profiles
4. **Group Picks** surfaces the top homes the group collectively loves
5. **AI Insights** (optional) explain *why* properties match the group

---

## Tech Stack

### Frontend — React Web App

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool & dev server |
| React Router | 7 | Client-side routing |
| Mapbox GL | 3 | Interactive property maps |
| Firebase SDK | 12 | Firestore real-time database |

### Mobile — React Native App

| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.76 | Cross-platform mobile |
| Expo | 52 | Build toolchain & dev workflow |
| PanResponder | (built-in) | Swipe gesture recognition |

### Backend — Express API Server

| Technology | Version | Purpose |
|---|---|---|
| Express | 5 | REST API framework |
| UUID | 13 | Session & user ID generation |
| Puppeteer | 24 | Headless Chrome for scraping |
| Cheerio | — | HTML parsing for scraping |
| Axios | — | HTTP client for scraping |

### Infrastructure

| Service | Purpose |
|---|---|
| Firebase Firestore | Real-time NoSQL database |
| OpenAI GPT-4o-mini | AI-powered property insights (optional) |
| Unsplash | Stock property images (generated listings) |
| Rent.com / Apartments.com | Real listing data sources |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Clients                                  │
│                                                                   │
│   ┌─────────────────────┐      ┌──────────────────────────┐     │
│   │   React Web App     │      │   React Native Mobile    │     │
│   │   (Vite, port 5173) │      │   (Expo, port 8081)      │     │
│   │                     │      │                          │     │
│   │  • Dashboard        │      │  • Login screen          │     │
│   │  • Room view        │      │  • Room code entry       │     │
│   │  • Map panel        │      │  • Swipe interface       │     │
│   │  • Blend panel      │      │    (Tinder-style cards)  │     │
│   │  • Group picks      │      │                          │     │
│   │  • Property cards   │      │                          │     │
│   └─────────┬───────────┘      └────────────┬─────────────┘     │
│             │                                │                    │
└─────────────┼────────────────────────────────┼────────────────────┘
              │                                │
              │  Firestore SDK                 │  REST API
              │  (real-time sync)              │  + SSE streams
              │                                │
              ▼                                ▼
   ┌──────────────────┐             ┌──────────────────────┐
   │  Firebase         │             │  Express Server      │
   │  Firestore        │             │  (port 3001)         │
   │                   │             │                      │
   │  • users          │             │  Routes:             │
   │  • rooms          │             │  • /api/sessions     │
   │  • room_codes     │             │  • /api/swipes       │
   │  • user_rooms     │             │  • /api/listings     │
   │  • saved_props    │             │  • /api/leaderboard  │
   │                   │             │  • /api/stream (SSE) │
   └──────────────────┘             │                      │
                                     │  Services:           │
                                     │  • Blend engine      │
                                     │  • Code generator    │
                                     │  • Data pipeline     │
                                     └──────────────────────┘
```

---

## Core Features

### 1. Room-Based Collaboration
- Create password-free rooms with 6-character codes
- Share via code or direct URL (`?room=XXXXXX`)
- Owner-managed join requests for access control
- Live member avatars with presence indicators

### 2. Dual Voting Interfaces

**Web:** Thumbnail property cards with thumbs-up/thumbs-down buttons and image carousels

**Mobile:** Full-screen swipe cards with Tinder-style gesture recognition:
- Swipe right → Like
- Swipe left → Dislike
- Swipe up → Super Like (3 per session)

### 3. Blend Algorithm
A client-side preference analysis engine that:
- Extracts a **7-dimensional feature vector** from each property (pet-friendly, parking, in-unit laundry, spacious, modern build, budget-friendly, more bedrooms)
- Computes each user's **taste vector** from their liked properties
- Calculates pairwise **cosine similarity** between all group members
- Produces an overall **group compatibility percentage**
- Generates a **radar chart** showing the group's collective priorities
- Optionally enhanced by **GPT-4o-mini** to generate natural-language explanations

### 4. Group Picks
- **Top 6** properties ranked by weighted vote score
- **AI Top 10** curated selection using LLM analysis of the group's taste profile
- Direct links to original listings

### 5. Interactive Map
- Mapbox GL integration with clustered property markers
- Default view centered on Irvine, CA (auto-fits to room's property bounds)
- Click markers to preview property details
- Color-coded pins by vote status

### 6. Scraping Pipeline
Multi-source data collection system:
- **Rent.com** — Real rental listings with rich amenity data
- **Apartments.com** — Southern California apartment listings
- **Zillow** — For-rent listings via headless browser
- **Redfin** — CSV import or live scraping
- **Generator** — Synthetic listings with realistic attributes for any city
- Produces ~600 web properties and 160 server listings across 60+ US cities

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Name-only auth** (no passwords) | Minimal friction for group onboarding — anyone can join in seconds. Production would add Firebase Auth. |
| **Client-side blend algorithm** | No server round-trip needed for analysis. Instant feedback as votes come in via Firestore real-time sync. |
| **Dual data paths** | Web uses Firestore directly (real-time). Mobile uses REST API + SSE (session-based swiping). Both write votes to the same Firestore collection. |
| **In-memory server sessions** | Lightweight for MVP. Sessions are ephemeral — restart clears them. Production would persist to Redis or Firestore. |
| **Open Firestore rules** | Development convenience. Production rules are documented in `docs/SCHEMA.md`. |
| **Optional AI** | GPT-4o-mini integration is gracefully degraded — all core features work without an OpenAI key. |

---

## Target Users

- **Roommate groups** searching for a shared apartment
- **Couples** aligning on a new home
- **Friend groups** relocating to the same city
- **Families** deciding between multiple housing options

---

## Project Structure

```
HomeBlend/
├── src/                    # React web frontend
│   ├── components/         #   UI components (Dashboard, RoomView, MapPanel, etc.)
│   ├── data/               #   Static property dataset (~603 listings)
│   └── lib/                #   Firebase config, blend algorithm, auth, LLM
├── apps/
│   └── mobile/             # React Native / Expo mobile app
│       └── src/
│           ├── components/  #   PropertyCard, OverlayLabel
│           ├── context/     #   AuthContext
│           ├── lib/         #   API client, config, storage, theme
│           └── screens/     #   Login, RoomCode, Swipe screens
├── server/                 # Express API server
│   └── src/
│       ├── routes/         #   REST endpoints (sessions, swipes, listings, etc.)
│       ├── scraper/        #   Multi-source data pipeline
│       ├── utils/          #   Blend engine, code generator, insights
│       └── data/           #   JSON datasets
├── packages/types/         # Shared TypeScript types (placeholder)
├── scripts/                # Utility scripts (Firestore seeding)
└── docs/                   # Project documentation
    ├── USER_WORKFLOW.md    #   End-to-end user flows
    ├── SCHEMA.md           #   Firestore schema reference
    ├── DATASET.md          #   Dataset & pipeline documentation
    └── PROJECT_DESCRIPTION.md  # This file
```

---

## Running the Project

```bash
# 1 — Install dependencies
npm install && cd server && npm install && cd ../apps/mobile && npm install && cd ../..

# 2 — Set environment variables
cp .env.example .env
# Fill in VITE_MAPBOX_TOKEN and optionally OPENAI_API_KEY

# 3 — Start everything
npm run dev          # Web frontend → http://localhost:5173
cd server && node src/index.js   # API server → http://localhost:3001
cd apps/mobile && npx expo start # Mobile → Expo Go

# 4 — (Optional) Seed data
cd server && npm run scrape -- --generate --limit 10
```

See the main [README.md](../README.md) for detailed setup instructions.

---

## Related Documentation

| Document | Description |
|---|---|
| [README.md](../README.md) | Quick start, scripts, and troubleshooting |
| [USER_WORKFLOW.md](USER_WORKFLOW.md) | Step-by-step user flows for web and mobile |
| [SCHEMA.md](SCHEMA.md) | Firestore collections and data models |
| [DATASET.md](DATASET.md) | Dataset schemas, scraping pipeline, and geographic coverage |
