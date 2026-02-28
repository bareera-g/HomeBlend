"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blendRouter = void 0;
const express_1 = require("express");
const store_1 = require("../store");
const blend_1 = require("../services/blend");
exports.blendRouter = (0, express_1.Router)();
// GET /api/sessions/:code/blend
exports.blendRouter.get("/:code/blend", (req, res) => {
    const session = (0, store_1.getSessionByCode)(req.params.code);
    if (!session)
        return res.status(404).json({ error: "Session not found" });
    const users = (0, store_1.getUsersInSession)(session.id);
    const result = (0, blend_1.computeBlend)(users, (userId) => (0, store_1.getSwipesForUser)(session.id, userId));
    res.json(result);
});
