/**
 * HomeBlend Mobile — API layer.
 *
 * Room/vote/member operations → Firebase Firestore (same DB as web app).
 * Listing details → Express server (serves listing.json data by ID).
 */
import API_URL from './config';
import {
  fetchRoomPropertyIds,
  fetchMyVotedIds,
  fetchMyVoteMap,
} from './firebase';

// Re-export Firestore operations for convenience
export {
  fetchRoom,
  joinRoom,
  isMember,
  fetchMembers,
  fetchRoomPropertyIds,
  recordVote,
  fetchVotes,
  fetchMyVotedIds,
  fetchMyVoteMap,
  onVotesChanged,
  onMembersChanged,
  onPropertiesChanged,
} from './firebase';

/** Wrapper with timeout + better error messages for Express calls. */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — is the server running?');
    }
    throw new Error(`Network error — check that the server is running at ${API_URL}`);
  }
}

/**
 * Fetch listing details from Express by their IDs.
 * Returns array of listing objects.
 */
export async function getListingsByIds(ids) {
  if (!ids.length) return [];
  // Batch into chunks of 50 to avoid URL length limits
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }
  const results = [];
  for (const chunk of chunks) {
    const res = await apiFetch(`${API_URL}/api/listings?ids=${chunk.join(',')}`);
    if (!res.ok) throw new Error('Failed to fetch listings');
    const data = await res.json();
    results.push(...data.listings);
  }
  return results;
}

/**
 * Load room properties with full listing details.
 * 1. Fetch property IDs from Firestore
 * 2. Fetch already-voted IDs for current user from Firestore
 * 3. Fetch listing details from Express for un-voted properties
 * Returns { listings, swipedListings, votedIds, totalInRoom }
 */
export async function loadRoomListings(roomId, userId) {
  const [propertyMeta, votedIds, voteMap] = await Promise.all([
    fetchRoomPropertyIds(roomId),
    fetchMyVotedIds(roomId, userId),
    fetchMyVoteMap(roomId, userId),
  ]);

  const allIds = propertyMeta.map((p) => p.property_id);

  // Split into unseen vs already-swiped
  const unvotedIds = allIds.filter((id) => !votedIds.has(id));
  const swipedIds = allIds.filter((id) => votedIds.has(id));

  // Fetch both sets in parallel
  const [listings, swipedListings] = await Promise.all([
    unvotedIds.length > 0 ? getListingsByIds(unvotedIds) : [],
    swipedIds.length > 0 ? getListingsByIds(swipedIds) : [],
  ]);

  return { listings, swipedListings, votedIds, voteMap, totalInRoom: propertyMeta.length };
}
