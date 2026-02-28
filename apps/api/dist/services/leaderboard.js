"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLeaderboard = computeLeaderboard;
const loadListings_1 = require("../data/loadListings");
function computeLeaderboard(swipes, userIdsInSession, topN = 20) {
    const byListing = new Map();
    for (const s of swipes) {
        let rec = byListing.get(s.listingId);
        if (!rec) {
            rec = { yes: 0, no: 0, maybe: 0, userIds: new Set() };
            byListing.set(s.listingId, rec);
        }
        rec.userIds.add(s.userId);
        if (s.vote === "YES")
            rec.yes++;
        else if (s.vote === "NO")
            rec.no++;
        else
            rec.maybe++;
    }
    const entries = [];
    for (const [listingId, rec] of byListing) {
        const listing = (0, loadListings_1.getListingById)(listingId);
        if (!listing)
            continue;
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
