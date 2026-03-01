/**
 * Puppeteer-based browser scraper for Zillow.
 * Requires Chrome/Chromium installed on the system.
 *
 * This gets around bot detection by running a real browser.
 * Install Chrome: sudo apt install chromium-browser  (or snap install chromium)
 *
 * Set CHROME_PATH env var if Chrome is in a non-standard location.
 */

const puppeteer = require('puppeteer-core');
const { SEARCH_DEFAULTS, REQUEST_DEFAULTS } = require('./config');

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const fs = require('fs');

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Scrape Zillow rental listings using a headless browser.
 *
 * @param {{ city: string, state: string, zillow: string }} cityConfig
 * @param {{ limit?: number }} opts
 * @returns {Promise<Array>} Raw listing objects extracted from the page
 */
async function scrapeCity(cityConfig, opts = {}) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome/Chromium not found. Install it:\n' +
      '  Ubuntu/Debian: sudo apt install chromium-browser\n' +
      '  macOS:         brew install --cask google-chrome\n' +
      '  Or set CHROME_PATH=/path/to/chrome'
    );
  }

  const limit = opts.limit || SEARCH_DEFAULTS.listingsPerCity;
  const url = `https://www.zillow.com/${cityConfig.zillow}/rentals/`;

  console.log(`  [browser] Launching Chrome at ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1920,1080',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(REQUEST_DEFAULTS.userAgents[0]);

    // Block images and CSS for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`  [browser] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for listings to render
    await page.waitForSelector(
      'article[data-test="property-card"], li[class*="ListItem"], div[id="grid-search-results"]',
      { timeout: 15000 }
    ).catch(() => {
      console.log('  [browser] No listing cards found, trying data extraction anyway...');
    });

    // Extract data: try __NEXT_DATA__ first, then DOM scraping
    const listings = await page.evaluate((maxItems) => {
      // Strategy 1: __NEXT_DATA__
      const script = document.getElementById('__NEXT_DATA__');
      if (script) {
        try {
          const data = JSON.parse(script.textContent);
          const results =
            data?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
            data?.props?.pageProps?.searchPageState?.cat1?.searchResults?.mapResults ||
            [];
          if (results.length > 0) {
            return results.slice(0, maxItems).map((r) => ({
              ...r,
              _source: '__NEXT_DATA__',
            }));
          }
        } catch { /* fall through */ }
      }

      // Strategy 2: DOM scraping
      const cards = document.querySelectorAll(
        'article[data-test="property-card"], li[class*="StyledPropertyCardDataArea"]'
      );

      return Array.from(cards).slice(0, maxItems).map((card) => {
        const link = card.querySelector('a[href*="/homedetails/"], a[data-test="property-card-link"]');
        const href = link?.href || '';
        const zpidMatch = href.match(/\/(\d+)_zpid/);

        return {
          zpid: zpidMatch ? zpidMatch[1] : null,
          detailUrl: href,
          address: (card.querySelector('address, [data-test="property-card-addr"]')?.textContent || '').trim(),
          price: (card.querySelector('[data-test="property-card-price"], span[class*="Price"]')?.textContent || '').trim(),
          beds: (card.querySelector('[class*="bed"]')?.textContent || '').trim(),
          baths: (card.querySelector('[class*="bath"]')?.textContent || '').trim(),
          sqft: (card.querySelector('[class*="sqft"]')?.textContent || '').trim(),
          imgSrc: card.querySelector('img')?.src || '',
          statusText: (card.querySelector('[class*="StatusText"], [class*="status"]')?.textContent || '').trim(),
          _source: 'DOM',
        };
      });
    }, limit);

    console.log(`  [browser] Extracted ${listings.length} listings for ${cityConfig.city}`);

    // Optionally fetch detail pages for enrichment
    if (opts.enrichDetails && listings.length > 0) {
      console.log(`  [browser] Enriching detail pages...`);
      for (let i = 0; i < Math.min(listings.length, 5); i++) {
        const detailUrl = listings[i].detailUrl;
        if (!detailUrl) continue;

        try {
          await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 20000 });
          const detail = await page.evaluate(() => {
            const desc = document.querySelector('[data-testid="bed-bath-beyond"], [class*="ds-overview"]');
            const images = Array.from(document.querySelectorAll('img[src*="zillowstatic"]')).map((i) => i.src);

            const script = document.getElementById('__NEXT_DATA__');
            let nextData = null;
            if (script) {
              try {
                const data = JSON.parse(script.textContent);
                const cache = data?.props?.pageProps?.componentProps?.gdpClientCache || {};
                nextData = cache[Object.keys(cache)[0]]?.property || null;
              } catch { /* ignore */ }
            }

            return {
              description: desc?.textContent?.trim()?.slice(0, 500) || '',
              images,
              yearBuilt: nextData?.yearBuilt || null,
              amenities: nextData?.amenities || [],
              livingArea: nextData?.livingArea || null,
              homeType: nextData?.homeType || null,
            };
          });
          listings[i]._detail = detail;
          await new Promise((r) => setTimeout(r, 1500));
        } catch (err) {
          console.log(`  [browser] Detail fetch failed for listing ${i}: ${err.message}`);
        }
      }
    }

    return listings;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeCity, findChrome };
