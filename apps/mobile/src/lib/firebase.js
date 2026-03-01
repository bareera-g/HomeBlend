/**
 * HomeBlend Mobile — Firebase Firestore operations.
 * Mirrors the web app's firebase.js for room/vote/user operations.
 *
 * Collections (same as web):
 *   users/{userId}              — userId = normalized name
 *   rooms/{roomId}              — room metadata
 *   rooms/{roomId}/members/{userId}
 *   rooms/{roomId}/properties/{propertyId}
 *   rooms/{roomId}/votes/{propertyId}  — { userId: 1|-1 }
 *   room_codes/{code}           — { roomId }
 *   user_rooms/{userId}         — { rooms: { roomId: joined_at } }
 */
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { app } from './firebase-config';

let db;
try {
  db = getFirestore(app);
} catch (e) {
  console.error('[HomeBlend] Firebase getFirestore failed:', e.message);
}

export const isFirebaseReady = Boolean(db);

const AVATAR_COLORS = ['#A67C3D', '#5C8A6B', '#7B6FA0', '#C0624A', '#4A7EA0', '#8A6B5C'];

function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/** Normalize display name → stable user ID (matches web app logic exactly). */
export function normalizeUserId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '') || 'anonymous';
}

function guard() {
  if (!db) throw new Error('Firebase not configured.');
}

function withTimeout(ms, p) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Connection timeout')), ms)),
  ]);
}

// ── Users (name-only auth, same as web) ─────────────────────────────────────

/**
 * Get or create user by display name.
 * Returns { id, display_name, avatar_color }.
 */
export async function signInByName(displayName) {
  const name = String(displayName || '').trim();
  if (!name) throw new Error('Please enter your name.');
  const userId = normalizeUserId(name);
  const avatar = randomAvatarColor();
  const fallback = { id: userId, display_name: name, avatar_color: avatar };

  if (!db) return fallback;

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await withTimeout(5000, getDoc(userRef));
    if (snap.exists()) {
      const d = snap.data();
      return {
        id: userId,
        display_name: d.display_name || name,
        avatar_color: d.avatar_color || randomAvatarColor(),
      };
    }
    await withTimeout(5000, setDoc(userRef, {
      display_name: name,
      avatar_color: avatar,
      createdAt: serverTimestamp(),
    }));
    return fallback;
  } catch (err) {
    console.warn('[HomeBlend] Firebase signInByName failed, using local session:', err.message);
    return fallback;
  }
}

// ── Rooms ───────────────────────────────────────────────────────────────────

/**
 * Look up a room by its short code.
 * Returns { id, name, room_code, created_by } or null.
 */
export async function fetchRoom(roomCode) {
  guard();
  const code = roomCode.toUpperCase();
  const codeRef = doc(db, 'room_codes', code);
  const codeSnap = await withTimeout(5000, getDoc(codeRef));
  const roomId = codeSnap.data()?.roomId;
  if (!roomId) return null;

  const roomSnap = await withTimeout(5000, getDoc(doc(db, 'rooms', roomId)));
  if (!roomSnap.exists()) return null;
  return { id: roomId, ...roomSnap.data(), room_code: roomSnap.data().room_code };
}

/**
 * Join a room as a member (same as web app's joinRoom).
 */
export async function joinRoom(roomId, userId, displayName, avatarColor) {
  guard();
  const batch = writeBatch(db);

  batch.set(doc(db, 'rooms', roomId, 'members', userId), {
    joined_at: Date.now(),
    role: 'member',
    display_name: displayName || 'Member',
    avatar_color: avatarColor || randomAvatarColor(),
  });

  const userRoomsRef = doc(db, 'user_rooms', userId);
  const urSnap = await getDoc(userRoomsRef);
  const rooms = urSnap.exists()
    ? { ...(urSnap.data().rooms || {}), [roomId]: Date.now() }
    : { [roomId]: Date.now() };
  batch.set(userRoomsRef, { rooms });

  await batch.commit();
}

/**
 * Check if user is already a member of the room.
 */
export async function isMember(roomId, userId) {
  guard();
  const memberSnap = await withTimeout(5000, getDoc(doc(db, 'rooms', roomId, 'members', userId)));
  return memberSnap.exists();
}

/**
 * Get all members of a room.
 */
export async function fetchMembers(roomId) {
  guard();
  const snap = await withTimeout(5000, getDocs(collection(db, 'rooms', roomId, 'members')));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

// ── Properties ──────────────────────────────────────────────────────────────

/**
 * Get property IDs in a room.
 * Returns [{ property_id, added_by }]
 */
export async function fetchRoomPropertyIds(roomId) {
  guard();
  const snap = await withTimeout(5000, getDocs(collection(db, 'rooms', roomId, 'properties')));
  return snap.docs.map((d) => ({
    property_id: Number(d.id),
    added_by: d.data().added_by,
  }));
}

// ── Votes ───────────────────────────────────────────────────────────────────

/**
 * Record a vote (same as web app's recordVote).
 * vote: 1 (like), -1 (dislike), null (remove)
 */
export async function recordVote(roomId, userId, propertyId, vote) {
  guard();
  const pid = String(Number(propertyId));
  const voteRef = doc(db, 'rooms', roomId, 'votes', pid);

  if (vote === null) {
    const snap = await getDoc(voteRef);
    if (snap.exists()) {
      const data = { ...snap.data() };
      delete data[userId];
      if (Object.keys(data).length === 0) {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(voteRef);
      } else {
        await setDoc(voteRef, data);
      }
    }
    return;
  }

  const voteVal = vote === 1 || vote === 'like' ? 1 : -1;
  await setDoc(voteRef, { [userId]: voteVal }, { merge: true });
}

/**
 * Fetch all votes for a room.
 * Returns [{ property_id, user_id, vote }]
 */
export async function fetchVotes(roomId) {
  guard();
  const snap = await getDocs(collection(db, 'rooms', roomId, 'votes'));
  const votes = [];
  snap.docs.forEach((d) => {
    const users = d.data();
    for (const [uid, v] of Object.entries(users)) {
      if (v === 1 || v === -1) {
        votes.push({ property_id: Number(d.id), user_id: uid, vote: v, room_id: roomId });
      }
    }
  });
  return votes;
}

/**
 * Get vote counts for the current user in a room.
 * Returns Set of property IDs the user has already voted on.
 */
export async function fetchMyVotedIds(roomId, userId) {
  const votes = await fetchVotes(roomId);
  const ids = new Set();
  for (const v of votes) {
    if (v.user_id === userId) ids.add(v.property_id);
  }
  return ids;
}

/**
 * Get the user's vote value for each property in a room.
 * Returns Map<propertyId, 1|-1>
 */
export async function fetchMyVoteMap(roomId, userId) {
  const votes = await fetchVotes(roomId);
  const map = new Map();
  for (const v of votes) {
    if (v.user_id === userId) map.set(v.property_id, v.vote);
  }
  return map;
}

// ── Live Listeners ──────────────────────────────────────────────────────────

/**
 * Subscribe to real-time vote updates.
 * Returns unsubscribe function.
 */
export function onVotesChanged(roomId, callback) {
  if (!db) return () => {};
  return onSnapshot(collection(db, 'rooms', roomId, 'votes'), () => {
    callback();
  });
}

/**
 * Subscribe to real-time member updates.
 * Returns unsubscribe function.
 */
export function onMembersChanged(roomId, callback) {
  if (!db) return () => {};
  return onSnapshot(collection(db, 'rooms', roomId, 'members'), () => {
    callback();
  });
}

/**
 * Subscribe to real-time property updates.
 * Returns unsubscribe function.
 */
export function onPropertiesChanged(roomId, callback) {
  if (!db) return () => {};
  return onSnapshot(collection(db, 'rooms', roomId, 'properties'), () => {
    callback();
  });
}
