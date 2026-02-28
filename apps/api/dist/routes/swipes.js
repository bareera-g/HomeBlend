"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swipesRouter = void 0;
const express_1 = require("express");
const store_1 = require("../store");
exports.swipesRouter = (0, express_1.Router)();
const VALID_VOTES = ["YES", "NO", "MAYBE"];
// POST /api/sessions/:code/swipe
exports.swipesRouter.post("/:code/swipe", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const userId = req.body?.userId;
    const listingId = req.body?.listingId;
    const vote = req.body?.vote;
    if (!userId || !listingId || !VALID_VOTES.includes(vote)) {
        return res.status(400).json({ error: "userId, listingId, and vote (YES|NO|MAYBE) required" });
    }
    const user = store_1.usersById.get(userId);
    if (!user || user.sessionId !== session.id) {
        return res.status(404).json({ error: "User not found in this session" });
    }
    const key = `${session.id}:${userId}`;
    let swipes = store_1.swipesBySessionUser.get(key) ?? [];
    const existing = swipes.find((s) => s.listingId === listingId);
    const newSwipe = {
        sessionId: session.id,
        userId,
        listingId,
        vote: vote,
        ts: Date.now(),
    };
    if (existing) {
        swipes = swipes.map((s) => (s.listingId === listingId ? newSwipe : s));
    }
    else {
        swipes = [...swipes, newSwipe];
    }
    store_1.swipesBySessionUser.set(key, swipes);
    const count = swipes.length;
    res.status(200).json({ ok: true, swipeCount: count });
});
// POST /api/sessions/:code/ready
exports.swipesRouter.post("/:code/ready", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const userId = req.body?.userId;
    const isReady = req.body?.isReady === true;
    if (!userId)
        return res.status(400).json({ error: "userId required" });
    const user = store_1.usersById.get(userId);
    if (!user || user.sessionId !== session.id) {
        return res.status(404).json({ error: "User not found in this session" });
    }
    user.isReady = isReady;
    res.json({ ok: true, isReady: user.isReady });
});
