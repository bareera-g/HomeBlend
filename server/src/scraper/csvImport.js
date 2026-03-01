/**
 * Redfin CSV Importer
 * ────────────────────
 * Redfin allows downloading search results as CSV directly from their website.
 *
 * How to get the CSV:
 *   1. Go to redfin.com
 *   2. Search for rentals in your desired city
 *   3. Click "Download All" at the bottom of the results
 *   4. Save the CSV file
 *   5. Run: node src/scraper/index.js --import path/to/redfin_results.csv
 *
 * This module parses Redfin's CSV format into our listing schema.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a simple CSV string into an array of objects.
 * Handles quoted fields with commas inside them.
 */
function parseCSV(csvString) {
  const lines = csvString.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Common Redfin CSV column names → our fields.
 * Redfin columns vary slightly, so we check multiple variants.
 */
const COL_MAP = {
  address:      ['ADDRESS', 'STREET ADDRESS', 'PROPERTY ADDRESS'],
  city:         ['CITY'],
  state:        ['STATE', 'STATE OR PROVINCE'],
  zip:          ['ZIP', 'ZIP CODE', 'ZIP OR POSTAL CODE'],
  price:        ['PRICE', 'LIST PRICE', 'RENT PRICE'],
  beds:         ['BEDS', 'BEDROOMS'],
  baths:        ['BATHS', 'BATHROOMS', 'FULL BATHS'],
  sqft:         ['SQUARE FEET', 'SQFT', 'LIVING AREA'],
  yearBuilt:    ['YEAR BUILT'],
  propertyType: ['PROPERTY TYPE', 'HOME TYPE'],
  lat:          ['LATITUDE', 'LAT'],
  lng:          ['LONGITUDE', 'LNG', 'LONG'],
  url:          ['URL (SEE https://www.redfin.com/buy-a-home/comparative-market-analysis FOR INFO ON PRICING)', 'URL', 'REDFIN URL'],
  lotSize:      ['LOT SIZE', 'LOT AREA'],
  hoa:          ['HOA/MONTH', 'HOA'],
  status:       ['STATUS', 'LISTING STATUS', 'SALE TYPE'],
};

function getCol(row, variants) {
  for (const v of variants) {
    if (row[v] !== undefined) return row[v];
  }
  // Case-insensitive fallback
  const keys = Object.keys(row);
  for (const v of variants) {
    const found = keys.find((k) => k.toUpperCase() === v.toUpperCase());
    if (found && row[found] !== undefined) return row[found];
  }
  return '';
}

/**
 * Import a Redfin CSV file and convert to our listing schema.
 *
 * @param {string} csvPath  Absolute or relative path to the CSV file
 * @returns {Array} Listings in HomeBlend format
 */
function importRedfinCSV(csvPath) {
  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`CSV file not found: ${absPath}`);
  }

  const raw = fs.readFileSync(absPath, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`  [csv] Parsed ${rows.length} rows from ${path.basename(absPath)}`);

  const { FEATURE_KEYWORD_MAP, AMENITY_CATEGORIES } = require('./config');
  const { detectFeatures, extractAmenities, resetIdCounter } = require('./transform');

  const listings = rows
    .map((row, i) => {
      const price = parseInt(String(getCol(row, COL_MAP.price)).replace(/[^0-9]/g, ''), 10) || 0;
      const beds = parseInt(getCol(row, COL_MAP.beds), 10) || 0;
      const baths = parseFloat(getCol(row, COL_MAP.baths)) || 0;
      const sqft = parseInt(String(getCol(row, COL_MAP.sqft)).replace(/[^0-9]/g, ''), 10) || 0;
      const yearBuilt = parseInt(getCol(row, COL_MAP.yearBuilt), 10) || null;
      const city = getCol(row, COL_MAP.city) || 'Unknown';
      const state = getCol(row, COL_MAP.state) || '';
      const address = getCol(row, COL_MAP.address) || '';
      const zip = getCol(row, COL_MAP.zip) || '';
      const lat = parseFloat(getCol(row, COL_MAP.lat)) || null;
      const lng = parseFloat(getCol(row, COL_MAP.lng)) || null;
      const propertyType = getCol(row, COL_MAP.propertyType) || 'apartment';
      const listingUrl = getCol(row, COL_MAP.url) || '';

      if (price <= 0 && sqft <= 0) return null;

      // Since CSVs don't have descriptions, infer features from structured data
      const text = [address, propertyType, city].join(' ');
      const features = detectFeatures(text);

      // Infer some features from structured data
      if (yearBuilt && yearBuilt >= 2015) features.modernFinishes = 1;
      if (sqft >= 1200) features.entertainingSpace = 1;

      const title = buildTitleFromCSV(city, beds, propertyType);

      return {
        id: `lst-${String(i + 1).padStart(3, '0')}`,
        title,
        address: `${address}, ${city}, ${state} ${zip}`.trim(),
        city,
        state,
        zipCode: zip,
        price,
        beds,
        baths: Math.floor(baths),
        sqft,
        yearBuilt,
        propertyType,
        latitude: lat,
        longitude: lng,
        imageUrl: '', // not in CSV — will need placeholder
        images: [],
        floorPlanUrl: null,
        description: '',
        amenities: { building: [], unit: [], outdoor: [], location: [] },
        features,
        listingUrl,
        source: 'redfin-csv',
        scrapedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  console.log(`  [csv] Converted ${listings.length} valid listings`);
  return listings;
}

const ADJECTIVES = [
  'Charming', 'Modern', 'Spacious', 'Bright', 'Cozy', 'Sleek',
  'Stylish', 'Renovated', 'Stunning', 'Lovely', 'Beautiful', 'Elegant',
];

function buildTitleFromCSV(city, beds, type) {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const typeLabel = type || (beds <= 1 ? 'Studio' : 'Apartment');
  return `${adj} ${beds > 0 ? beds + '-Bed ' : ''}${typeLabel} in ${city}`;
}

module.exports = { importRedfinCSV, parseCSV };
