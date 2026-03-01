/**
 * Generate a clean, human-quality AI overview for a property listing.
 * Used when the scraped overview is junk (e.g. "Self-Guided Tours Only..." boilerplate).
 *
 * Deterministic — no LLM needed. Produces a 2-3 sentence description from structured fields.
 */

const JUNK_PATTERNS = [
  /self[- ]guided tours/i,
  /appointment required/i,
  /rental rates,? availability,? lease terms/i,
  /subject to change without notice/i,
  /floor plans and square footages displayed/i,
  /stud-to-stud measurements/i,
  /may be based?/i,
];

/**
 * Check if an overview is scraped boilerplate junk.
 */
function isJunkOverview(text) {
  if (!text || typeof text !== 'string') return true;
  const clean = text.trim();
  if (clean.length < 30) return true;
  // If 2+ junk patterns match, it's boilerplate
  let matches = 0;
  for (const pat of JUNK_PATTERNS) {
    if (pat.test(clean)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

/**
 * Build a nicer overview from structured property data.
 */
function generateOverview(listing) {
  const parts = [];

  // Opening — title + location
  const name = listing.title || 'This property';
  const loc = listing.location || '';
  const category = (listing.category || 'home').toLowerCase();

  // Beds/baths
  const beds = listing.beds;
  const baths = listing.baths;
  const sqft = listing.sqft;
  const bedsStr = beds ? `${beds}-bedroom` : 'studio';

  const bathsPart = baths ? `, ${baths}-bath` : '';
  const locPart = loc ? ` in ${loc}` : '';
  parts.push(`${name} is a ${bedsStr}${bathsPart} ${category}${locPart}.`);

  // Size + price
  const sizePrice = [];
  if (sqft) sizePrice.push(`${sqft.toLocaleString()} square feet of living space`);
  if (listing.price) sizePrice.push(`priced at ${listing.price}`);
  if (sizePrice.length > 0) {
    parts.push(`Offering ${sizePrice.join(', ')}.`);
  }

  // Amenities & features
  const features = [];
  if (listing.petFriendly) features.push('pet-friendly living');
  if (listing.parking) features.push(listing.parking.toLowerCase());
  if (listing.laundry) features.push(listing.laundry.toLowerCase());

  // Tags as features
  const tags = listing.tags || [];
  const goodTags = tags.filter(t =>
    !['A/C', 'Pet Friendly'].includes(t) // avoid duplicates
  ).slice(0, 4);

  if (goodTags.length > 0) {
    features.push(...goodTags.map(t => t.toLowerCase()));
  }

  if (features.length > 0) {
    const unique = [...new Set(features)];
    if (unique.length === 1) {
      parts.push(`Features include ${unique[0]}.`);
    } else if (unique.length === 2) {
      parts.push(`Features include ${unique[0]} and ${unique[1]}.`);
    } else {
      const last = unique.pop();
      parts.push(`Features include ${unique.join(', ')}, and ${last}.`);
    }
  }

  return parts.join(' ');
}

/**
 * Clean a property listing's aiOverview field.
 * If the existing overview is junk, replace it with a generated one.
 * Returns a new listing object (does not mutate the original).
 */
function cleanPropertyOverview(listing) {
  if (!listing) return listing;

  if (isJunkOverview(listing.aiOverview)) {
    return {
      ...listing,
      aiOverview: generateOverview(listing),
    };
  }

  return listing;
}

module.exports = {
  isJunkOverview,
  generateOverview,
  cleanPropertyOverview,
};
