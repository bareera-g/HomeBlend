/**
 * HomeBlend — Firebase Firestore (database only, no Auth/Storage/Analytics)
 * Name-only auth: user signs in with display name. If exists → join; if not → create.
 *
 * Collections:
 *   users/{userId}           — userId = normalized name
 *   rooms/{roomId}           — room metadata
 *   rooms/{roomId}/members/{userId}
 *   rooms/{roomId}/properties/{propertyId}
 *   rooms/{roomId}/votes/{propertyId}   — { userId: 1|-1 }
 *   rooms/{roomId}/join_requests/{userId}
 *   user_rooms/{userId}      — doc with { rooms: { roomId: joined_at } }
 *   room_codes/{code}        — doc with { roomId }
 *   saved_properties/{userId} — doc with { properties: { propertyId: saved_at } }
 */
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { app } from "./firebase-config.js";

let db;
try {
  db = getFirestore(app);
} catch (e) {
  console.error("[HomeBlend] Firebase getFirestore failed:", e.message);
}

export const isFirebaseReady = Boolean(db);

/** Test connectivity — returns { ok: true } or { ok: false, error: string } */
export async function testConnection() {
  if (!db) return { ok: false, error: "Firebase not initialized. Check your Firebase project configuration." };
  try {
    const testRef = doc(db, "users", "_connection_test");
    await Promise.race([
      getDoc(testRef),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Connection timeout (5s)")), 5000)),
    ]);
    return { ok: true };
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes("timeout")) return { ok: false, error: "Timeout: Firestore unreachable. Ensure Firestore is enabled in Firebase Console." };
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED")) return { ok: false, error: "Permission denied. Update Firestore rules in Firebase Console." };
    if (msg.includes("UNAVAILABLE") || msg.includes("unavailable")) return { ok: false, error: "Firestore unavailable. Check Firebase Console." };
    return { ok: false, error: msg };
  }
}

const AVATAR_COLORS = ["#A67C3D", "#5C8A6B", "#7B6FA0", "#C0624A", "#4A7EA0", "#8A6B5C"];
export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/** Normalize display name to a stable userId (lowercase, spaces → underscores) */
export function normalizeUserId(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "anonymous";
}

function guard() {
  if (!db) throw new Error("Firebase not configured.");
}

function withTimeout(ms, p) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Connection timeout")), ms))]);
}

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

let _schemaEnsured = false;

/** Ensure collections exist. Firestore creates on first write — no-op. */
export async function ensureSchema() {
  if (!db || _schemaEnsured) return;
  _schemaEnsured = true;
}

// ── Users (name-only) ──────────────────────────────────────────────────────
/** Get or create user by display name. Returns { id, display_name, avatar_color } */
export async function signInByName(displayName) {
  const name = String(displayName || "").trim();
  if (!name) throw new Error("Please enter your name.");
  const userId = normalizeUserId(name);
  const avatar = randomAvatarColor();
  const fallbackUser = { id: userId, display_name: name, avatar_color: avatar };

  if (!db) return fallbackUser;

  try {
    const userRef = doc(db, "users", userId);
    const snap = await withTimeout(5000, getDoc(userRef));
    if (snap.exists()) {
      const d = snap.data();
      return { id: userId, display_name: d.display_name || name, avatar_color: d.avatar_color || randomAvatarColor() };
    }
    await withTimeout(5000, setDoc(userRef, { display_name: name, avatar_color: avatar, createdAt: serverTimestamp() }));
    return { id: userId, display_name: name, avatar_color: avatar };
  } catch (err) {
    console.warn("[HomeBlend] Firebase signInByName failed, using local session:", err.message);
    return fallbackUser;
  }
}

/** Fetch user by id */
export async function fetchUser(userId) {
  guard();
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: userId, display_name: d.display_name, avatar_color: d.avatar_color || randomAvatarColor() };
}

// ── Saved Properties ───────────────────────────────────────────────────────
export async function fetchSavedPropertyIds(userId) {
  if (!db) return [];
  try {
    const snap = await withTimeout(5000, getDoc(doc(db, "saved_properties", userId)));
    if (!snap.exists()) return [];
    const data = snap.data().properties || {};
    return Object.keys(data).map(Number);
  } catch (e) {
    console.warn("[HomeBlend] fetchSavedPropertyIds failed:", e.message);
    return [];
  }
}

export async function saveProperty(userId, propertyId) {
  guard();
  const ref = doc(db, "saved_properties", userId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data().properties || {} : {};
  await setDoc(ref, { properties: { ...existing, [propertyId]: { saved_at: serverTimestamp() } } });
}

export async function unsaveProperty(userId, propertyId) {
  guard();
  const ref = doc(db, "saved_properties", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const props = { ...(snap.data().properties || {}) };
  delete props[propertyId];
  if (Object.keys(props).length === 0) await deleteDoc(ref);
  else await setDoc(ref, { properties: props });
}

// ── Rooms ───────────────────────────────────────────────────────────────────
export async function createRoom(name, userId, displayName, avatarColor) {
  guard();
  const code = genCode();
  const roomRef = doc(collection(db, "rooms"));
  const roomId = roomRef.id;

  const userRoomsRef = doc(db, "user_rooms", userId);
  const urSnap = await getDoc(userRoomsRef);
  const rooms = urSnap.exists() ? { ...(urSnap.data().rooms || {}), [roomId]: Date.now() } : { [roomId]: Date.now() };

  const batch = writeBatch(db);
  batch.set(roomRef, {
    name: name || "My Room",
    room_code: code,
    created_by: userId,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "rooms", roomId, "members", userId), {
    joined_at: Date.now(),
    role: "owner",
    display_name: displayName || "Owner",
    avatar_color: avatarColor || randomAvatarColor(),
  });
  batch.set(userRoomsRef, { rooms });
  batch.set(doc(db, "room_codes", code), { roomId });

  await batch.commit();
  return { id: roomId, name: name || "My Room", room_code: code, created_by: userId };
}

export async function fetchRoom(roomCode) {
  guard();
  const codeRef = doc(db, "room_codes", roomCode.toUpperCase());
  const codeSnap = await withTimeout(5000, getDoc(codeRef));
  const codeData = codeSnap.data();
  const roomId = codeData?.roomId;
  if (!roomId) return null;

  const roomSnap = await withTimeout(5000, getDoc(doc(db, "rooms", roomId)));
  if (!roomSnap.exists()) return null;
  return { id: roomId, ...roomSnap.data(), room_code: roomSnap.data().room_code };
}

export async function fetchUserRooms(userId) {
  if (!db) return [];
  try {
    const snap = await withTimeout(5000, getDoc(doc(db, "user_rooms", userId)));
    if (!snap.exists()) return [];
    const roomsData = snap.data().rooms || {};
    const roomIds = Object.keys(roomsData);

    const roomPromises = roomIds.map((rid) =>
      withTimeout(4000, getDoc(doc(db, "rooms", rid))).then((r) => (r?.exists() ? { id: rid, ...r.data(), room_code: r.data().room_code } : null))
    );
    const results = await Promise.all(roomPromises);
    const rooms = results.filter(Boolean);
    return rooms.sort((a, b) => (b.createdAt?.toMillis?.() || b.createdAt || 0) - (a.createdAt?.toMillis?.() || a.createdAt || 0));
  } catch (e) {
    console.warn("[HomeBlend] fetchUserRooms failed:", e.message);
    return [];
  }
}

export async function joinRoom(roomId, userId, displayName, avatarColor) {
  guard();
  const batch = writeBatch(db);
  batch.set(doc(db, "rooms", roomId, "members", userId), {
    joined_at: Date.now(),
    role: "member",
    display_name: displayName || "Member",
    avatar_color: avatarColor || randomAvatarColor(),
  });
  const userRoomsRef = doc(db, "user_rooms", userId);
  const urSnap = await getDoc(userRoomsRef);
  const rooms = urSnap.exists() ? { ...(urSnap.data().rooms || {}), [roomId]: Date.now() } : { [roomId]: Date.now() };
  batch.set(userRoomsRef, { rooms });
  await batch.commit();
}

export async function leaveRoom(roomId, userId) {
  guard();
  const batch = writeBatch(db);
  batch.delete(doc(db, "rooms", roomId, "members", userId));

  const userRoomsRef = doc(db, "user_rooms", userId);
  const snap = await getDoc(userRoomsRef);
  if (snap.exists()) {
    const rooms = { ...(snap.data().rooms || {}) };
    delete rooms[roomId];
    if (Object.keys(rooms).length === 0) batch.delete(userRoomsRef);
    else batch.set(userRoomsRef, { rooms });
  }
  await batch.commit();
}

export async function fetchMembers(roomId) {
  if (!db) return [];
  try {
    const snap = await withTimeout(5000, getDocs(collection(db, "rooms", roomId, "members")));
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        auth_user_id: d.id,
        display_name: v.display_name || "Member",
        avatar_color: v.avatar_color || "#A67C3D",
        role: v.role,
        joined_at: v.joined_at,
      };
    });
  } catch (e) {
    console.warn("[HomeBlend] fetchMembers failed:", e.message);
    return [];
  }
}

// ── Room Properties ─────────────────────────────────────────────────────────
export async function renameRoom(roomId, newName) {
  guard();
  await updateDoc(doc(db, "rooms", roomId), { name: newName || "My Room" });
}

export async function removeMember(roomId, userId) {
  guard();
  const batch = writeBatch(db);
  batch.delete(doc(db, "rooms", roomId, "members", userId));

  const userRoomsRef = doc(db, "user_rooms", userId);
  const snap = await getDoc(userRoomsRef);
  if (snap.exists()) {
    const rooms = { ...(snap.data().rooms || {}) };
    delete rooms[roomId];
    if (Object.keys(rooms).length === 0) batch.delete(userRoomsRef);
    else batch.set(userRoomsRef, { rooms });
  }
  await batch.commit();
}

export async function addPropertyToRoom(roomId, propertyId, userId) {
  guard();
  const pid = Number(propertyId);
  await setDoc(doc(db, "rooms", roomId, "properties", String(pid)), { added_by: userId, added_at: Date.now() });
}

export async function removePropertyFromRoom(roomId, propertyId) {
  guard();
  await deleteDoc(doc(db, "rooms", roomId, "properties", String(propertyId)));
}

export async function fetchRoomProperties(roomId) {
  if (!db) return [];
  try {
    const snap = await withTimeout(5000, getDocs(collection(db, "rooms", roomId, "properties")));
    return snap.docs.map((d) => ({
      property_id: Number(d.id),
      room_id: roomId,
      added_by: d.data().added_by,
    }));
  } catch (e) {
    console.warn("[HomeBlend] fetchRoomProperties failed:", e.message);
    return [];
  }
}

// ── Votes ──────────────────────────────────────────────────────────────────
export async function recordVote(roomId, userId, propertyId, vote) {
  guard();
  const pid = String(Number(propertyId));
  const voteRef = doc(db, "rooms", roomId, "votes", pid);

  if (vote === null) {
    const snap = await getDoc(voteRef);
    if (snap.exists()) {
      const data = { ...snap.data() };
      delete data[userId];
      if (Object.keys(data).length === 0) await deleteDoc(voteRef);
      else await setDoc(voteRef, data);
    }
    return;
  }
  const voteVal = vote === 1 || vote === "like" ? 1 : -1;
  await setDoc(voteRef, { [userId]: voteVal }, { merge: true });
}

export async function fetchVotes(roomId) {
  guard();
  const snap = await getDocs(collection(db, "rooms", roomId, "votes"));
  const votes = [];
  snap.docs.forEach((d) => {
    const users = d.data();
    for (const [uid, v] of Object.entries(users)) {
      if (v === 1 || v === -1) votes.push({ property_id: Number(d.id), user_id: uid, vote: v, room_id: roomId });
    }
  });
  return votes;
}

/** Firebase has no separate profile — user is the profile. Alias for compatibility. */
export async function ensureProfile(userId, displayName) {
  if (!userId) return { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  if (!db) return { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  try {
    const u = await withTimeout(4000, fetchUser(userId));
    return u || { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  } catch (e) {
    return { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  }
}

// ── Join Requests ───────────────────────────────────────────────────────────
export async function fetchJoinRequests(roomId) {
  guard();
  const snap = await getDocs(collection(db, "rooms", roomId, "join_requests"));
  const requests = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      user_id: d.id,
      display_name: v.display_name || null,
      status: v.status === "approved" ? "accepted" : v.status,
      created_at: v.created_at,
    };
  });
  // Fill in display_name from users collection for requests that lack it
  const missing = requests.filter((r) => !r.display_name && r.user_id);
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (r) => {
        const u = await fetchUser(r.user_id);
        if (u) r.display_name = u.display_name;
      })
    );
  }
  return requests;
}

export async function requestToJoin(roomId, userId, displayName) {
  guard();
  await setDoc(doc(db, "rooms", roomId, "join_requests", userId), {
    status: "pending",
    display_name: displayName || "User",
    created_at: Date.now(),
  });
  return "pending";
}

/** roomId, userId (the requester), accept */
export async function respondToJoinRequest(roomId, userId, accept) {
  guard();
  await updateDoc(doc(db, "rooms", roomId, "join_requests", userId), { status: accept ? "accepted" : "declined" });
  if (accept) await joinRoom(roomId, userId, null, null);
  return accept ? "accepted" : "declined";
}

// ── Realtime (Firestore onSnapshot) ──────────────────────────────────────────

/** Delete a room and all its subcollections. Owner-only; caller should verify. */
export async function deleteRoom(roomId) {
  guard();
  // 1. Fetch all members so we can clean each user's user_rooms doc
  const membersSnap = await getDocs(collection(db, "rooms", roomId, "members"));
  const memberIds = membersSnap.docs.map(d => d.id);

  // 2. Fetch the room to get the room_code for cleanup
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  const roomCode = roomSnap.exists() ? roomSnap.data().room_code : null;

  // 3. Delete subcollections: members, properties, votes, join_requests
  const subcolNames = ["members", "properties", "votes", "join_requests"];
  for (const sub of subcolNames) {
    const snap = await getDocs(collection(db, "rooms", roomId, sub));
    if (snap.docs.length > 0) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 4. Remove room from each member's user_rooms
  for (const uid of memberIds) {
    const urRef = doc(db, "user_rooms", uid);
    const urSnap = await getDoc(urRef);
    if (urSnap.exists()) {
      const rooms = { ...(urSnap.data().rooms || {}) };
      delete rooms[roomId];
      if (Object.keys(rooms).length === 0) await deleteDoc(urRef);
      else await setDoc(urRef, { rooms });
    }
  }

  // 5. Delete room_code mapping
  if (roomCode) {
    await deleteDoc(doc(db, "room_codes", roomCode)).catch(() => {});
  }

  // 6. Delete the room document itself
  await deleteDoc(doc(db, "rooms", roomId));
}

export function subscribeToRoom(roomId, { onVotes, onProperties, onMembers } = {}) {
  if (!db) return null;
  const unsubs = [];
  if (onVotes) {
    unsubs.push(
      onSnapshot(collection(db, "rooms", roomId, "votes"), () => {
        if (onVotes) onVotes();
      })
    );
  }
  if (onProperties) {
    unsubs.push(
      onSnapshot(collection(db, "rooms", roomId, "properties"), () => {
        if (onProperties) onProperties();
      })
    );
  }
  if (onMembers) {
    unsubs.push(
      onSnapshot(collection(db, "rooms", roomId, "members"), () => {
        if (onMembers) onMembers();
      })
    );
  }
  return () => unsubs.forEach((f) => f());
}

export function unsubscribeFromRoom(unsub) {
  if (typeof unsub === "function") unsub();
}
