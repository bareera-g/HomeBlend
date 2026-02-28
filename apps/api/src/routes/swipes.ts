import { Router, Request, Response } from "express";
import type { Vote } from "@homeblend/types";
import { getSessionByCode, usersById, swipesBySessionUser, getSwipesForUser } from "../store";

export const swipesRouter = Router();

const VALID_VOTES: Vote[] = ["YES", "NO", "MAYBE"];

// POST /api/sessions/:code/swipe
swipesRouter.post("/:code/swipe", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const userId = req.body?.userId;
  const listingId = req.body?.listingId;
  const vote = req.body?.vote;
  if (!userId || !listingId || !VALID_VOTES.includes(vote)) {
    return res.status(400).json({ error: "userId, listingId, and vote (YES|NO|MAYBE) required" });
  }
  const user = usersById.get(userId);
  if (!user || user.sessionId !== session.id) {
    return res.status(404).json({ error: "User not found in this session" });
  }

  const key = `${session.id}:${userId}`;
  let swipes = swipesBySessionUser.get(key) ?? [];
  const existing = swipes.find((s) => s.listingId === listingId);
  const newSwipe = {
    sessionId: session.id,
    userId,
    listingId,
    vote: vote as Vote,
    ts: Date.now(),
  };
  if (existing) {
    swipes = swipes.map((s) => (s.listingId === listingId ? newSwipe : s));
  } else {
    swipes = [...swipes, newSwipe];
  }
  swipesBySessionUser.set(key, swipes);

  const count = swipes.length;
  res.status(200).json({ ok: true, swipeCount: count });
});

// POST /api/sessions/:code/ready
swipesRouter.post("/:code/ready", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const userId = req.body?.userId;
  const isReady = req.body?.isReady === true;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const user = usersById.get(userId);
  if (!user || user.sessionId !== session.id) {
    return res.status(404).json({ error: "User not found in this session" });
  }
  user.isReady = isReady;
  res.json({ ok: true, isReady: user.isReady });
});
