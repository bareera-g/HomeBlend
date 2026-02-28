import { Router, Request, Response } from "express";
import { getSessionByCode, getUsersInSession, getSwipesForUser } from "../store";
import { computeBlend } from "../services/blend";

export const blendRouter = Router();

// GET /api/sessions/:code/blend
blendRouter.get("/:code/blend", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const users = getUsersInSession(session.id);
  const result = computeBlend(users, (userId) => getSwipesForUser(session.id, userId));
  res.json(result);
});
