# HomeBlend Mobile

A Tinder-style React Native app for swiping through properties with your group.

## Setup

```bash
cd apps/mobile
npm install
npx expo start
```

## Configuration

Edit `src/lib/config.js` to set the API URL:

- **Android Emulator**: `http://10.0.2.2:3001`
- **iOS Simulator**: `http://localhost:3001`
- **Physical Device**: `http://<your-lan-ip>:3001` (e.g. `http://192.168.1.100:3001`)

## How It Works

1. **Login** — Enter your display name (no password needed, same identity system as the web app)
2. **Join Room** — Enter the session code created by the host on the web app
3. **Swipe** — Swipe right to LIKE, left to NOPE, or tap the star for SUPER LIKE (3 per session)
4. **Live Updates** — See real-time swipe counts and online users via SSE

## Architecture

- Uses the **same Express server** (`server/`) running on port 3001
- Same in-memory session/swipe engine as the web app
- SSE (Server-Sent Events) for real-time updates
- React Navigation for screen flow
- Custom `PanResponder` Tinder-style swipe animation

## Requirements

- Node.js 18+
- Expo CLI (`npx expo`)
- Express server running (`cd server && node src/index.js`)
- iOS Simulator / Android Emulator / Expo Go on physical device
