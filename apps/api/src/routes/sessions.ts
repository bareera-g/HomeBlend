import { Router, Request, Response } from "express";
import type { Session, User, Constraints, SessionStatus } from "@homeblend/types";
import { DEFAULT_CONSTRAINTS } from "@homeblend/types";
import { generateSessionCode } from "../utils/code";
import {
  sessionsById,
  sessionsByCode,
  usersById,
  usersBySession,
  getSessionByCode,
  getUsersInSession,
  getSwipesForUser,
  swipesBySessionUser,
} from "../store";
import { randomUUID } from "crypto";

export const sessionsRouter = Router();

function validateConstraints(c: Partial<Constraints>): string | null {
  if (c.budgetMin != null && c.budgetMax != null && c.budgetMin > c.budgetMax)
    return "budgetMin must be <= budgetMax";
  if (c.bedsMin != null && c.bedsMin < 0) return "bedsMin must be >= 0";
  if (c.bathsMin != null && c.bathsMin < 0) return "bathsMin must be >= 0";
  return null;
}

// POST /api/sessions — create session
sessionsRouter.post("/", (req: Request, res: Response) => {
  const sessionId = randomUUID();
  const code = generateSessionCode();
  const session: Session = {
    id: sessionId,
    code,
    createdAt: Date.now(),
    hostName: undefined,
    constraints: null,
    listingPoolId: "default",
    status: "LOBBY",
  };
  sessionsById.set(sessionId, session);
  sessionsByCode.set(code, session);
  usersBySession.set(sessionId, []);
  res.status(201).json({ sessionCode: code, sessionId });
});

// POST /api/sessions/:code/constraints
sessionsRouter.post("/:code/constraints", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const body = req.body as Partial<Constraints>;
  const err = validateConstraints(body);
  if (err) return res.status(400).json({ error: err });
  const constraints: Constraints = {
    rentOrBuy: body.rentOrBuy ?? DEFAULT_CONSTRAINTS.rentOrBuy,
    budgetMin: body.budgetMin ?? DEFAULT_CONSTRAINTS.budgetMin,
    budgetMax: body.budgetMax ?? DEFAULT_CONSTRAINTS.budgetMax,
    bedsMin: body.bedsMin ?? DEFAULT_CONSTRAINTS.bedsMin,
    bathsMin: body.bathsMin ?? DEFAULT_CONSTRAINTS.bathsMin,
    location: body.location ?? DEFAULT_CONSTRAINTS.location,
    hardNo: Array.isArray(body.hardNo) ? body.hardNo : DEFAULT_CONSTRAINTS.hardNo,
  };
  session.constraints = constraints;
  res.json({ ok: true, constraints });
});

// POST /api/sessions/:code/join
sessionsRouter.post("/:code/join", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  const userId = randomUUID();
  const user: User = {
    id: userId,
    sessionId: session.id,
    name,
    createdAt: Date.now(),
    isReady: false,
  };
  usersById.set(userId, user);
  const users = usersBySession.get(session.id) ?? [];
  users.push(user);
  usersBySession.set(session.id, users);
  swipesBySessionUser.set(`${session.id}:${userId}`, []);
  res.status(201).json({ userId });
});

// GET /api/sessions/:code/state
sessionsRouter.get("/:code/state", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const users = getUsersInSession(session.id);
  const swipeCounts: Record<string, number> = {};
  for (const u of users) {
    swipeCounts[u.id] = getSwipesForUser(session.id, u.id).length;
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
sessionsRouter.patch("/:code/status", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const status = req.body?.status as SessionStatus | undefined;
  const valid: SessionStatus[] = ["LOBBY", "SWIPING", "RESULTS"];
  if (!status || !valid.includes(status))
    return res.status(400).json({ error: "status must be LOBBY, SWIPING, or RESULTS" });
  session.status = status;
  res.json({ ok: true, status: session.status });
});
