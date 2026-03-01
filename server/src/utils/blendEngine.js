/**
 * Blend computation engine.
 * Computes taste vectors, compatibility scores, and conflicts.
 */

const FEATURE_KEYS = [
  'naturalLight',
  'parking',
  'openKitchen',
  'balcony',
  'inUnitLaundry',
  'hardwoodFloors',
  'modernFinishes',
  'quietNeighborhood',
  'entertainingSpace',
  'highCeilings',
];

const FEATURE_LABELS = {
  naturalLight: 'Natural Light',
  parking: 'Parking',
  openKitchen: 'Open Kitchen',
  balcony: 'Balcony',
  inUnitLaundry: 'In-Unit Laundry',
  hardwoodFloors: 'Hardwood Floors',
  modernFinishes: 'Modern Finishes',
  quietNeighborhood: 'Quiet Neighborhood',
  entertainingSpace: 'Entertaining Space',
  highCeilings: 'High Ceilings',
};

/* ── Taste vector ───────────────────────────────────────── */

/**
 * Build a taste vector for a user based on their YES swipes.
 * Each dimension = avg of that binary feature across liked listings.
 */
function buildTasteVector(yesListings) {
  if (!yesListings.length) {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0]));
  }
  const vec = {};
  for (const key of FEATURE_KEYS) {
    const sum = yesListings.reduce((acc, l) => acc + (l.features[key] || 0), 0);
    vec[key] = +(sum / yesListings.length).toFixed(3);
  }
  return vec;
}

/* ── Cosine similarity ──────────────────────────────────── */

function cosineSimilarity(a, b) {
  const keys = FEATURE_KEYS;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Compute pairwise compatibility between all users.
 * Returns a matrix { [userA_id]: { [userB_id]: percentage } }
 */
function computeCompatibilityMatrix(tasteVectors) {
  const userIds = Object.keys(tasteVectors);
  const matrix = {};
  for (const a of userIds) {
    matrix[a] = {};
    for (const b of userIds) {
      if (a === b) {
        matrix[a][b] = 100;
      } else {
        const sim = cosineSimilarity(tasteVectors[a], tasteVectors[b]);
        matrix[a][b] = Math.round(sim * 100);
      }
    }
  }
  return matrix;
}

/**
 * Group compatibility = average of all pairwise scores.
 */
function computeGroupCompatibility(matrix) {
  const userIds = Object.keys(matrix);
  if (userIds.length < 2) return 100;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      sum += matrix[userIds[i]][userIds[j]];
      count++;
    }
  }
  return Math.round(sum / count);
}

/* ── Conflicts & shared wins ────────────────────────────── */

/**
 * Detect per-pair conflicts where tastes diverge significantly.
 * A conflict = one user scores high (>0.6) and the other low (<0.3) on a feature.
 */
function detectConflicts(tasteVectors, userNames) {
  const userIds = Object.keys(tasteVectors);
  const conflicts = detectPairwiseConflicts(userIds, tasteVectors, userNames);
  const sharedWins = detectSharedWins(userIds, tasteVectors);

  return {
    conflicts: conflicts.slice(0, 6),
    sharedWins: sharedWins.slice(0, 6),
  };
}

function detectPairwiseConflicts(userIds, tasteVectors, userNames) {
  const conflicts = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const a = tasteVectors[userIds[i]];
      const b = tasteVectors[userIds[j]];
      const nameA = userNames[userIds[i]] || userIds[i];
      const nameB = userNames[userIds[j]] || userIds[j];

      for (const key of FEATURE_KEYS) {
        const va = a[key] || 0;
        const vb = b[key] || 0;
        const label = FEATURE_LABELS[key];

        if (va >= 0.6 && vb <= 0.3) {
          conflicts.push(`${nameA} loves ${label}, ${nameB} doesn't prioritize it`);
        } else if (vb >= 0.6 && va <= 0.3) {
          conflicts.push(`${nameB} loves ${label}, ${nameA} doesn't prioritize it`);
        }
      }
    }
  }
  return conflicts;
}

function detectSharedWins(userIds, tasteVectors) {
  const sharedWins = [];
  for (const key of FEATURE_KEYS) {
    const allHigh = userIds.every((id) => (tasteVectors[id][key] || 0) >= 0.5);
    const allLow = userIds.every((id) => (tasteVectors[id][key] || 0) <= 0.2);
    const label = FEATURE_LABELS[key];

    if (allHigh) {
      sharedWins.push(`Everyone prioritizes ${label}`);
    }
    if (allLow) {
      sharedWins.push(`Nobody particularly cares about ${label}`);
    }
  }
  return sharedWins;
}

/* ── Leaderboard scoring ────────────────────────────────── */

/**
 * Score a listing for the group.
 * matchScore = yesCount - 0.5 * noCount + (2 if unanimous YES)
 * superLikeCount adds +1.5 each.
 */
function scoreListing(listingId, swipesByListing, totalUsers) {
  const swipes = swipesByListing[listingId] || [];
  let yesCount = 0;
  let noCount = 0;
  let maybeCount = 0;
  let superLikeCount = 0;
  const voterDetails = {};

  for (const s of swipes) {
    if (s.vote === 'YES') yesCount++;
    else if (s.vote === 'NO') noCount++;
    else if (s.vote === 'MAYBE') maybeCount++;
    else if (s.vote === 'SUPERLIKE') { yesCount++; superLikeCount++; }
    voterDetails[s.userId] = s.vote;
  }

  let matchScore = yesCount + superLikeCount * 1.5 - 0.5 * noCount + 0.25 * maybeCount;
  // Bonus if every user swiped YES or SUPERLIKE
  if (yesCount === totalUsers && totalUsers > 1) matchScore += 2;

  return { listingId, yesCount, noCount, maybeCount, superLikeCount, matchScore, voterDetails };
}

module.exports = {
  FEATURE_KEYS,
  FEATURE_LABELS,
  buildTasteVector,
  cosineSimilarity,
  computeCompatibilityMatrix,
  computeGroupCompatibility,
  detectConflicts,
  scoreListing,
};
