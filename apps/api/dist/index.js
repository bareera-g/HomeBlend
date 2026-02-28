"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const health_1 = require("./routes/health");
const sessions_1 = require("./routes/sessions");
const listings_1 = require("./routes/listings");
const swipes_1 = require("./routes/swipes");
const leaderboard_1 = require("./routes/leaderboard");
const blend_1 = require("./routes/blend");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: config_1.config.corsOrigin,
    optionsSuccessStatus: 200,
}));
app.use(express_1.default.json());
app.use(health_1.healthRouter);
app.use("/api/sessions", sessions_1.sessionsRouter);
app.use("/api/sessions", listings_1.listingsRouter);
app.use("/api/sessions", swipes_1.swipesRouter);
app.use("/api/sessions", leaderboard_1.leaderboardRouter);
app.use("/api/sessions", blend_1.blendRouter);
app.listen(config_1.config.port, () => {
    console.log(`HomeBlend API listening on http://localhost:${config_1.config.port}`);
});
