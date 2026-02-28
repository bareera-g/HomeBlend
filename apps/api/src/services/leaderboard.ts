import type { Swipe, Listing } from "@homeblend/types";
import { getListingById } from "../data/loadListings";

export interface LeaderboardEntry {
  listingId: string;
  listing: Listing;
  yesCount: number;
  noCount: number;
  maybeCount: number;
  matchScore: number;
}

export function computeLeaderboard(
  swipes: Swipe[],
  userIdsInSession: string[],
  topN: number = 20
): LeaderboardEntry[] {
  const byListing = new Map<
    string,
    { yes: number; no: number; maybe: number; userIds: Set<string> }
  >();
  for (const s of swipes) {
    let rec = byListing.get(s.listingId);
    if (!rec) {
      rec = { yes: 0, no: 0, maybe: 0, userIds: new Set() };
      byListing.set(s.listingId, rec);
    }
    rec.userIds.add(s.userId);
    if (s.vote === "YES") rec.yes++;
    else if (s.vote === "NO") rec.no++;
    else rec.maybe++;
  }

  const entries: LeaderboardEntry[] = [];
  for (const [listingId, rec] of byListing) {
    const listing = getListingById(listingId);
    if (!listing) continue;
    let matchScore = rec.yes - 0.5 * rec.no;
    const allWhoSwiped = rec.userIds.size;
    const allInSession = userIdsInSession.length;
    if (allInSession > 0 && allWhoSwiped === allInSession && rec.no === 0 && rec.maybe === 0) {
      matchScore += 2;
    }
    entries.push({
      listingId,
      listing,
      yesCount: rec.yes,
      noCount: rec.no,
      maybeCount: rec.maybe,
      matchScore,
    });
  }
  entries.sort((a, b) => b.matchScore - a.matchScore);
  return entries.slice(0, topN);
}
