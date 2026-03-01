require('dotenv').config();

const express = require('express');
const cors = require('cors');

const sessionRoutes = require('./routes/sessions');
const swipeRoutes = require('./routes/swipes');
const listingRoutes = require('./routes/listings');
const leaderboardRoutes = require('./routes/leaderboard');
const { router: streamRouter, broadcast } = require('./routes/stream');
const { getSessionByCode, getUsersForSession, getSwipesForSession } = require('./store');

const app = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ──────────────────────────────────────────── */
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

/* ── Health check ───────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

/* ── API routes ─────────────────────────────────────────── */
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', swipeRoutes);
app.use('/api/sessions', listingRoutes);
app.use('/api/sessions', leaderboardRoutes);
app.use('/api/sessions', streamRouter);

/* ── SSE broadcast hooks ────────────────────────────────── */
// Wrap swipe + status endpoints to broadcast after mutation
const originalPost = app.post;

// Middleware to broadcast on relevant mutations
app.use((req, res, next) => {
  // After response is sent, check if we should broadcast
  const originalEnd = res.end;
  res.end = function (...args) {
    originalEnd.apply(this, args);

    // Broadcast on swipe, ready, or status changes
    const match = req.path.match(/^\/api\/sessions\/([A-Z0-9]+)\/(swipe|ready|status)$/i);
    if (match && res.statusCode < 400) {
      const code = match[1].toUpperCase();
      const session = getSessionByCode(code);
      if (session) {
        const users = getUsersForSession(code);
        const swipes = getSwipesForSession(code);

        broadcast(code, 'update', {
          status: session.status,
          userCount: users.length,
          totalSwipes: swipes.length,
          users: users.map((u) => ({
            id: u.id,
            name: u.name,
            isReady: u.isReady,
            swipeCount: swipes.filter((s) => s.userId === u.id).length,
          })),
        });
      }
    }
  };
  next();
});

/* ── 404 fallback ───────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/* ── Error handler ──────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ── Start ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  🏠 HomeBlend server running on http://localhost:${PORT}`);
  console.log(`  📋 Health check:  http://localhost:${PORT}/health\n`);
});

module.exports = app;
