"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaderboardRouter = void 0;
const express_1 = require("express");
const store_1 = require("../store");
const leaderboard_1 = require("../services/leaderboard");
exports.leaderboardRouter = (0, express_1.Router)();
// GET /api/sessions/:code/leaderboard
exports.leaderboardRouter.get("/:code/leaderboard", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const users = (0, store_1.getUsersInSession)(session.id);
    const userIds = users.map((u) => u.id);
    const swipes = (0, store_1.getSwipesForSession)(session.id);
    const topN = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const entries = (0, leaderboard_1.computeLeaderboard)(swipes, userIds, isNaN(topN) ? 20 : Math.min(topN, 50));
    res.json({ leaderboard: entries });
});
