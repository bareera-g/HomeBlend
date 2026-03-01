# Firebase Firestore Setup for HomeBlend

**Firestore only** — no Realtime Database, Auth, Storage, or Analytics.

## Quick checklist

1. Go to [Firebase Console](https://console.firebase.google.com/) → project `homeblend-5192f`
2. **Build** → **Firestore Database** → **Create database** (if prompted)
3. Choose **Start in test mode** (or use the rules below)
4. Select a region (e.g. `nam5` / us-central)
5. Deploy rules: `firebase deploy --only firestore` (with `firestore.rules` in your project)

## Firestore rules

In Firebase Console → Firestore Database → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Or deploy from the project:

```bash
firebase deploy --only firestore
```

(Make sure `firestore.rules` exists in your Firebase project directory.)

## Collections structure

- `users/{userId}` — user profile (display_name, avatar_color)
- `rooms/{roomId}` — room metadata (name, room_code, created_by)
- `rooms/{roomId}/members/{userId}` — room members
- `rooms/{roomId}/properties/{propertyId}` — properties in room
- `rooms/{roomId}/votes/{propertyId}` — votes per property
- `rooms/{roomId}/join_requests/{userId}` — join requests
- `user_rooms/{userId}` — doc with `{ rooms: { roomId: joined_at } }`
- `room_codes/{code}` — doc with `{ roomId }`
- `saved_properties/{userId}` — doc with `{ properties: { propertyId: saved_at } }`

## Authentication

HomeBlend uses **name-only** sign-in. User identity is stored in Firestore under `users/{normalizedName}`. No Firebase Auth is required.
