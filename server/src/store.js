/**
 * In-memory data store for HomeBlend.
 * Maps keyed by session code for fast lookup.
 */

const sessions = new Map();   // code -> Session
const users = new Map();      // userId -> User
const swipes = new Map();     // `${sessionCode}:${userId}:${listingId}` -> Swipe
const sseClients = new Map(); // sessionCode -> Set<res>

/* ── helpers ─────────────────────────────────────────────── */

function getSessionByCode(code) {
  return sessions.get(code.toUpperCase()) || null;
}

function getUsersForSession(code) {
  const result = [];
  for (const u of users.values()) {
    if (u.sessionCode === code.toUpperCase()) result.push(u);
  }
  return result;
}

function getSwipesForSession(code) {
  const result = [];
  const prefix = `${code.toUpperCase()}:`;
  for (const [key, swipe] of swipes.entries()) {
    if (key.startsWith(prefix)) result.push(swipe);
  }
  return result;
}

function getSwipesForUser(code, userId) {
  const result = [];
  const prefix = `${code.toUpperCase()}:${userId}:`;
  for (const [key, swipe] of swipes.entries()) {
    if (key.startsWith(prefix)) result.push(swipe);
  }
  return result;
}

function swipeKey(code, userId, listingId) {
  return `${code.toUpperCase()}:${userId}:${listingId}`;
}

module.exports = {
  sessions,
  users,
  swipes,
  sseClients,
  getSessionByCode,
  getUsersForSession,
  getSwipesForSession,
  getSwipesForUser,
  swipeKey,
};
