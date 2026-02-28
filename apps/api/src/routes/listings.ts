import { Router, Request, Response } from "express";
import { getSessionByCode } from "../store";
import { getSwipesForUser } from "../store";
import { getAllListings, filterListingsByConstraints } from "../data/loadListings";

export const listingsRouter = Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

// GET /api/sessions/:code/listings?userId=...&cursor=...&limit=10
listingsRouter.get("/:code/listings", (req: Request, res: Response) => {
  const session = getSessionByCode(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const userId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  let limit = DEFAULT_LIMIT;
  if (typeof req.query.limit === "string") {
    const n = parseInt(req.query.limit, 10);
    if (!isNaN(n) && n > 0) limit = Math.min(n, MAX_LIMIT);
  }

  const all = getAllListings();
  const filtered = filterListingsByConstraints(all, session.constraints);
  const swiped = getSwipesForUser(session.id, userId);
  const swipedIds = new Set(swiped.map((s) => s.listingId));
  const available = filtered.filter((l) => !swipedIds.has(l.id));
  const sorted = available.slice().sort((a, b) => a.id.localeCompare(b.id));

  let start = 0;
  if (cursor) {
    const idx = sorted.findIndex((l) => l.id === cursor);
    if (idx >= 0) start = idx + 1;
  }
  const page = sorted.slice(start, start + limit);
  const nextCursor = page.length === limit && start + limit < sorted.length
    ? page[page.length - 1]!.id
    : undefined;

  res.json({
    listings: page,
    nextCursor: nextCursor ?? null,
    total: sorted.length,
  });
});
