/**
 * Leaderboard + Blend routes.
 */
const { Router } = require('express');
const {
  getSessionByCode,
  getUsersForSession,
  getSwipesForSession,
  getSwipesForUser,
} = require('../store');
const listings = require('../data/listings.json');
const {
  buildTasteVector,
  computeCompatibilityMatrix,
  computeGroupCompatibility,
  detectConflicts,
  scoreListing,
} = require('../utils/blendEngine');
const { generateUserInsights, generateGroupInsights } = require('../utils/insights');

const router = Router();

/** Index listings by ID for quick lookup */
const listingsById = {};
for (const l of listings) listingsById[l.id] = l;

/* ── GET /api/sessions/:code/leaderboard ────────────────── */
router.get('/:code/leaderboard', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sessionUsers = getUsersForSession(session.code);
  const allSwipes = getSwipesForSession(session.code);
  const totalUsers = sessionUsers.length;

  // Group swipes by listing
  const swipesByListing = {};
  for (const s of allSwipes) {
    if (!swipesByListing[s.listingId]) swipesByListing[s.listingId] = [];
    swipesByListing[s.listingId].push(s);
  }

  // Score each listing
  const listingIds = Object.keys(swipesByListing);
  const scored = listingIds
    .map((id) => {
      const score = scoreListing(id, swipesByListing, totalUsers);
      const listing = listingsById[id];
      return listing ? { ...score, listing } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore);

  const limit = Number.parseInt(req.query.limit, 10) || 10;

  res.json({
    leaderboard: scored.slice(0, limit),
    totalListings: scored.length,
    totalUsers,
  });
});

/* ── GET /api/sessions/:code/blend ──────────────────────── */
router.get('/:code/blend', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sessionUsers = getUsersForSession(session.code);
  if (sessionUsers.length === 0) {
    return res.status(400).json({ error: 'No users in session' });
  }

  // Build taste vectors per user
  const tasteVectors = {};
  const userNames = {};
  const userInsights = {};

  for (const user of sessionUsers) {
    const userSwipes = getSwipesForUser(session.code, user.id);
    const yesListings = userSwipes
      .filter((s) => s.vote === 'YES' || s.vote === 'SUPERLIKE')
      .map((s) => listingsById[s.listingId])
      .filter(Boolean);
    const noListings = userSwipes
      .filter((s) => s.vote === 'NO')
      .map((s) => listingsById[s.listingId])
      .filter(Boolean);

    tasteVectors[user.id] = buildTasteVector(yesListings);
    userNames[user.id] = user.name;
    userInsights[user.id] = generateUserInsights(tasteVectors[user.id], user.name, noListings);
  }

  const compatibilityMatrix = computeCompatibilityMatrix(tasteVectors);
  const groupCompatibility = computeGroupCompatibility(compatibilityMatrix);
  const { conflicts, sharedWins } = detectConflicts(tasteVectors, userNames);
  const groupInsights = generateGroupInsights(tasteVectors, userNames, groupCompatibility);

  res.json({
    groupCompatibility,
    compatibilityMatrix,
    tasteVectors,
    userInsights,
    conflicts,
    sharedWins,
    groupInsights,
    users: sessionUsers.map((u) => ({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
    })),
  });
});

module.exports = router;
