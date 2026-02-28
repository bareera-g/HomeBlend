"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsRouter = void 0;
const express_1 = require("express");
const types_1 = require("@homeblend/types");
const code_1 = require("../utils/code");
const store_1 = require("../store");
const crypto_1 = require("crypto");
exports.sessionsRouter = (0, express_1.Router)();
function validateConstraints(c) {
    if (c.budgetMin != null && c.budgetMax != null && c.budgetMin > c.budgetMax)
        return "budgetMin must be <= budgetMax";
    if (c.bedsMin != null && c.bedsMin < 0)
        return "bedsMin must be >= 0";
    if (c.bathsMin != null && c.bathsMin < 0)
        return "bathsMin must be >= 0";
    return null;
}
// POST /api/sessions — create session
exports.sessionsRouter.post("/", (req, res) => {
    const sessionId = (0, crypto_1.randomUUID)();
    const code = (0, code_1.generateSessionCode)();
    const session = {
        id: sessionId,
        code,
        createdAt: Date.now(),
        hostName: undefined,
        constraints: null,
        listingPoolId: "default",
        status: "LOBBY",
    };
    store_1.sessionsById.set(sessionId, session);
    store_1.sessionsByCode.set(code, session);
    store_1.usersBySession.set(sessionId, []);
    res.status(201).json({ sessionCode: code, sessionId });
});
// POST /api/sessions/:code/constraints
exports.sessionsRouter.post("/:code/constraints", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const body = req.body;
    const err = validateConstraints(body);
    if (err)
        return res.status(400).json({ error: err });
    const constraints = {
        rentOrBuy: body.rentOrBuy ?? types_1.DEFAULT_CONSTRAINTS.rentOrBuy,
        budgetMin: body.budgetMin ?? types_1.DEFAULT_CONSTRAINTS.budgetMin,
        budgetMax: body.budgetMax ?? types_1.DEFAULT_CONSTRAINTS.budgetMax,
        bedsMin: body.bedsMin ?? types_1.DEFAULT_CONSTRAINTS.bedsMin,
        bathsMin: body.bathsMin ?? types_1.DEFAULT_CONSTRAINTS.bathsMin,
        location: body.location ?? types_1.DEFAULT_CONSTRAINTS.location,
        hardNo: Array.isArray(body.hardNo) ? body.hardNo : types_1.DEFAULT_CONSTRAINTS.hardNo,
    };
    session.constraints = constraints;
    res.json({ ok: true, constraints });
});
// POST /api/sessions/:code/join
exports.sessionsRouter.post("/:code/join", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name)
        return res.status(400).json({ error: "name is required" });
    const userId = (0, crypto_1.randomUUID)();
    const user = {
        id: userId,
        sessionId: session.id,
        name,
        createdAt: Date.now(),
        isReady: false,
    };
    store_1.usersById.set(userId, user);
    const users = store_1.usersBySession.get(session.id) ?? [];
    users.push(user);
    store_1.usersBySession.set(session.id, users);
    store_1.swipesBySessionUser.set(`${session.id}:${userId}`, []);
    res.status(201).json({ userId });
});
// GET /api/sessions/:code/state
exports.sessionsRouter.get("/:code/state", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const users = (0, store_1.getUsersInSession)(session.id);
    const swipeCounts = {};
    for (const u of users) {
        swipeCounts[u.id] = (0, store_1.getSwipesForUser)(session.id, u.id).length;
    }
    res.json({
        sessionId: session.id,
        code: session.code,
        status: session.status,
        constraints: session.constraints,
        users: users.map((u) => ({
            id: u.id,
            name: u.name,
            isReady: u.isReady,
        })),
        swipeCounts,
    });
});
// PATCH /api/sessions/:code/status — set status (LOBBY | SWIPING | RESULTS)
exports.sessionsRouter.patch("/:code/status", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const status = req.body?.status;
    const valid = ["LOBBY", "SWIPING", "RESULTS"];
    if (!status || !valid.includes(status))
        return res.status(400).json({ error: "status must be LOBBY, SWIPING, or RESULTS" });
    session.status = status;
    res.json({ ok: true, status: session.status });
});
