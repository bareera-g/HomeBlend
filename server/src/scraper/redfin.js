/**
 * Redfin scraper — fallback source for rental listings.
 *
 * Redfin exposes a lightweight JSON API behind their "stingray" service
 * which is more reliable than scraping HTML. This module targets both:
 *   1. The search/gis endpoint (map-based search)
 *   2. The download endpoint (CSV of search results)
 */

const axios = require('axios');
const { REQUEST_DEFAULTS, SEARCH_DEFAULTS } = require('./config');

const BASE = 'https://www.redfin.com';
const STINGRAY = `${BASE}/stingray`;

function randomUA() {
  const list = REQUEST_DEFAULTS.userAgents;
  return list[Math.floor(Math.random() * list.length)];
}

function baseHeaders() {
  return {
    'User-Agent': randomUA(),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `${BASE}/`,
    'Origin': BASE,
  };
}

/**
 * Step 1: Use Redfin's auto-complete to resolve a city name to a region ID + bounding box.
 * @param {string} cityState  e.g. "Los Angeles, CA"
 */
async function resolveLocation(cityState) {
  const url = `${STINGRAY}/do/location-autocomplete?location=${encodeURIComponent(cityState)}&v=2`;
  console.log(`  [redfin] Resolving location: ${cityState}`);

  const { data } = await axios.get(url, {
    headers: baseHeaders(),
    timeout: REQUEST_DEFAULTS.timeout,
  });

  // Redfin returns: {}&&{"payload": {"sections": [...]}}
  const jsonStr = typeof data === 'string' ? data.replace(/^{}&&/, '') : JSON.stringify(data);
  const parsed = JSON.parse(jsonStr);

  const sections = parsed?.payload?.sections || [];
  for (const section of sections) {
    for (const row of section.rows || []) {
      if (row.type === 6 || row.type === 2) { // city or neighborhood
        return {
          regionId: row.id,
          regionType: row.type,
          name: row.name,
          url: row.url,
        };
      }
    }
  }

  return null;
}

/**
 * Step 2: Search for rental listings in the resolved region.
 */
async function searchRegion(regionId, regionType) {
  const url = `${STINGRAY}/api/gis?al=1&region_id=${regionId}&region_type=${regionType}&sf=1,2,3,5,6,7&status=9&uipt=1,2,3,4,5,6,7,8&v=8`;

  console.log(`  [redfin] Searching region ${regionId}...`);

  const { data } = await axios.get(url, {
    headers: baseHeaders(),
    timeout: REQUEST_DEFAULTS.timeout,
  });

  const jsonStr = typeof data === 'string' ? data.replace(/^{}&&/, '') : JSON.stringify(data);
  const parsed = JSON.parse(jsonStr);

  return parsed?.payload?.homes || [];
}

/**
 * Step 3: Fetch detail for a single listing (for enrichment).
 */
async function fetchListingDetail(propertyId) {
  try {
    const url = `${STINGRAY}/api/home/details/belowTheFold?propertyId=${propertyId}&accessLevel=1`;
    const { data } = await axios.get(url, {
      headers: baseHeaders(),
      timeout: REQUEST_DEFAULTS.timeout,
    });

    const jsonStr = typeof data === 'string' ? data.replace(/^{}&&/, '') : JSON.stringify(data);
    const parsed = JSON.parse(jsonStr);
    return parsed?.payload || null;
  } catch {
    return null;
  }
}

/**
 * Fetch above-the-fold detail (images, basic info).
 */
async function fetchAboveTheFold(propertyId, listingId) {
  try {
    const url = `${STINGRAY}/api/home/details/aboveTheFold?propertyId=${propertyId}&listingId=${listingId || ''}&accessLevel=1`;
    const { data } = await axios.get(url, {
      headers: baseHeaders(),
      timeout: REQUEST_DEFAULTS.timeout,
    });

    const jsonStr = typeof data === 'string' ? data.replace(/^{}&&/, '') : JSON.stringify(data);
    const parsed = JSON.parse(jsonStr);
    return parsed?.payload || null;
  } catch {
    return null;
  }
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Scrape rental listings for a given city from Redfin.
 *
 * @param {{ city: string, state: string, redfin: string }} cityConfig
 * @param {{ limit?: number, enrichDetails?: boolean }} opts
 * @returns {Promise<Array>} Raw Redfin listing objects
 */
async function scrapeCity(cityConfig, opts = {}) {
  const { city, state } = cityConfig;
  const limit = opts.limit || SEARCH_DEFAULTS.listingsPerCity;
  const enrichDetails = opts.enrichDetails ?? false;

  // Resolve city → region
  const location = await resolveLocation(`${city}, ${state}`);
  if (!location) {
    console.log(`  [redfin] Could not resolve ${city}, ${state}`);
    return [];
  }

  // Search for rentals
  let homes = await searchRegion(location.regionId, location.regionType);
  console.log(`  [redfin] Found ${homes.length} raw results for ${city}`);

  // Filter to rentals within price range
  homes = homes.filter((h) => {
    const price = h.price?.value || h.price || 0;
    return price >= SEARCH_DEFAULTS.minPrice && price <= SEARCH_DEFAULTS.maxPrice;
  });

  // Trim to limit
  homes = homes.slice(0, limit);

  // Enrich with details if requested
  if (enrichDetails && homes.length > 0) {
    console.log(`  [redfin] Enriching ${homes.length} listings...`);
    for (let i = 0; i < homes.length; i++) {
      const propId = homes[i].propertyId || homes[i].mlsId?.value;
      const listId = homes[i].listingId;
      if (propId) {
        const [above, below] = await Promise.all([
          fetchAboveTheFold(propId, listId),
          fetchListingDetail(propId),
        ]);
        homes[i]._aboveTheFold = above;
        homes[i]._belowTheFold = below;
        // Small delay
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  return homes;
}

module.exports = {
  scrapeCity,
  resolveLocation,
  searchRegion,
  fetchListingDetail,
};
