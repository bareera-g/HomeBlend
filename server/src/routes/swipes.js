/**
 * Swipe routes: submit swipe, mark ready.
 */
const { Router } = require('express');
const { getSessionByCode, users, swipes, swipeKey, getSwipesForUser } = require('../store');

const router = Router();

/* ── POST /api/sessions/:code/swipe ─────────────────────── */
router.post('/:code/swipe', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status !== 'SWIPING') {
    return res.status(400).json({ error: 'Session is not in SWIPING state' });
  }

  const { userId, listingId, vote } = req.body;
  if (!userId || !listingId || !vote) {
    return res.status(400).json({ error: 'userId, listingId, and vote are required' });
  }
  if (!['YES', 'NO', 'MAYBE', 'SUPERLIKE'].includes(vote)) {
    return res.status(400).json({ error: 'vote must be YES, NO, MAYBE, or SUPERLIKE' });
  }

  const user = users.get(userId);
  if (!user || user.sessionCode !== session.code) {
    return res.status(403).json({ error: 'User not in this session' });
  }

  // Enforce SUPERLIKE limit (3 per user per session)
  if (vote === 'SUPERLIKE') {
    const userSwipes = getSwipesForUser(session.code, userId);
    const superLikes = userSwipes.filter((s) => s.vote === 'SUPERLIKE').length;
    if (superLikes >= 3) {
      return res.status(400).json({ error: 'Super Like limit reached (max 3)' });
    }
  }

  const key = swipeKey(session.code, userId, listingId);
  const swipe = {
    sessionCode: session.code,
    userId,
    listingId,
    vote,
    ts: Date.now(),
  };
  swipes.set(key, swipe); // upsert — overwrite allowed

  res.json({ ok: true, swipe });
});

/* ── POST /api/sessions/:code/ready ─────────────────────── */
router.post('/:code/ready', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { userId, isReady } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const user = users.get(userId);
  if (!user || user.sessionCode !== session.code) {
    return res.status(403).json({ error: 'User not in this session' });
  }

  user.isReady = isReady !== false; // default true
  res.json({ ok: true, userId, isReady: user.isReady });
});

/* ── GET /api/sessions/:code/swipes/:userId ── user's swipes */
router.get('/:code/swipes/:userId', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const userSwipes = getSwipesForUser(session.code, req.params.userId);
  res.json({
    userId: req.params.userId,
    count: userSwipes.length,
    swipes: userSwipes,
  });
});

module.exports = router;
