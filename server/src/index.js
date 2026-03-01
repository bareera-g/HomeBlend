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
const allowedOrigins = new Set((process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()));
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin)) {
      return cb(null, true);
    }
    // Also allow any localhost port in development
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
}));
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

/* ── Public listings endpoint (no session required) ─────── */
const allProperties = require('./data/properties.json');
const { cleanPropertyOverview } = require('./utils/overviewGenerator');
const propertyMap = new Map(allProperties.map((p) => [p.id, p]));

app.get('/api/listings', (req, res) => {
  const ids = (req.query.ids || '')
    .split(',')
    .map((s) => {
      const n = Number(s.trim());
      return Number.isNaN(n) ? s.trim() : n;
    })
    .filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'ids query param required (comma-separated)' });
  const found = ids.map((id) => propertyMap.get(id)).filter(Boolean).map(cleanPropertyOverview);
  res.json({ listings: found, total: found.length });
});

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🏠 HomeBlend server running on http://0.0.0.0:${PORT}`);
  console.log(`  📋 Health check:  http://localhost:${PORT}/health\n`);
});

module.exports = app;
