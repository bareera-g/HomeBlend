/**
 * HomeBlend — Blend Algorithm
 * Ported from the scrape branch's backend blend service.
 * Runs entirely client-side using our property data + Firestore votes.
 */

// ─── Feature extraction ──────────────────────────────────────────────────────
// Maps each property to a normalized 0-1 feature vector.

export const FEATURE_KEYS = [
  "petFriendly",
  "parking",
  "inUnitLaundry",
  "highSqft",
  "newBuild",
  "budgetFriendly",
  "moreBeds",
];

export const FEATURE_LABELS = {
  petFriendly:    "Pet-friendly",
  parking:        "Parking",
  inUnitLaundry:  "In-unit laundry",
  highSqft:       "Spacious",
  newBuild:       "Modern build",
  budgetFriendly: "Budget-friendly",
  moreBeds:       "More bedrooms",
};

export function extractFeatures(property) {
  return {
    petFriendly:    property.petFriendly ? 1 : 0,
    parking:        property.parking ? 1 : 0,
    inUnitLaundry:  property.laundry === "In-unit" ? 1 : 0,
    highSqft:       (property.sqft ?? 0) >= 1200 ? 1 : 0,
    newBuild:       (property.yearBuilt ?? 0) >= 2015 ? 1 : 0,
    budgetFriendly: (property.priceNum ?? (Number(property.price?.replaceAll(/\D/g, "")) || 9999)) <= 3200 ? 1 : 0,
    moreBeds:       (property.beds ?? 0) >= 3 ? 1 : 0,
  };
}

// ─── Taste vector ────────────────────────────────────────────────────────────
// Average feature vector of all properties a user liked.

export function computeTasteVector(userId, votes, properties) {
  const likedProps = properties.filter(p =>
    votes.some(v => v.property_id === p.id && v.user_id === userId && v.vote === 1)
  );

  const empty = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0]));
  if (likedProps.length === 0) return empty;

  const sum = { ...empty };
  for (const p of likedProps) {
    const f = extractFeatures(p);
    for (const k of FEATURE_KEYS) sum[k] += f[k];
  }
  const vec = {};
  for (const k of FEATURE_KEYS) vec[k] = sum[k] / likedProps.length;
  return vec;
}

// ─── Cosine similarity ───────────────────────────────────────────────────────

function cosineDistance(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (const k of FEATURE_KEYS) {
    dot   += a[k] * b[k];
    normA += a[k] * a[k];
    normB += b[k] * b[k];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0.5; // no data → neutral
  const sim = dot / denom;
  return 1 - (sim + 1) / 2;
}

export function compatibilityPercent(vecA, vecB) {
  return Math.round((1 - cosineDistance(vecA, vecB)) * 100);
}

// ─── Property scoring ────────────────────────────────────────────────────────
// Score = (likes - dislikes) across all members.

export function scoreProperties(properties, votes) {
  return properties
    .map(p => {
      const propVotes = votes.filter(v => v.property_id === p.id);
      const score     = propVotes.reduce((s, v) => {
        if (v.vote === 1) return s + 1;
        if (v.vote === -1) return s - 1;
        return s;
      }, 0);
      const likes     = propVotes.filter(v => v.vote === 1).length;
      const dislikes  = propVotes.filter(v => v.vote === -1).length;
      return { property: p, score, likes, dislikes, totalVoters: propVotes.length };
    })
    .sort((a, b) => b.score - a.score || b.likes - a.likes);
}

// ─── Per-member insights ──────────────────────────────────────────────────────

function topFeatures(vec, n = 3) {
  return FEATURE_KEYS
    .filter(k => vec[k] > 0.2)
    .sort((a, b) => vec[b] - vec[a])
    .slice(0, n)
    .map(k => FEATURE_LABELS[k]);
}

export function buildMemberInsights(userId, votes, properties, tasteVec) {
  const liked    = properties.filter(p => votes.some(v => v.property_id === p.id && v.user_id === userId && v.vote === 1));
  const disliked = properties.filter(p => votes.some(v => v.property_id === p.id && v.user_id === userId && v.vote === -1));
  const bullets  = [];

  const top = topFeatures(tasteVec);
  if (top.length > 0) bullets.push(`Values: ${top.join(", ")}.`);

  if (liked.length > 0) {
    const avgPrice = liked.reduce((s, p) => {
      const n = p.priceNum ?? Number.parseInt(p.price?.replaceAll(/\D/g, "") || "0");
      return s + n;
    }, 0) / liked.length;
    if (avgPrice > 0) bullets.push(`Average liked price: $${Math.round(avgPrice).toLocaleString()}/mo.`);
  }

  if (disliked.length > 0 && liked.length === 0) bullets.push("Has only passed on properties so far.");
  if (liked.length === 0 && disliked.length === 0) bullets.push("No votes yet — share the room code!");

  return bullets.slice(0, 3);
}

// ─── Conflicts ───────────────────────────────────────────────────────────────

function detectConflicts(members, tasteVectors) {
  const conflicts = [];
  const ids = members.map(m => m.auth_user_id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const nameA = members[i].display_name || "Member A";
      const nameB = members[j].display_name || "Member B";
      const va = tasteVectors[ids[i]] || {};
      const vb = tasteVectors[ids[j]] || {};

      if ((va.budgetFriendly ?? 0) > 0.7 && (vb.highSqft ?? 0) > 0.7)
        conflicts.push(`${nameA} favors budget; ${nameB} prefers spacious units.`);
      if ((va.petFriendly ?? 0) > 0.7 && (vb.petFriendly ?? 0) < 0.3 && Object.values(vb).some(x => x > 0))
        conflicts.push(`${nameA} wants pet-friendly; ${nameB} hasn't prioritized it.`);
      if ((va.newBuild ?? 0) > 0.7 && (vb.budgetFriendly ?? 0) > 0.7)
        conflicts.push(`${nameA} prefers newer builds; ${nameB} leans budget-friendly.`);
    }
  }
  return conflicts.slice(0, 4);
}

// ─── Main compute ─────────────────────────────────────────────────────────────

/**
 * Compute the full group blend from votes + properties + members.
 * Returns a self-contained result object the BlendPanel can render.
 */
export function computeBlend(members, votes, properties) {
  const tasteVectors = {};
  for (const m of members) {
    tasteVectors[m.auth_user_id] = computeTasteVector(m.auth_user_id, votes, properties);
  }

  // Pairwise compatibility matrix
  const compatMatrix = {};
  for (const a of members) {
    compatMatrix[a.auth_user_id] = {};
    for (const b of members) {
      compatMatrix[a.auth_user_id][b.auth_user_id] =
        a.auth_user_id === b.auth_user_id
          ? 100
          : compatibilityPercent(tasteVectors[a.auth_user_id], tasteVectors[b.auth_user_id]);
    }
  }

  // Group compatibility = average of all unique pairs
  let pairSum = 0, pairCount = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairSum += compatMatrix[members[i].auth_user_id][members[j].auth_user_id];
      pairCount++;
    }
  }
  const groupCompatibility = pairCount > 0 ? Math.round(pairSum / pairCount) : 100;

  // Per-member insights
  const memberInsights = members.map(m => ({
    memberId: m.auth_user_id,
    displayName: m.display_name,
    avatarColor: m.avatar_color,
    tasteVec: tasteVectors[m.auth_user_id],
    topFeatures: topFeatures(tasteVectors[m.auth_user_id]),
    bullets: buildMemberInsights(m.auth_user_id, votes, properties, tasteVectors[m.auth_user_id]),
  }));

  // Conflicts
  const conflicts = detectConflicts(members, tasteVectors);

  // Property scores
  const rankedProperties = scoreProperties(properties, votes);

  // Shared likes — properties liked by everyone who voted
  const voterIds = [...new Set(votes.map(v => v.user_id))];
  const groupFavorites = rankedProperties.filter(({ property, likes }) => {
    if (voterIds.length === 0) return false;
    return likes >= Math.max(1, Math.ceil(voterIds.length * 0.5));
  });

  return {
    groupCompatibility,
    compatMatrix,
    memberInsights,
    conflicts,
    rankedProperties,
    groupFavorites,
    tasteVectors,
  };
}
