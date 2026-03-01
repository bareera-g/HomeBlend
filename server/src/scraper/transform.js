/**
 * Data transformer — converts raw scraped objects from Zillow / Redfin
 * into the enriched listing format used by the HomeBlend backend.
 *
 * Output schema (superset of the existing model):
 * {
 *   id, title, address, city, state, zipCode, price, beds, baths, sqft,
 *   yearBuilt, propertyType, latitude, longitude,
 *   imageUrl,          // primary image (backward compat)
 *   images,            // array of all images
 *   floorPlanUrl,      // if available
 *   description,
 *   amenities,         // { building: [], unit: [], outdoor: [], location: [] }
 *   features,          // binary 0/1 flags for the blend engine
 *   listingUrl,        // link back to original listing
 *   source,            // "zillow" | "redfin"
 *   scrapedAt,         // ISO timestamp
 * }
 */

const { FEATURE_KEYWORD_MAP, AMENITY_CATEGORIES } = require('./config');

/** Counter for deterministic IDs across a run. */
let idCounter = 0;

function resetIdCounter(start = 0) {
  idCounter = start;
}

/**
 * Generate a sequential listing ID.
 */
function nextId() {
  idCounter++;
  return `lst-${String(idCounter).padStart(3, '0')}`;
}

/* ── Feature detection ────────────────────────────────────── */

/**
 * Analyze text against the keyword map to produce binary feature flags.
 * @param {string} text  Combined description + amenities text, lowercased
 * @returns {{ [featureKey: string]: 0 | 1 }}
 */
function detectFeatures(text) {
  const lower = (text || '').toLowerCase();
  const features = {};
  for (const [key, keywords] of Object.entries(FEATURE_KEYWORD_MAP)) {
    features[key] = keywords.some((kw) => lower.includes(kw)) ? 1 : 0;
  }
  return features;
}

/**
 * Extract amenity tags from text, grouped by category.
 */
function extractAmenities(text) {
  const lower = (text || '').toLowerCase();
  const result = {};
  for (const [category, keywords] of Object.entries(AMENITY_CATEGORIES)) {
    result[category] = keywords.filter((kw) => lower.includes(kw));
  }
  return result;
}

/* ── Parse helpers ────────────────────────────────────────── */

/** Extract a number from a price string like "$2,800/mo" or "$2800" */
function parsePrice(raw) {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const str = String(raw).replace(/[^0-9.]/g, '');
  return parseInt(str, 10) || 0;
}

/** Extract integer from strings like "3 bd", "3", etc. */
function parseIntField(raw) {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const match = String(raw).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/* ── Zillow transformer ──────────────────────────────────── */

function transformZillow(raw, cityConfig) {
  // Zillow results can come in several shapes depending on the extraction path
  const address = raw.address || raw.streetAddress || raw.addressStreet || '';
  const fullAddr = typeof address === 'object'
    ? `${address.streetAddress || ''}, ${address.city || ''}, ${address.state || ''} ${address.zipcode || ''}`
    : address;

  const price = parsePrice(
    raw.unformattedPrice || raw.price || raw.units?.[0]?.price || raw.hdpData?.homeInfo?.price
  );
  const beds = parseIntField(raw.beds || raw.bedrooms || raw.hdpData?.homeInfo?.bedrooms);
  const baths = parseIntField(raw.baths || raw.bathrooms || raw.hdpData?.homeInfo?.bathrooms);
  const sqft = parseIntField(raw.area || raw.livingArea || raw.hdpData?.homeInfo?.livingArea);
  const yearBuilt = raw.yearBuilt || raw.hdpData?.homeInfo?.yearBuilt || raw._detail?.yearBuilt || null;

  // Images
  const primaryImg = raw.imgSrc || raw.image || raw.hdpData?.homeInfo?.hiResLink || '';
  const detailImages = raw._detail?.responsivePhotos?.map((p) => p.mixedSources?.jpeg?.[0]?.url) || [];
  const images = [primaryImg, ...detailImages].filter(Boolean);

  // Floor plan — Zillow sometimes has this in the detail object
  const floorPlanUrl = raw._detail?.floorPlans?.[0]?.imageUrl || null;

  // Text blob for NLP-style feature extraction
  const description = raw.description || raw._detail?.description || raw.hdpData?.homeInfo?.description || '';
  const amenitiesText = [
    description,
    raw.hdpData?.homeInfo?.homeDescription || '',
    (raw._detail?.amenities || []).map((a) => a.amenities?.join(', ')).join(', '),
    raw.statusText || '',
    raw.title || '',
  ].join(' ');

  const features = detectFeatures(amenitiesText);
  const amenities = extractAmenities(amenitiesText);

  // Infer some features from structured data if the text missed them
  if (sqft > 0 && sqft >= 1200 && !features.entertainingSpace) {
    features.entertainingSpace = 1;
  }
  if (yearBuilt && yearBuilt >= 2015) {
    features.modernFinishes = 1;
  }

  const lat = raw.latLong?.latitude || raw.latitude || raw.hdpData?.homeInfo?.latitude || null;
  const lng = raw.latLong?.longitude || raw.longitude || raw.hdpData?.homeInfo?.longitude || null;

  const detailUrl =
    raw.detailUrl || raw.hdpUrl || raw.hdpData?.homeInfo?.hdpUrl || '';
  const listingUrl = detailUrl.startsWith('http')
    ? detailUrl
    : detailUrl
      ? `https://www.zillow.com${detailUrl}`
      : '';

  // Title
  const title = raw.statusText || raw.buildingName || buildTitle(cityConfig.city, beds, price);

  return {
    id: nextId(),
    title,
    address: fullAddr,
    city: cityConfig.city,
    state: cityConfig.state,
    zipCode: raw.addressZipcode || raw.hdpData?.homeInfo?.zipcode || '',
    price,
    beds,
    baths,
    sqft,
    yearBuilt,
    propertyType: raw.homeType || raw.hdpData?.homeInfo?.homeType || 'apartment',
    latitude: lat,
    longitude: lng,
    imageUrl: primaryImg,
    images,
    floorPlanUrl,
    description: description.slice(0, 500),
    amenities,
    features,
    listingUrl,
    source: 'zillow',
    scrapedAt: new Date().toISOString(),
  };
}

/* ── Redfin transformer ──────────────────────────────────── */

function transformRedfin(raw, cityConfig) {
  const price = parsePrice(raw.price?.value || raw.price);
  const beds = parseIntField(raw.beds);
  const baths = parseIntField(raw.baths);
  const sqft = parseIntField(raw.sqFt?.value || raw.sqFt);
  const yearBuilt = raw.yearBuilt?.value || raw._belowTheFold?.yearBuilt || null;

  const streetAddr = raw.streetLine?.value || raw.streetLine || '';
  const city = raw.city || cityConfig.city;
  const stateCode = raw.state || cityConfig.state;
  const zip = raw.zip || raw.postalCode?.value || '';
  const fullAddr = `${streetAddr}, ${city}, ${stateCode} ${zip}`.trim();

  // Images
  const primaryImg = raw.photoUrls?.[0] ||
    raw._aboveTheFold?.mediaBrowserInfo?.photos?.[0]?.photoUrls?.fullScreenPhotoUrl || '';
  const allPhotos = raw._aboveTheFold?.mediaBrowserInfo?.photos?.map(
    (p) => p.photoUrls?.fullScreenPhotoUrl || p.photoUrls?.nonFullScreenPhotoUrl
  ) || [];
  const images = [primaryImg, ...allPhotos].filter(Boolean);

  const floorPlanUrl = raw._aboveTheFold?.mediaBrowserInfo?.floorPlans?.[0]?.floorPlanUrl || null;

  // Description & amenities
  const description = raw._belowTheFold?.listingRemarks || raw.listingRemarks || '';
  const amenityItems = raw._belowTheFold?.amenitiesInfo?.amenities || [];
  const amenitiesText = [
    description,
    amenityItems.map((a) => `${a.header || ''}: ${(a.amenityGroups || []).map((g) => (g.amenityEntries || []).map((e) => e.amenityName).join(', ')).join(', ')}`).join(' '),
  ].join(' ');

  const features = detectFeatures(amenitiesText);
  const amenities = extractAmenities(amenitiesText);

  if (sqft >= 1200 && !features.entertainingSpace) features.entertainingSpace = 1;
  if (yearBuilt && yearBuilt >= 2015) features.modernFinishes = 1;

  const lat = raw.latLong?.latitude || raw.latitude?.value || null;
  const lng = raw.latLong?.longitude || raw.longitude?.value || null;

  const slug = raw.url || '';
  const listingUrl = slug.startsWith('http') ? slug : slug ? `https://www.redfin.com${slug}` : '';

  const title = buildTitle(city, beds, price);

  return {
    id: nextId(),
    title,
    address: fullAddr,
    city,
    state: stateCode,
    zipCode: zip,
    price,
    beds,
    baths,
    sqft,
    yearBuilt,
    propertyType: raw.propertyType?.value || raw.propertyType || 'apartment',
    latitude: lat,
    longitude: lng,
    imageUrl: primaryImg,
    images,
    floorPlanUrl,
    description: (typeof description === 'string' ? description : '').slice(0, 500),
    amenities,
    features,
    listingUrl,
    source: 'redfin',
    scrapedAt: new Date().toISOString(),
  };
}

/* ── Title builder ────────────────────────────────────────── */

const ADJECTIVES = [
  'Charming', 'Modern', 'Spacious', 'Bright', 'Cozy', 'Sleek',
  'Stylish', 'Sun-Drenched', 'Renovated', 'Stunning', 'Lovely',
  'Beautiful', 'Elegant', 'Inviting', 'Fresh',
];

const TYPES_MAP = {
  1: 'Studio', 2: 'Apartment', 3: 'Home', 4: 'Family Home', 5: 'Residence',
};

function buildTitle(city, beds, price) {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const type = TYPES_MAP[beds] || `${beds}-Bed Home`;
  return `${adj} ${type} in ${city}`;
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Transform a batch of raw listings from a given source.
 * @param {Array} rawListings
 * @param {{ city: string, state: string }} cityConfig
 * @param {"zillow" | "redfin"} source
 * @returns {Array} Transformed listings in the HomeBlend schema
 */
function transformBatch(rawListings, cityConfig, source) {
  const fn = source === 'redfin' ? transformRedfin : transformZillow;
  return rawListings
    .map((raw) => {
      try {
        return fn(raw, cityConfig);
      } catch (err) {
        console.error(`  [transform] Failed to transform listing: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean)
    .filter((l) => l.price > 0 && (l.beds > 0 || l.sqft > 0)); // basic sanity
}

module.exports = {
  transformBatch,
  transformZillow,
  transformRedfin,
  detectFeatures,
  extractAmenities,
  resetIdCounter,
};
