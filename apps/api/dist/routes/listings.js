"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingsRouter = void 0;
const express_1 = require("express");
const store_1 = require("../store");
const store_2 = require("../store");
const loadListings_1 = require("../data/loadListings");
exports.listingsRouter = (0, express_1.Router)();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
// GET /api/sessions/:code/listings?userId=...&cursor=...&limit=10
exports.listingsRouter.get("/:code/listings", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId)
        return res.status(400).json({ error: "userId is required" });
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    let limit = DEFAULT_LIMIT;
    if (typeof req.query.limit === "string") {
        const n = parseInt(req.query.limit, 10);
        if (!isNaN(n) && n > 0)
            limit = Math.min(n, MAX_LIMIT);
    }
    const all = (0, loadListings_1.getAllListings)();
    const filtered = (0, loadListings_1.filterListingsByConstraints)(all, session.constraints);
    const swiped = (0, store_2.getSwipesForUser)(session.id, userId);
    const swipedIds = new Set(swiped.map((s) => s.listingId));
    const available = filtered.filter((l) => !swipedIds.has(l.id));
    const sorted = available.slice().sort((a, b) => a.id.localeCompare(b.id));
    let start = 0;
    if (cursor) {
        const idx = sorted.findIndex((l) => l.id === cursor);
        if (idx >= 0)
            start = idx + 1;
    }
    const page = sorted.slice(start, start + limit);
    const nextCursor = page.length === limit && start + limit < sorted.length
        ? page[page.length - 1].id
        : undefined;
    res.json({
        listings: page,
        nextCursor: nextCursor ?? null,
        total: sorted.length,
    });
});
