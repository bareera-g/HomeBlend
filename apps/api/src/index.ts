import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { sessionsRouter } from "./routes/sessions";
import { listingsRouter } from "./routes/listings";
import { swipesRouter } from "./routes/swipes";
import { leaderboardRouter } from "./routes/leaderboard";
import { blendRouter } from "./routes/blend";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

app.use(healthRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", listingsRouter);
app.use("/api/sessions", swipesRouter);
app.use("/api/sessions", leaderboardRouter);
app.use("/api/sessions", blendRouter);

app.listen(config.port, () => {
  console.log(`HomeBlend API listening on http://localhost:${config.port}`);
});
