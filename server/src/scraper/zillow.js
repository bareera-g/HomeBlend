/**
 * Zillow scraper — fetches rental listings via Zillow's internal search API.
 *
 * Strategy:
 *   1. Hit the search results page to grab cookies + CSRF tokens
 *   2. Call the internal search API (GetSearchPageState) for structured JSON
 *   3. Parse and return raw listing objects
 *
 * Falls back to extracting __NEXT_DATA__ from the HTML if the API is blocked.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { REQUEST_DEFAULTS, SEARCH_DEFAULTS } = require('./config');

const BASE = 'https://www.zillow.com';

/** Pick a random user-agent for each request. */
function randomUA() {
  const list = REQUEST_DEFAULTS.userAgents;
  return list[Math.floor(Math.random() * list.length)];
}

/** Shared headers that mimic a real browser session. */
function baseHeaders() {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };
}

/**
 * Build the Zillow search URL for a city's rental listings.
 * @param {string} zillowSlug  e.g. "los-angeles-ca"
 * @returns {string}
 */
function buildSearchUrl(zillowSlug) {
  return `${BASE}/${zillowSlug}/rentals/`;
}

/**
 * Build the search query state params Zillow's API expects.
 */
function buildSearchQueryState(zillowSlug) {
  return {
    pagination: {},
    isMapVisible: false,
    filterState: {
      isForRent: { value: true },
      isForSaleByAgent: { value: false },
      isForSaleByOwner: { value: false },
      isNewConstruction: { value: false },
      isComingSoon: { value: false },
      isAuction: { value: false },
      isForSaleForeclosure: { value: false },
      monthlyPayment: {
        min: SEARCH_DEFAULTS.minPrice,
        max: SEARCH_DEFAULTS.maxPrice,
      },
      beds: { min: SEARCH_DEFAULTS.minBeds, max: SEARCH_DEFAULTS.maxBeds },
    },
    isListVisible: true,
  };
}

/* ── Strategy 1: Extract __NEXT_DATA__ from the HTML page ─── */

/**
 * Fetch the HTML search page and extract listing data from embedded JSON.
 */
async function scrapeFromHtml(zillowSlug) {
  const url = buildSearchUrl(zillowSlug);
  console.log(`  [zillow:html] Fetching ${url}`);

  const { data: html } = await axios.get(url, {
    headers: baseHeaders(),
    timeout: REQUEST_DEFAULTS.timeout,
  });

  const $ = cheerio.load(html);

  // Attempt 1: __NEXT_DATA__
  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      const results =
        parsed?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
        parsed?.props?.pageProps?.searchPageState?.cat1?.searchResults?.mapResults ||
        [];
      if (results.length > 0) {
        console.log(`  [zillow:html] Found ${results.length} listings via __NEXT_DATA__`);
        return results;
      }
    } catch { /* fall through */ }
  }

  // Attempt 2: look for inline JSON in script tags with search results data
  const scripts = $('script').toArray();
  for (const script of scripts) {
    const text = $(script).html() || '';
    // Zillow sometimes embeds results in a window.__INITIAL_STATE__ or similar pattern
    const patterns = [
      /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
      /"listResults"\s*:\s*(\[.+?\])\s*,\s*"mapResults"/s,
      /"searchResults"\s*:\s*({.+?})\s*,?\s*}/s,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const obj = JSON.parse(match[1]);
          const items = Array.isArray(obj) ? obj : obj.listResults || obj.mapResults || [];
          if (items.length > 0) {
            console.log(`  [zillow:html] Found ${items.length} listings via inline JSON`);
            return items;
          }
        } catch { /* try next pattern */ }
      }
    }
  }

  // Attempt 3: scrape the listing cards directly from DOM
  const cards = $('article[data-test="property-card"], li[class*="ListItem"], div[class*="property-card"]');
  if (cards.length > 0) {
    console.log(`  [zillow:html] Parsing ${cards.length} DOM cards`);
    const results = [];
    cards.each((_, card) => {
      const $card = $(card);
      const link = $card.find('a[href*="/homedetails/"], a[data-test="property-card-link"]');
      const href = link.attr('href') || '';
      const zpid = href.match(/\/(\d+)_zpid/) ? href.match(/\/(\d+)_zpid/)[1] : null;

      results.push({
        zpid,
        detailUrl: href.startsWith('http') ? href : `${BASE}${href}`,
        address: $card.find('address, [data-test="property-card-addr"]').text().trim(),
        price: $card.find('[data-test="property-card-price"], span[class*="Price"]').text().trim(),
        beds: $card.find('[class*="bed"], abbr[class*="bed"]').text().trim(),
        baths: $card.find('[class*="bath"], abbr[class*="bath"]').text().trim(),
        sqft: $card.find('[class*="sqft"], abbr[class*="sqft"]').text().trim(),
        imgSrc: $card.find('img').first().attr('src') || '',
        _fromDom: true,
      });
    });
    return results.filter((r) => r.address || r.zpid);
  }

  console.log(`  [zillow:html] No listings found on page`);
  return [];
}

/* ── Strategy 2: Zillow internal API ──────────────────────── */

async function scrapeFromApi(zillowSlug) {
  const searchUrl = buildSearchUrl(zillowSlug);
  const ua = randomUA();

  // First: visit the page to grab cookies
  console.log(`  [zillow:api] Warming session for ${zillowSlug}...`);
  let cookies = '';
  try {
    const warmResp = await axios.get(searchUrl, {
      headers: { ...baseHeaders(), 'User-Agent': ua },
      timeout: REQUEST_DEFAULTS.timeout,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const setCookies = warmResp.headers['set-cookie'] || [];
    cookies = setCookies.map((c) => c.split(';')[0]).join('; ');
  } catch { /* continue without cookies */ }

  // Hit the search API with the same session
  const apiUrl = `${BASE}/async-create-search-page-state`;
  const searchState = buildSearchQueryState(zillowSlug);

  console.log(`  [zillow:api] Calling search API for ${zillowSlug}...`);
  const { data } = await axios.put(apiUrl, {
    searchQueryState: searchState,
    wants: { cat1: ['listResults'], cat2: ['total'] },
    requestId: Math.floor(Math.random() * 100),
  }, {
    headers: {
      'User-Agent': ua,
      'Content-Type': 'application/json',
      'Referer': searchUrl,
      'Origin': BASE,
      'Cookie': cookies,
    },
    timeout: REQUEST_DEFAULTS.timeout,
  });

  const results =
    data?.cat1?.searchResults?.listResults ||
    data?.cat1?.searchResults?.mapResults ||
    data?.searchResults?.listResults ||
    [];

  console.log(`  [zillow:api] Got ${results.length} listings`);
  return results;
}

/* ── Listing detail enrichment ────────────────────────────── */

/**
 * Fetch a single listing detail page to get richer info
 * (description, amenities, year built, images, floor plans, etc.)
 */
async function fetchListingDetail(detailUrl) {
  if (!detailUrl || !detailUrl.startsWith('http')) return null;

  try {
    const { data: html } = await axios.get(detailUrl, {
      headers: baseHeaders(),
      timeout: REQUEST_DEFAULTS.timeout,
    });

    const $ = cheerio.load(html);

    // Try __NEXT_DATA__ first
    const nextData = $('#__NEXT_DATA__').html();
    if (nextData) {
      const parsed = JSON.parse(nextData);
      const property =
        parsed?.props?.pageProps?.componentProps?.gdpClientCache?.[Object.keys(parsed?.props?.pageProps?.componentProps?.gdpClientCache || {})[0]]?.property ||
        parsed?.props?.pageProps?.property ||
        null;
      if (property) return property;
    }

    // Fallback: grab what we can from meta tags and DOM
    return {
      description: $('meta[name="description"]').attr('content') || '',
      yearBuilt: null,
      images: $('img[src*="zillowstatic"]').toArray().map((img) => $(img).attr('src')).filter(Boolean),
    };
  } catch {
    return null;
  }
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Scrape rental listings for a given city from Zillow.
 * Tries the API first, falls back to HTML scraping.
 *
 * @param {{ city: string, zillow: string }} cityConfig
 * @param {{ limit?: number, enrichDetails?: boolean }} opts
 * @returns {Promise<Array>} Raw Zillow listing objects
 */
async function scrapeCity(cityConfig, opts = {}) {
  const { zillow: slug } = cityConfig;
  const limit = opts.limit || SEARCH_DEFAULTS.listingsPerCity;
  const enrichDetails = opts.enrichDetails ?? false;

  let results = [];

  // Strategy 1: API
  try {
    results = await scrapeFromApi(slug);
  } catch (err) {
    console.log(`  [zillow] API failed for ${slug}: ${err.message}`);
  }

  // Strategy 2: HTML fallback
  if (results.length === 0) {
    try {
      results = await scrapeFromHtml(slug);
    } catch (err) {
      console.log(`  [zillow] HTML scrape also failed for ${slug}: ${err.message}`);
    }
  }

  // Trim to limit
  results = results.slice(0, limit);

  // Optional: enrich each listing with detail page data
  if (enrichDetails && results.length > 0) {
    console.log(`  [zillow] Enriching ${results.length} listings with detail data...`);
    for (let i = 0; i < results.length; i++) {
      const url = results[i].detailUrl || results[i].hdpUrl;
      if (url) {
        const detail = await fetchListingDetail(
          url.startsWith('http') ? url : `${BASE}${url}`
        );
        if (detail) {
          results[i]._detail = detail;
        }
        // Small delay between detail requests
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  return results;
}

module.exports = {
  scrapeCity,
  scrapeFromHtml,
  scrapeFromApi,
  fetchListingDetail,
};
