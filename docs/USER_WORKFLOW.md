# HomeBlend — User Workflow

Complete end-to-end user flows for both the web and mobile apps.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Dashboard (Web)](#2-dashboard-web)
3. [Room Creation](#3-room-creation)
4. [Joining a Room](#4-joining-a-room)
5. [Room View (Web)](#5-room-view-web)
6. [Voting on Properties](#6-voting-on-properties)
7. [Blend Analysis](#7-blend-analysis)
8. [Group Picks](#8-group-picks)
9. [Mobile Flow](#9-mobile-flow)
10. [Session-Based Swiping (Server)](#10-session-based-swiping-server)
11. [Real-Time Sync](#11-real-time-sync)

---

## 1. Authentication

HomeBlend uses **name-only identity** — there are no passwords or OAuth providers.

### Web

1. User lands on `/auth` (the `AuthPage` component).
2. User enters a **display name** (e.g., "Abhi Patel").
3. The name is normalized to a stable `userId`:
   - Lowercased
   - Spaces → underscores
   - Non-alphanumeric characters stripped
   - Example: `"Abhi Patel"` → `"abhi_patel"`
4. **If `users/{userId}` exists** in Firestore → sign in, return existing profile.
5. **If not** → create a new doc with `display_name`, random `avatar_color`, `createdAt`.
6. The user object is saved to `localStorage` under key `homeblend_user`.
7. User is redirected to `/dashboard`.

### Mobile

1. User opens the app and sees the `LoginScreen`.
2. Enters a display name → same normalization + Firestore lookup.
3. User object saved to `AsyncStorage` under key `homeblend_user`.
4. Navigation switches to `RoomCodeScreen`.

### Sign Out

- Web: clears `localStorage`, redirects to `/auth`.
- Mobile: clears `AsyncStorage`, navigation resets to `LoginScreen`.

---

## 2. Dashboard (Web)

**Route:** `/dashboard` — the `Dashboard` component.

### On Load

1. Fetches user profile via `ensureProfile()`.
2. Fetches user's rooms from `user_rooms/{userId}` → `rooms` field lists room IDs + join timestamps.
3. For each room, fetches member count + property count (parallel).
4. Fetches saved property IDs from `saved_properties/{userId}`.
5. Shows a shimmer skeleton with the HouseLoader animation until data arrives.

### Layout

```
┌────────────────────────────────────────────────────────┐
│  Logo   City Picker   Filters   Search    Avatar Menu  │
├──────────────┬────────────────────┬────────────────────┤
│              │                    │                     │
│  Property    │   Map Panel        │   Rooms Sidebar     │
│  Grid        │   (Mapbox GL)      │   • Your Rooms      │
│  (scrollable)│                    │   • + Create Room    │
│              │                    │   • Join by Code     │
│              │                    │                     │
└──────────────┴────────────────────┴────────────────────┘
```

### Property Discovery

- **Filters:** Category (All / Apartment / Condo / Townhome / Single Family), price range slider, beds, baths, pet-friendly, parking, in-unit laundry.
- **Sort:** Default, price asc/desc, newest, largest.
- **City picker:** Derived from all property locations.
- **Save:** Click the heart icon on any card → saved to `saved_properties/{userId}` in Firestore.
- **Expand:** Click a card to open `PropertyExpandModal` with full image gallery, amenities, AI overview, listing link.

### Drag-to-Room

1. **Hold & drag** any property card.
2. A drag ghost follows the cursor.
3. Drop onto a room card in the sidebar.
4. The property is added to that room via `addPropertyToRoom()`.
5. Room card briefly flashes green to confirm.

---

## 3. Room Creation

### From Dashboard

1. Click **"+ Create Room"** button in the sidebar (or the prominent "+" card).
2. A modal appears with a name input (default: "My Room").
3. Optionally triggered by dragging a property onto the "+" card.
4. Click **"Create Room"** → calls `createRoom()`:
   - Creates `rooms/{roomId}` doc with name, generated 6-char code, owner.
   - Creates `room_codes/{code}` → `{ roomId }` mapping.
   - Creates `rooms/{roomId}/members/{userId}` with role `"owner"`.
   - Updates `user_rooms/{userId}` with the new room.
5. Modal shows the room code for sharing.
6. If a property was dragged, it is auto-added to the new room.

### Room Code

- 6 uppercase alphanumeric characters (e.g., `K7M2PX`).
- Used by other users to join.

---

## 4. Joining a Room

### Web — By Code

1. In the dashboard sidebar, enter a 6-character code in the "Join" input.
2. System looks up `room_codes/{code}` → gets `roomId`.
3. Fetches the room doc to verify it exists.
4. Check if user is already a member:
   - **If yes** → navigate to room.
   - **If no** → either auto-join (open rooms) or submit a join request.
5. On join: creates `rooms/{roomId}/members/{userId}`, updates `user_rooms/{userId}`.

### Web — By URL

1. Navigate directly to `/room/:roomCode`.
2. `RoomView` resolves the code, checks membership.
3. Non-members see the `JoinGate` component → "Request Access" or "Join Room."

### Web — Join Requests

1. Non-member clicks "Request Access" → creates `rooms/{roomId}/join_requests/{userId}` with status `"pending"`.
2. Room owner sees pending requests in the `JoinRequestsPanel`.
3. Owner can **Accept** (status → `"accepted"`, user added as member) or **Decline** (status → `"declined"`).

### Mobile

1. On `RoomCodeScreen`, user enters a 6-character code.
2. Looks up room via `fetchRoom()`.
3. Checks membership via `isMember()`.
4. If not a member → calls `joinRoom()`.
5. Saves session (room code + room ID) to AsyncStorage.
6. Navigates to `SwipeScreen`.

---

## 5. Room View (Web)

**Route:** `/room/:roomCode` — the `RoomView` component.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Back   Room Name (editable by owner)   Members   │
├─────────────┬───────────────────────────────────────┤
│             │                                        │
│  Tab Bar    │  Content Area                          │
│  • Map      │  (varies by selected tab)              │
│  • Blend    │                                        │
│  • Picks    │                                        │
│             │                                        │
├─────────────┴───────────────────────────────────────┤
│  Property List (horizontal scroll)                   │
│  [Card] [Card] [Card] [+Add]                        │
└─────────────────────────────────────────────────────┘
```

### Tabs

| Tab | Component | Description |
|---|---|---|
| **Map** | `MapPanel` | Interactive Mapbox map with property markers, convex hull highlight |
| **Blend** | `BlendPanel` | Radar chart, compatibility matrix, per-member insights |
| **Picks** | `GroupPicksPanel` | AI-curated top 10 properties from the full catalog |

### Room Members

- Owner sees the member list with remove buttons.
- Owner can click the room name to rename it.
- Owner can delete the room entirely.
- Members see avatars with colored dots.

### Add Properties

- Click the **"+ Add"** card at the end of the property list.
- Opens `AddPropertiesDrawer` — a side panel with the full property catalog.
- Filter by "All" or "Saved Only."
- Click a property → adds it to the room.
- Or drag from the Dashboard directly.

---

## 6. Voting on Properties

### Web (Room View)

1. Each property card in a room shows **Like** (thumbs up) and **Dislike** (thumbs down) buttons.
2. Clicking Like → writes `{ [userId]: 1 }` to `rooms/{roomId}/votes/{propertyId}` (merge).
3. Clicking Dislike → writes `{ [userId]: -1 }`.
4. Clicking the same button again → removes the user's vote (deletes the field).
5. Vote counts and a `VoteProgressBar` show real-time totals.

### Mobile (Swipe Screen)

1. Properties appear as full-screen swipe cards.
2. **Swipe right** = Like → records `{ [userId]: 1 }` in Firestore votes.
3. **Swipe left** = Dislike → records `{ [userId]: -1 }`.
4. **Swipe up** = Super Like → records `{ [userId]: 2 }` (max 3 per session).
5. `OverlayLabel` shows "LIKE" / "NOPE" / "SUPER" as the card moves.
6. Once all properties are swiped, shows a completion screen.

### Vote Merge Semantics

Votes are stored as a flat map: `{ userId1: 1, userId2: -1, userId3: 1 }`. Firestore `setDoc` with `{ merge: true }` ensures each user's vote is independent.

---

## 7. Blend Analysis

**Tab: Blend** in Room View → `BlendPanel` component.

### How It Works

1. Collects all votes for the room's properties.
2. For each member, `computeTasteVector()` extracts binary feature preferences from their liked properties:
   - `petFriendly`, `parking`, `inUnitLaundry`, `highSqft` (≥ 1200), `newBuild` (≥ 2015), `budgetFriendly` (≤ $3200), `moreBeds` (≥ 3)
3. Computes **pairwise compatibility** via cosine similarity on taste vectors.
4. **Group compatibility** = average of all unique pair scores.
5. Detects **conflicts** where one user scores > 0.6 and another < 0.3 on the same feature.
6. Ranks properties by net votes (likes − dislikes).

### Display

- **Radar chart** — each member's taste vector plotted on axes.
- **Compatibility matrix** — pairwise % values with color coding.
- **Group compatibility** — overall % with contextual label (e.g., "Great match!").
- **Per-member insights** — bullet points about each person's preferences.
- **Conflict callouts** — flagged disagreements between members.
- **Top ranked properties** — ordered by group consensus.

### AI Enhancement (Optional)

If `OPENAI_API_KEY` is set:
- `generateBlendAnalysis()` sends vote data to GPT-4o-mini.
- Returns narrative-style per-member insights, compatibility commentary, top pick rationale.
- LLM calls are proxied server-side through Vite's `openaiProxyPlugin()` — the key never reaches the browser.

---

## 8. Group Picks

**Tab: Picks** in Room View → `GroupPicksPanel` component.

### How It Works

1. Scores all room properties by net votes.
2. Selects the **top 6** for detailed per-property analysis.
3. From the full 500+ property catalog, selects 65 candidates across diverse locations.

### Without AI

- Shows top-scored properties ranked by vote count.
- Basic summary (beds, baths, price, location).

### With AI (`OPENAI_API_KEY` set)

1. `generateGroupPicksWithOverview()` sends member profiles, votes, and 65 candidate properties to GPT-4o-mini.
2. AI selects the **10 best picks** tailored to the group's combined preferences.
3. Returns:
   - **Common ground overview** — what the group agrees on.
   - **Per-pick analysis** — why each property works, with per-member personalized notes.
4. `generatePicksAnalysis()` provides detailed breakdown of the top 6 room properties:
   - Narrative description.
   - Per-member "why they'd love it" / "potential concern."

---

## 9. Mobile Flow

### End-to-End

```
Login Screen          Room Code Screen        Swipe Screen
┌──────────┐         ┌──────────────┐        ┌─────────────────┐
│           │         │              │        │  [Property Card] │
│  "Your    │  ───▶   │  Enter room  │  ───▶  │                 │
│   Name"   │         │  code:       │        │    ← NOPE       │
│           │         │  [______]    │        │       LIKE →     │
│  [Enter]  │         │  [Join]      │        │       SUPER ↑    │
│           │         │              │        │                 │
└──────────┘         └──────────────┘        │  Members: 3     │
                                              │  Votes: 12/20   │
                                              └─────────────────┘
```

### Swipe Screen Detail

1. **Loads properties:** Fetches property IDs from Firestore room, then fetches full listing details from Express `/api/listings?ids=...`.
2. **Separates voted/unvoted:** Only shows cards the user hasn't voted on yet.
3. **Card display:** Image carousel, price, beds/baths/sqft, location, category badge.
4. **Gesture handling:** Custom `PanResponder` with spring animations:
   - Horizontal > threshold → like/dislike
   - Vertical up > threshold → super like
5. **Live counters:** Real-time member count and vote totals via Firestore `onSnapshot`.
6. **Session persistence:** Room code saved in AsyncStorage — reloading the app returns to the same session.
7. **Leave:** Alert confirmation → clears session → back to Room Code screen.

---

## 10. Session-Based Swiping (Server)

An alternative workflow managed entirely by the Express server (used for the session-based API flow).

### Lifecycle

```
CREATE → LOBBY → SET CONSTRAINTS → SWIPING → RESULTS
```

1. **Create session** — `POST /api/sessions` → returns `{ sessionCode }`.
2. **Join** — `POST /api/sessions/:code/join` with `{ name, avatarColor }` → returns `{ userId }`.
3. **Set constraints** — `POST /api/sessions/:code/constraints` with `{ rentOrBuy, budgetMin, budgetMax, bedsMin, bathsMin, location, hardNo[] }`.
4. **Start swiping** — `POST /api/sessions/:code/status` body `{ status: "SWIPING" }`.
5. **Fetch listings** — `GET /api/sessions/:code/listings?userId=...&cursor=0&limit=10` → paginated, user-filtered.
6. **Submit swipe** — `POST /api/sessions/:code/swipe` with `{ userId, listingId, vote }` where vote = `YES` | `NO` | `MAYBE` | `SUPERLIKE`.
7. **Mark ready** — `POST /api/sessions/:code/ready` with `{ userId, isReady: true }`.
8. **Results** — `POST /api/sessions/:code/status` body `{ status: "RESULTS" }`.
9. **Leaderboard** — `GET /api/sessions/:code/leaderboard?limit=10`.
10. **Blend** — `GET /api/sessions/:code/blend` → full taste vectors, compatibility matrix, group %, conflicts, insights.

### Real-Time Updates (SSE)

Clients connect to `GET /api/sessions/:code/stream`:
- Receives `connected` event on open.
- Receives `update` events when any swipe, ready, or status change occurs.
- Payload: `{ type, data: { status, userCount, totalSwipes, users[] }, ts }`.

---

## 11. Real-Time Sync

HomeBlend uses two complementary real-time systems:

### Firestore `onSnapshot` (Room-Level)

Used by both web and mobile for room data:

| Collection Listened | Trigger | Action |
|---|---|---|
| `rooms/{roomId}/votes` | Any vote added/changed/removed | Re-fetch all votes for the room |
| `rooms/{roomId}/properties` | Property added/removed | Re-fetch property list |
| `rooms/{roomId}/members` | Member joined/left/removed | Re-fetch member list |

**Web:** `subscribeToRoom(roomId, { onVotes, onProperties, onMembers })` — starts three `onSnapshot` listeners, returns an unsubscribe function.

**Mobile:** Individual `onSnapshot` calls in `SwipeScreen` for votes, members, and properties.

### Server-Sent Events (Session-Level)

Used by session-based swiping:

| Event | When | Data |
|---|---|---|
| `connected` | Client connects | `{ sessionCode }` |
| `update` | Swipe / ready / status change | `{ type, data: { status, userCount, totalSwipes, users }, ts }` |

Clients receive `update` events via `EventSource` or `react-native-event-source`. The server broadcasts to all SSE clients for a given session code after every mutation.

---

## Summary Flow Diagram

```
User opens app
     │
     ▼
┌─────────────┐     name     ┌───────────┐
│  Auth Page  │────────────▶│ Firestore │
│ (name only) │◀────profile──│  users/   │
└──────┬──────┘              └───────────┘
       │
       ▼
┌──────────────┐  create/join  ┌───────────┐
│  Dashboard   │──────────────▶│ Firestore │
│  • Rooms     │◀──onSnapshot──│  rooms/   │
│  • Properties│               │ members/  │
│  • Map       │               │  votes/   │
│  • Filters   │               └───────────┘
└──────┬───────┘
       │ open room
       ▼
┌──────────────┐  vote    ┌───────────┐
│  Room View   │─────────▶│ Firestore │
│  • Vote      │◀─realtime│  votes/   │
│  • Blend     │          └───────────┘
│  • Picks     │
└──────────────┘
```
