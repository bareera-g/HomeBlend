/**
 * Deterministic insight generator.
 * Produces "LLM-style" bullets from feature stats without needing an actual LLM call.
 */

const { FEATURE_KEYS, FEATURE_LABELS } = require('./blendEngine');

const ARCHETYPE_RULES = [
  { key: 'naturalLight', threshold: 0.75, label: 'The Natural Light Chaser', bullet: 'Always says yes to natural light' },
  { key: 'parking', threshold: 0.75, label: 'The Practical Commuter', bullet: 'Needs parking — no exceptions' },
  { key: 'openKitchen', threshold: 0.75, label: 'The Home Chef', bullet: 'Drawn to open kitchens every time' },
  { key: 'balcony', threshold: 0.75, label: 'The Fresh Air Lover', bullet: 'Can\'t resist a balcony' },
  { key: 'inUnitLaundry', threshold: 0.75, label: 'The Convenience Seeker', bullet: 'In-unit laundry is a must' },
  { key: 'hardwoodFloors', threshold: 0.75, label: 'The Classic Aesthete', bullet: 'Has a thing for hardwood floors' },
  { key: 'modernFinishes', threshold: 0.75, label: 'The Modern Minimalist', bullet: 'Gravitates toward modern finishes' },
  { key: 'quietNeighborhood', threshold: 0.75, label: 'The Peace & Quiet Type', bullet: 'Values a quiet neighborhood' },
  { key: 'entertainingSpace', threshold: 0.75, label: 'The Social Butterfly', bullet: 'Wants space for entertaining' },
  { key: 'highCeilings', threshold: 0.75, label: 'The Space Maximizer', bullet: 'Loves high ceilings and open air' },
];

const REJECTION_RULES = [
  { key: 'parking', label: 'Rejects anything without parking' },
  { key: 'inUnitLaundry', label: 'Won\'t consider a place without in-unit laundry' },
  { key: 'balcony', label: 'Passes on homes without outdoor space' },
  { key: 'naturalLight', label: 'Avoids dim or poorly lit places' },
];

/**
 * Generate per-user insights.
 * @param {object} tasteVector  – { naturalLight: 0.8, parking: 0.2, … }
 * @param {string} userName
 * @param {Array} noListings    – listings this user rejected
 * @returns {{ archetype: string, bullets: string[] }}
 */
function generateUserInsights(tasteVector, userName, noListings = []) {
  const bullets = [];
  let archetype = 'The Explorer'; // default

  // Pick archetype from highest matching rule
  let bestScore = 0;
  for (const rule of ARCHETYPE_RULES) {
    const score = tasteVector[rule.key] || 0;
    if (score >= rule.threshold && score > bestScore) {
      bestScore = score;
      archetype = rule.label;
      bullets.unshift(rule.bullet);
    } else if (score >= rule.threshold) {
      bullets.push(rule.bullet);
    }
  }

  // Rejection patterns: if user's NO listings consistently lack a feature
  if (noListings.length >= 3) {
    for (const rule of REJECTION_RULES) {
      const lacking = noListings.filter((l) => (l.features[rule.key] || 0) === 0).length;
      if (lacking / noListings.length >= 0.7) {
        bullets.push(rule.label);
      }
    }
  }

  // Cap at 5 bullets
  return { archetype, bullets: bullets.slice(0, 5) };
}

/**
 * Generate group-level insights.
 * @param {object} tasteVectors  – { userId: tasteVector, … }
 * @param {object} userNames     – { userId: name, … }
 * @param {number} groupCompat   – percentage
 * @returns {string[]}
 */
function generateGroupInsights(tasteVectors, userNames, groupCompat) {
  const userIds = Object.keys(tasteVectors);
  const insights = [];

  // Overall vibe
  if (groupCompat >= 80) {
    insights.push('You\'re surprisingly aligned — this group has great taste synergy!');
  } else if (groupCompat >= 60) {
    insights.push('Decent overlap! A few compromises will get you to the perfect place.');
  } else if (groupCompat >= 40) {
    insights.push('There\'s some tension — but the overlapping areas are where the magic is.');
  } else {
    insights.push('Very different tastes! The blend will need creative compromises.');
  }

  // Feature-level group insights
  for (const key of FEATURE_KEYS) {
    const scores = userIds.map((id) => tasteVectors[id][key] || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const allHigh = scores.every((s) => s >= 0.6);
    const allLow = scores.every((s) => s <= 0.25);
    const label = FEATURE_LABELS[key];

    if (allHigh) {
      insights.push(`You all silently prioritize ${label.toLowerCase()} — it matters more than anyone said.`);
    } else if (allLow) {
      insights.push(`Nobody really cares about ${label.toLowerCase()} — skip it in the search.`);
    }
  }

  return insights.slice(0, 6);
}

module.exports = { generateUserInsights, generateGroupInsights };
