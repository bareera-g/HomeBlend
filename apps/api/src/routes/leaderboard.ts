import { Router, Request, Response } from "express";
import { getSessionByCode, getUsersInSession, getSwipesForSession } from "../store";
import { computeLeaderboard } from "../services/leaderboard";

export const leaderboardRouter = Router();

// GET /api/sessions/:code/leaderboard
leaderboardRouter.get("/:code/leaderboard", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const users = getUsersInSession(session.id);
  const userIds = users.map((u) => u.id);
  const swipes = getSwipesForSession(session.id);
  const topN = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
  const entries = computeLeaderboard(swipes, userIds, isNaN(topN) ? 20 : Math.min(topN, 50));
  res.json({ leaderboard: entries });
});
