/**
 * Server-Sent Events (SSE) stream for live updates.
 */
const { Router } = require('express');
const { getSessionByCode, sseClients } = require('../store');

const router = Router();

/* ── GET /api/sessions/:code/stream ─────────────────────── */
router.get('/:code/stream', (req, res) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Register client
  if (!sseClients.has(session.code)) {
    sseClients.set(session.code, new Set());
  }
  sseClients.get(session.code).add(res);

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionCode: session.code })}\n\n`);

  // Clean up on disconnect
  req.on('close', () => {
    const clients = sseClients.get(session.code);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(session.code);
    }
  });
});

/**
 * Broadcast an event to all SSE clients for a session.
 */
function broadcast(sessionCode, eventType, data) {
  const clients = sseClients.get(sessionCode);
  if (!clients) return;
  const payload = JSON.stringify({ type: eventType, data, ts: Date.now() });
  for (const client of clients) {
    client.write(`data: ${payload}\n\n`);
  }
}

module.exports = { router, broadcast };
