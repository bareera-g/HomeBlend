/**
 * Listing routes: serve listing pool filtered by session constraints.
 */
const { Router } = require('express');
const { getSessionByCode, getSwipesForUser } = require('../store');
const listings = require('../data/listings.json');

const router = Router();

/**
 * Filter listings by session hard constraints.
 */
function filterByConstraints(allListings, constraints) {
  if (!constraints) return allListings;

  return allListings.filter((l) => {
    if (l.price < constraints.budgetMin || l.price > constraints.budgetMax) return false;
    if (l.beds < constraints.bedsMin) return false;
    if (l.baths < constraints.bathsMin) return false;

    // Hard-no features: e.g. ["no_parking"] means exclude listings without parking
    if (constraints.hardNo && constraints.hardNo.length) {
      for (const rule of constraints.hardNo) {
        const featureKey = rule.replace('no_', '');
        if (l.features[featureKey] === 0) return false;
      }
    }

    return true;
  });
}

/* ── GET /api/sessions/:code/listings ───────────────────── */
router.get('/:code/listings', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const userId = req.query.userId;
  const cursor = parseInt(req.query.cursor, 10) || 0;
  const limit = parseInt(req.query.limit, 10) || 10;

  let pool = filterByConstraints(listings, session.constraints);

  // If userId provided, exclude already-swiped listings
  if (userId) {
    const swiped = new Set(getSwipesForUser(session.code, userId).map((s) => s.listingId));
    pool = pool.filter((l) => !swiped.has(l.id));
  }

  const page = pool.slice(cursor, cursor + limit);

  res.json({
    listings: page,
    nextCursor: cursor + limit < pool.length ? cursor + limit : null,
    total: pool.length,
    returned: page.length,
  });
});

/* ── GET /api/sessions/:code/listings/count ─────────────── */
router.get('/:code/listings/count', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const pool = filterByConstraints(listings, session.constraints);
  res.json({ total: pool.length });
});

module.exports = router;
