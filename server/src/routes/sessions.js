/**
 * Session routes: create, set constraints, join, get state.
 */
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { sessions, users, getSessionByCode, getUsersForSession, getSwipesForSession } = require('../store');
const { generateSessionCode } = require('../utils/codeGenerator');
const { validateConstraints } = require('../utils/validate');

const router = Router();

/* ── POST /api/sessions ── create a new session ─────────── */
router.post('/', (req, res) => {
  const code = generateSessionCode();
  const session = {
    id: uuidv4(),
    code,
    createdAt: Date.now(),
    hostName: req.body.hostName || 'Host',
    constraints: null,
    status: 'LOBBY', // LOBBY | SWIPING | RESULTS
  };
  sessions.set(code, session);
  res.status(201).json({ sessionCode: code, sessionId: session.id });
});

/* ── POST /api/sessions/:code/constraints ───────────────── */
router.post('/:code/constraints', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const errors = validateConstraints(req.body);
  if (errors.length) return res.status(400).json({ errors });

  session.constraints = {
    rentOrBuy: req.body.rentOrBuy,
    budgetMin: req.body.budgetMin,
    budgetMax: req.body.budgetMax,
    bedsMin: req.body.bedsMin,
    bathsMin: req.body.bathsMin,
    location: req.body.location,
    hardNo: req.body.hardNo || [],
  };

  res.json({ ok: true, constraints: session.constraints });
});

/* ── POST /api/sessions/:code/join ──────────────────────── */
router.post('/:code/join', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { name, avatarColor } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  const userId = uuidv4();
  const user = {
    id: userId,
    sessionCode: session.code,
    name: name.trim(),
    avatarColor: avatarColor || '#6366f1',
    createdAt: Date.now(),
    isReady: false,
  };
  users.set(userId, user);

  res.status(201).json({ userId, name: user.name, sessionCode: session.code });
});

/* ── POST /api/sessions/:code/status ── update status ───── */
router.post('/:code/status', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { status } = req.body;
  if (!['LOBBY', 'SWIPING', 'RESULTS'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use LOBBY, SWIPING, or RESULTS' });
  }

  session.status = status;
  res.json({ ok: true, status: session.status });
});

/* ── GET /api/sessions/:code/state ──────────────────────── */
router.get('/:code/state', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sessionUsers = getUsersForSession(session.code);
  const allSwipes = getSwipesForSession(session.code);

  // Swipe counts per user
  const swipeCounts = {};
  for (const u of sessionUsers) {
    swipeCounts[u.id] = allSwipes.filter((s) => s.userId === u.id).length;
  }

  res.json({
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
      hostName: session.hostName,
      constraints: session.constraints,
      createdAt: session.createdAt,
    },
    users: sessionUsers.map((u) => ({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
      isReady: u.isReady,
      swipeCount: swipeCounts[u.id] || 0,
    })),
    totalSwipes: allSwipes.length,
  });
});

module.exports = router;
