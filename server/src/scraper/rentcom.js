/**
 * Rent.com scraper — fetches rental listings for Irvine & Orange County.
 *
 * Strategy:
 *   1. Hit search results page → extract JSON-LD ApartmentComplex blocks (name, images, address, detail URL)
 *   2. Fetch each detail page → parse rich JSON-LD (geo, price, beds/baths/sqft, amenities, description, images)
 *   3. Transform into HomeBlend frontend schema
 *
 * Rent.com serves clean JSON-LD structured data — no JS rendering needed.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { REQUEST_DEFAULTS } = require('./config');

const BASE = 'https://www.rent.com';

/** ── Target areas (Irvine + nearby OC) ─────────────────── */
const IRVINE_AREAS = [
  { slug: 'california/irvine-apartments',        label: 'Irvine' },
  { slug: 'california/tustin-apartments',         label: 'Tustin' },
  { slug: 'california/costa-mesa-apartments',     label: 'Costa Mesa' },
  { slug: 'california/lake-forest-apartments',    label: 'Lake Forest' },
  { slug: 'california/newport-beach-apartments',  label: 'Newport Beach' },
  { slug: 'california/santa-ana-apartments',      label: 'Santa Ana' },
  { slug: 'california/anaheim-apartments',        label: 'Anaheim' },
  { slug: 'california/orange-apartments',         label: 'Orange' },
  { slug: 'california/mission-viejo-apartments',  label: 'Mission Viejo' },
  { slug: 'california/aliso-viejo-apartments',    label: 'Aliso Viejo' },
];

function randomUA() {
  const list = REQUEST_DEFAULTS.userAgents;
  return list[Math.floor(Math.random() * list.length)];
}

function baseHeaders() {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Search results page ──────────────────────────────────── */

/**
 * Scrape the search results page for a given area slug.
 * Returns summaries with name, address, images, and detail URL.
 */
async function scrapeSearchPage(slug, opts = {}) {
  const limit = opts.limit || 25;
  const url = `${BASE}/${slug}`;

  console.log(`  [rent.com] Fetching ${url}`);

  const { data: html } = await axios.get(url, {
    headers: baseHeaders(),
    timeout: REQUEST_DEFAULTS.timeout,
  });

  const $ = cheerio.load(html);
  const results = [];

  // Parse JSON-LD ApartmentComplex blocks from search page
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).html());

      if (data['@type'] === 'ApartmentComplex') {
        results.push(parseLdSummary(data));
      }
    } catch { /* skip bad JSON */ }
  });

  console.log(`  [rent.com] Found ${results.length} listings for ${slug}`);
  return results.slice(0, limit);
}

function parseLdSummary(data) {
  const addr = data.address || {};
  const images = (data.image || [])
    .map((img) => (typeof img === 'string' ? img : img?.contentUrl))
    .filter(Boolean);

  return {
    name: data.name || '',
    detailUrl: data.url || '',
    address: addr.streetAddress || '',
    city: addr.addressLocality || '',
    state: addr.addressRegion || 'California',
    zip: addr.postalCode || '',
    telephone: data.telephone || '',
    images,
    _source: 'rent.com',
  };
}

/* ── Detail page parser ───────────────────────────────────── */

/**
 * Fetch a listing's detail page for rich data: geo, price, beds/baths/sqft, amenities, description, images.
 */
async function fetchDetail(detailUrl) {
  if (!detailUrl || !detailUrl.startsWith('http')) return null;

  try {
    console.log(`  [rent.com:detail] ${detailUrl.split('/').pop()}`);
    const { data: html } = await axios.get(detailUrl, {
      headers: baseHeaders(),
      timeout: REQUEST_DEFAULTS.timeout,
    });

    const $ = cheerio.load(html);

    // Find the main JSON-LD block (ItemPage → mainEntity = ApartmentComplex)
    let mainEntity = null;
    let aboutProduct = null;

    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const data = JSON.parse($(script).html());

        if (data['@type'] === 'ItemPage') {
          mainEntity = data.mainEntity || null;
          aboutProduct = data.about || null;
        } else if (data['@type'] === 'ApartmentComplex') {
          mainEntity = data;
        }
      } catch { /* skip */ }
    });

    if (!mainEntity) return null;

    // ── Name / Address / Geo ──
    const name = mainEntity.name || '';
    const addr = mainEntity.address || {};
    const geo = mainEntity.geo || {};
    const lat = geo.latitude || null;
    const lng = geo.longitude || null;

    const address = typeof addr === 'string'
      ? addr
      : [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
          .filter(Boolean).join(', ');

    // ── Description ──
    const description = mainEntity.description
      || aboutProduct?.description
      || $('meta[name="description"]').attr('content')
      || '';

    // ── Price (from aboutProduct offers) ──
    let lowPrice = null;
    let highPrice = null;
    const offers = aboutProduct?.offers || mainEntity.offers || {};
    if (offers.lowPrice) lowPrice = offers.lowPrice;
    if (offers.highPrice) highPrice = offers.highPrice;

    // ── Images ──
    const images = (mainEntity.image || [])
      .map((img) => (typeof img === 'string' ? img : img?.contentUrl))
      .filter(Boolean);

    // ── Amenities ──
    const amenities = (mainEntity.amenityFeature || [])
      .filter((a) => a.value === true)
      .map((a) => a.name)
      .filter(Boolean);

    // ── Floorplans (containsPlace → Apartment) ──
    const floorplans = (mainEntity.containsPlace || []).map((place) => {
      const rooms = place.numberOfRooms || [];
      let beds = 0, baths = 0;
      for (const room of rooms) {
        if (room.unitText === 'Bedrooms') beds = room.value || 0;
        if (room.unitText === 'Bathrooms') baths = room.value || 0;
      }
      const sqft = place.floorSize?.value || 0;
      return {
        model: place.name || '',
        beds,
        baths,
        sqft,
      };
    });

    // ── Pet policy ──
    const petFriendly = amenities.some((a) => /pet/i.test(a));

    // ── Parking ──
    const hasParking = amenities.some((a) => /parking|garage/i.test(a));

    // ── Laundry ──
    const hasInUnitLaundry = amenities.some((a) => /washer|dryer|laundry|in[- ]unit/i.test(a))
      || /in[- ]unit.*laundry|washer.*dryer/i.test(description);

    return {
      name,
      address,
      city: addr.addressLocality || '',
      state: addr.addressRegion || 'California',
      zip: addr.postalCode || '',
      lat,
      lng,
      description: description.slice(0, 600),
      lowPrice,
      highPrice,
      images: images.slice(0, 10),
      amenities,
      floorplans,
      petFriendly,
      hasParking,
      hasInUnitLaundry,
      telephone: mainEntity.telephone || '',
    };
  } catch (err) {
    console.log(`  [rent.com:detail] Error: ${err.message}`);
    return null;
  }
}

/* ── Transform to HomeBlend frontend schema ───────────────── */

let idCounter = 0;

/**
 * Transform a scraped listing into the shape used by src/data/properties.js
 *
 * Frontend schema:
 *   { id, title, location, price, priceNum, category, beds, baths, sqft,
 *     yearBuilt, tags, petFriendly, parking, laundry, lng, lat, images, aiOverview }
 */
function transformToFrontend(summary, detail) {
  idCounter++;

  const name = detail?.name || summary.name || 'Rental Listing';
  const city = detail?.city || summary.city || 'Irvine';

  // Price — use lowPrice from detail, or average if range
  let priceNum = 0;
  if (detail?.lowPrice) {
    priceNum = Math.round(
      detail.highPrice
        ? (detail.lowPrice + detail.highPrice) / 2
        : detail.lowPrice
    );
  }
  const priceFormatted = priceNum > 0 ? `$${priceNum.toLocaleString()} / mo` : 'Call for price';

  // Beds/baths/sqft from floorplans — pick median plan
  let beds = 0, baths = 0, sqft = 0;
  if (detail?.floorplans?.length > 0) {
    const plan = detail.floorplans[Math.floor(detail.floorplans.length / 2)];
    beds = plan.beds;
    baths = plan.baths;
    sqft = plan.sqft;
  }

  // Category — infer from name
  const lowerName = name.toLowerCase();
  let category = 'Apartment';
  if (lowerName.includes('townhome') || lowerName.includes('townhouse')) category = 'Townhome';
  else if (lowerName.includes('condo')) category = 'Condo';
  else if (lowerName.includes('single family') || lowerName.includes('house')) category = 'Single Family';
  else if (lowerName.includes('loft')) category = 'Loft';

  // Tags from amenities
  const tags = [];
  const amenities = detail?.amenities || [];
  const amenText = amenities.join(' ').toLowerCase();
  if (amenText.includes('pool') || amenText.includes('swimming')) tags.push('Pool');
  if (amenText.includes('gym') || amenText.includes('fitness')) tags.push('Fitness Center');
  if (amenText.includes('balcony') || amenText.includes('patio')) tags.push('Balcony/Patio');
  if (amenText.includes('pet')) tags.push('Pet Friendly');
  if (amenText.includes('air conditioning') || amenText.includes('a/c')) tags.push('A/C');
  if (amenText.includes('dishwasher')) tags.push('Dishwasher');
  if (amenText.includes('ev charging') || amenText.includes('electric vehicle')) tags.push('EV Charging');
  if (amenText.includes('concierge') || amenText.includes('doorman')) tags.push('Concierge');
  if (amenText.includes('clubhouse') || amenText.includes('lounge')) tags.push('Clubhouse');
  if (amenText.includes('rooftop') || amenText.includes('roof deck')) tags.push('Rooftop');
  if (amenText.includes('dog park') || amenText.includes('bark')) tags.push('Dog Park');
  if (amenText.includes('grill') || amenText.includes('bbq')) tags.push('BBQ Area');
  if (amenText.includes('business') || amenText.includes('co-work')) tags.push('Co-Working');
  if (amenText.includes('spa') || amenText.includes('sauna')) tags.push('Spa');
  if (amenText.includes('garage')) tags.push('Garage');
  if (amenText.includes('gated')) tags.push('Gated Community');
  // Cap at 5 tags
  const finalTags = tags.slice(0, 5);
  if (finalTags.length === 0) finalTags.push(category);

  // Parking label
  let parkingLabel = null;
  if (detail?.hasParking) {
    parkingLabel = amenText.includes('garage') ? 'Garage' : 'Parking available';
  }

  // Laundry label
  let laundryLabel = null;
  if (detail?.hasInUnitLaundry) laundryLabel = 'In-unit';
  else if (amenText.includes('laundry')) laundryLabel = 'On-site laundry';

  // Images — use detail images (up to 8), fallback to summary images
  const images = (detail?.images?.length > 0 ? detail.images : summary.images || []).slice(0, 8);
  if (images.length === 0) {
    images.push('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800');
  }

  // Description
  const desc = detail?.description || '';
  const aiOverview = desc.length > 30
    ? desc.replace(/\s+/g, ' ').slice(0, 500)
    : `${name} offers ${beds > 0 ? beds + '-bedroom' : 'studio'} rental living in ${city}. ${finalTags.length > 0 ? 'Features include ' + finalTags.join(', ').toLowerCase() + '.' : ''}`;

  return {
    id: idCounter,
    title: name,
    location: `${city}, CA`,
    price: priceFormatted,
    priceNum: priceNum || 0,
    category,
    beds: beds || 1,
    baths: baths || 1,
    sqft: sqft || 0,
    yearBuilt: null,
    tags: finalTags,
    petFriendly: detail?.petFriendly ?? false,
    parking: parkingLabel,
    laundry: laundryLabel,
    lng: detail?.lng || -117.78,
    lat: detail?.lat || 33.68,
    images,
    aiOverview,
    listingUrl: summary.detailUrl || '',
  };
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Scrape Irvine/OC rental listings from Rent.com.
 *
 * @param {{ areas?: Array, limit?: number, enrich?: boolean }} opts
 * @returns {Promise<Array>} Listings in HomeBlend frontend schema
 */
async function scrapeIrvineOC(opts = {}) {
  const areas = opts.areas || IRVINE_AREAS;
  const limitPerArea = opts.limit || 10;
  const enrich = opts.enrich !== false; // default true
  idCounter = 0;

  const allListings = [];

  for (const area of areas) {
    console.log(`\n── Scraping ${area.label} ──────────────────────`);

    let summaries = [];
    try {
      summaries = await scrapeSearchPage(area.slug, { limit: limitPerArea });
    } catch (err) {
      console.log(`  ✗ Search failed for ${area.label}: ${err.message}`);
      continue;
    }

    if (summaries.length === 0) {
      console.log(`  ○ No results for ${area.label}`);
      continue;
    }

    for (const summary of summaries) {
      let detail = null;
      if (enrich && summary.detailUrl) {
        try {
          detail = await fetchDetail(summary.detailUrl);
          await sleep(800 + Math.random() * 1200); // polite delay
        } catch (err) {
          console.log(`  ✗ Detail fetch failed: ${err.message}`);
        }
      }

      const listing = transformToFrontend(summary, detail);
      if (listing.priceNum > 0 || listing.title !== 'Rental Listing') {
        allListings.push(listing);
      }
    }

    // Delay between areas
    const idx = areas.indexOf(area);
    if (idx < areas.length - 1) {
      const delay = 1500 + Math.random() * 1500;
      console.log(`  (sleeping ${Math.round(delay)}ms before next area...)`);
      await sleep(delay);
    }
  }

  console.log(`\n✓ Scraped ${allListings.length} total listings from Rent.com`);
  return allListings;
}

module.exports = {
  scrapeIrvineOC,
  scrapeSearchPage,
  fetchDetail,
  transformToFrontend,
  IRVINE_AREAS,
};
