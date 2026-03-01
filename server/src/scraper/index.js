#!/usr/bin/env node
/**
 * HomeBlend Real Estate Scraper & Data Pipeline
 * ───────────────────────────────────────────────
 * Multi-mode tool for populating the listings dataset.
 *
 * MODES:
 *
 *   Generate (instant, no internet needed):
 *     npm run scrape -- --generate
 *     npm run scrape -- --generate --cities "Austin,Miami" --limit 15
 *     npm run scrape -- --generate --seed 42
 *
 *   Import Redfin CSV:
 *     npm run scrape -- --import path/to/redfin_download.csv
 *
 *   Live scrape (requires Chrome installed):
 *     npm run scrape -- --source browser --cities "Austin"
 *     npm run scrape -- --source zillow
 *     npm run scrape -- --source redfin
 *     npm run scrape -- --source both
 *
 *   Apartments.com scrape (Irvine / Orange County):
 *     npm run scrape -- --source apartments
 *     npm run scrape -- --source apartments --limit 15 --enrich
 *
 *   Common options:
 *     --cities "Austin,Miami"   Specific cities (comma-separated)
 *     --limit 15                Listings per city (default: 10)
 *     --enrich                  Fetch detail pages during scrape for richer data
 *     --seed 42                 Reproducible random seed (generate mode)
 *     --output ./path.json      Output file (default: src/data/listings.json)
 *     --keep-old                Merge with existing listings.json
 *     --dry-run                 Preview results without writing
 *     --help                    Show help
 */

const fs = require('node:fs');
const path = require('node:path');
const { CITIES, REQUEST_DEFAULTS } = require('./config');

/* ── CLI arg parsing ──────────────────────────────────────── */

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: null,          // 'generate' | 'import' | 'scrape'
    importFile: null,
    cities: null,
    limit: 10,
    enrich: false,
    source: 'both',      // scrape mode: "zillow" | "redfin" | "browser" | "both" | "apartments"
    output: path.resolve(__dirname, '../data/listings.json'),
    frontend: false,     // also write to src/data/properties.js
    dryRun: false,
    keepOld: false,
    seed: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--generate':
        opts.mode = 'generate';
        break;
      case '--import':
        opts.mode = 'import';
        i += 1;
        opts.importFile = args[i];
        break;
      case '--cities':
        i += 1;
        opts.cities = args[i].split(',').map((s) => s.trim());
        break;
      case '--limit':
        i += 1;
        opts.limit = Number.parseInt(args[i], 10);
        break;
      case '--enrich':
        opts.enrich = true;
        break;
      case '--source':
        i += 1;
        opts.source = args[i];
        if (!opts.mode) opts.mode = 'scrape';
        break;
      case '--output':
        i += 1;
        opts.output = path.resolve(args[i]);
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--keep-old':
        opts.keepOld = true;
        break;
      case '--seed':
        i += 1;
        opts.seed = Number.parseInt(args[i], 10);
        break;
      case '--frontend':
        opts.frontend = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  // Default mode
  if (!opts.mode) opts.mode = 'generate';

  return opts;
}

function printHelp() {
  console.log(`
HomeBlend Real Estate Data Pipeline
────────────────────────────────────

MODES:

  --generate              Generate realistic market data (instant, default)
  --import <file.csv>     Import a Redfin CSV download
  --source <src>          Live scrape: browser | zillow | redfin | both | apartments

OPTIONS:

  --cities "Austin,Miami" Only target specific cities (comma-separated)
  --limit 15              Listings per city (default: 10)
  --enrich                Fetch detail pages during scrape for richer data
  --seed 42               Reproducible random seed (generate mode)
  --output ./path.json    Output file path
  --keep-old              Merge with existing listings.json
  --dry-run               Preview results without writing
  --help                  Show this help

EXAMPLES:

  # Generate 10 listings per city for all 16 cities (160 total)
  npm run scrape

  # Generate 20 per city for just 3 cities
  npm run scrape -- --generate --cities "Austin,Miami,Chicago" --limit 20

  # Import from a Redfin CSV download
  npm run scrape -- --import ~/Downloads/redfin_2026-02-28.csv

  # Live scrape with Chrome (must be installed)
  npm run scrape -- --source browser --cities "Austin" --limit 5

  # Scrape Apartments.com for Irvine / Orange County
  npm run scrape:apartments

AVAILABLE CITIES:
  ${CITIES.map((c) => c.city).join(', ')}
  `.trim());
}

/* ── Helpers ──────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Generate mode ────────────────────────────────────────── */

async function runGenerate(opts) {
  const { generate } = require('./generate');

  console.log('\nMode: GENERATE (realistic market data)');
  console.log(`Cities: ${opts.cities ? opts.cities.join(', ') : 'all 16 cities'}`);
  console.log(`Limit:  ${opts.limit} per city`);
  if (opts.seed) console.log(`Seed:   ${opts.seed}`);

  const listings = generate({
    cities: opts.cities,
    limit: opts.limit,
    seed: opts.seed,
  });

  console.log(`\nGenerated ${listings.length} listings across ${
    new Set(listings.map((l) => l.city)).size
  } cities\n`);

  return listings;
}

/* ── Import mode ──────────────────────────────────────────── */

async function runImport(opts) {
  const { importRedfinCSV } = require('./csvImport');

  console.log('\nMode: IMPORT (Redfin CSV)');
  console.log(`File: ${opts.importFile}`);

  const listings = importRedfinCSV(opts.importFile);
  console.log(`\nImported ${listings.length} listings\n`);

  return listings;
}

/* ── Source-specific scrapers ──────────────────────────────── */

async function scrapeBrowser(cityConfig, opts, cityListings, stats) {
  try {
    const browser = require('./browser');
    const raw = await browser.scrapeCity(cityConfig, {
      limit: opts.limit,
      enrichDetails: opts.enrich,
    });
    if (raw.length === 0) {
      console.log(`  ○ Browser: no results`);
      return;
    }
    const { transformBatch } = require('./transform');
    const transformed = transformBatch(raw, cityConfig, 'zillow');
    cityListings.push(...transformed);
    stats.browser += transformed.length;
    console.log(`  ✓ Browser: ${transformed.length} listings`);
  } catch (err) {
    console.log(`  ✗ Browser error: ${err.message}`);
    stats.failed++;
  }
}

async function scrapeZillow(cityConfig, opts, cityListings, stats) {
  try {
    const zillow = require('./zillow');
    const raw = await zillow.scrapeCity(cityConfig, {
      limit: opts.limit,
      enrichDetails: opts.enrich,
    });
    if (raw.length === 0) {
      console.log(`  ○ Zillow: no results`);
      return;
    }
    const { transformBatch } = require('./transform');
    const transformed = transformBatch(raw, cityConfig, 'zillow');
    cityListings.push(...transformed);
    stats.zillow += transformed.length;
    console.log(`  ✓ Zillow: ${transformed.length} listings`);
  } catch (err) {
    console.log(`  ✗ Zillow error: ${err.message}`);
    stats.failed++;
  }
}

async function scrapeRedfin(cityConfig, opts, cityListings, stats) {
  try {
    const redfin = require('./redfin');
    const remaining = opts.limit - cityListings.length;
    const raw = await redfin.scrapeCity(cityConfig, {
      limit: Math.max(remaining, opts.limit),
      enrichDetails: opts.enrich,
    });
    if (raw.length === 0) {
      console.log(`  ○ Redfin: no results`);
      return;
    }
    const { transformBatch } = require('./transform');
    const transformed = transformBatch(raw, cityConfig, 'redfin');
    const take = opts.source === 'redfin' ? transformed : transformed.slice(0, remaining);
    cityListings.push(...take);
    stats.redfin += take.length;
    console.log(`  ✓ Redfin: ${take.length} listings`);
  } catch (err) {
    console.log(`  ✗ Redfin error: ${err.message}`);
    stats.failed++;
  }
}

/* ── Scrape mode ──────────────────────────────────────────── */

async function runScrape(opts) {
  console.log('\nMode: SCRAPE (live from web)');
  console.log(`Source: ${opts.source}`);
  console.log(`Enrich: ${opts.enrich}`);

  let targetCities = CITIES;
  if (opts.cities) {
    const cityNames = new Set(opts.cities.map((c) => c.toLowerCase()));
    targetCities = CITIES.filter((c) => cityNames.has(c.city.toLowerCase()));
    if (targetCities.length === 0) {
      console.error(`No matching cities. Available: ${CITIES.map((c) => c.city).join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`Cities: ${targetCities.map((c) => c.city).join(', ')}`);
  console.log(`Limit:  ${opts.limit} per city\n`);

  const allListings = [];
  const stats = { browser: 0, zillow: 0, redfin: 0, failed: 0 };

  for (const cityConfig of targetCities) {
    const divider = '─'.repeat(Math.max(0, 40 - cityConfig.city.length));
    console.log(`\n── ${cityConfig.city}, ${cityConfig.state} ${divider}`);
    const cityListings = [];

    if (opts.source === 'browser') {
      await scrapeBrowser(cityConfig, opts, cityListings, stats);
    }
    if (opts.source === 'zillow' || opts.source === 'both') {
      await scrapeZillow(cityConfig, opts, cityListings, stats);
    }
    const needRedfin = opts.source === 'redfin' || (opts.source === 'both' && cityListings.length < opts.limit);
    if (needRedfin) {
      await scrapeRedfin(cityConfig, opts, cityListings, stats);
    }

    allListings.push(...cityListings);
    if (targetCities.indexOf(cityConfig) < targetCities.length - 1) {
      await sleep(REQUEST_DEFAULTS.delayBetweenCities);
    }
  }

  console.log(`\nScraped ${allListings.length} total listings`);
  if (stats.failed > 0) {
    console.log(`  (${stats.failed} city-source combos failed — sites may be blocking)`);
    console.log(`  Tip: Use --generate for instant data or --source browser with Chrome installed.`);
  }

  return allListings;
}

/* ── Apartments.com mode ──────────────────────────────────── */

async function runApartments(opts) {
  const { scrapeIrvineOC, IRVINE_AREAS } = require('./rentcom');

  console.log('\nMode: SCRAPE (Rent.com – Irvine / Orange County)');

  let areas = IRVINE_AREAS;
  if (opts.cities) {
    const cityNames = new Set(opts.cities.map((c) => c.toLowerCase()));
    areas = IRVINE_AREAS.filter((a) => cityNames.has(a.label.toLowerCase()));
    if (areas.length === 0) {
      console.log(`No matching areas. Available: ${IRVINE_AREAS.map((a) => a.label).join(', ')}`);
      console.log('Falling back to all Irvine/OC areas.');
      areas = IRVINE_AREAS;
    }
  }

  console.log(`Areas:  ${areas.map((a) => a.label).join(', ')}`);
  console.log(`Limit:  ${opts.limit} per area`);
  console.log(`Enrich: ${opts.enrich}`);

  const listings = await scrapeIrvineOC({
    areas,
    limit: opts.limit,
    enrich: opts.enrich,
  });

  return listings;
}

/* ── Frontend properties.js writer ─────────────────────────── */

function writeFrontendProperties(listings) {
  const frontendPath = path.resolve(__dirname, '../../../src/data/properties.js');

  let output = 'export const PROPERTIES = [\n';
  for (const l of listings) {
    const escape = (s) => (s || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
    const imgs = (l.images || []).map((u) => '      "' + u + '"').join(',\n');
    const tags = (l.tags || []).map((t) => '"' + escape(t) + '"').join(', ');
    const parkingVal = l.parking ? '"' + escape(l.parking) + '"' : 'null';
    const laundryVal = l.laundry ? '"' + escape(l.laundry) + '"' : 'null';
    output += '  {\n';
    output += '    id: ' + l.id + ', title: "' + escape(l.title) + '", location: "' + escape(l.location) + '",\n';
    output += '    price: "' + escape(l.price) + '", priceNum: ' + (l.priceNum || 0) + ', category: "' + escape(l.category) + '",\n';
    output += '    beds: ' + (l.beds || 1) + ', baths: ' + (l.baths || 1) + ', sqft: ' + (l.sqft || 0) + ', yearBuilt: ' + (l.yearBuilt || 'null') + ',\n';
    output += '    tags: [' + tags + '],\n';
    output += '    petFriendly: ' + (!!l.petFriendly) + ', parking: ' + parkingVal + ', laundry: ' + laundryVal + ',\n';
    output += '    lng: ' + (l.lng || -117.78) + ', lat: ' + (l.lat || 33.68) + ',\n';
    output += '    images: [\n' + imgs + ',\n    ],\n';
    output += '    aiOverview: "' + escape(l.aiOverview) + '",\n';
    if (l.listingUrl) output += '    listingUrl: "' + escape(l.listingUrl) + '",\n';
    output += '  },\n';
  }
  output += '];\n';

  const dir = path.dirname(frontendPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(frontendPath, output);
  console.log(`✓ Written ${listings.length} listings to ${frontendPath}\n`);
}

/* ── Main ─────────────────────────────────────────────────── */

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    HomeBlend Real Estate Data Pipeline 🏠    ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Load existing data if merging
  let existingListings = [];
  if (opts.keepOld && fs.existsSync(opts.output)) {
    try {
      existingListings = JSON.parse(fs.readFileSync(opts.output, 'utf-8'));
      console.log(`\nLoaded ${existingListings.length} existing listings to merge.`);
    } catch { /* start fresh */ }
  }

function printSummary(opts, newListings, existingListings, allListings) {
  console.log('══════════════════════════════════════════════');
  console.log(`  Mode:            ${opts.mode}`);
  console.log(`  New listings:    ${newListings.length}`);
  if (existingListings.length > 0) {
    console.log(`  Existing kept:   ${existingListings.length}`);
  }
  console.log(`  Grand total:     ${allListings.length}`);

  const byCity = {};
  for (const l of allListings) {
    const cityLabel = l.city || l.location || 'Unknown';
    byCity[cityLabel] = (byCity[cityLabel] || 0) + 1;
  }
  console.log(`  Cities:          ${Object.keys(byCity).length}`);
  for (const [city, count] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${city}: ${count}`);
  }
  console.log('══════════════════════════════════════════════');

  if (newListings.length > 0) {
    console.log('\nSample listing:');
    console.log(JSON.stringify(newListings[0], null, 2).slice(0, 1000));
    console.log('...\n');
  }
}

function writeOutput(opts, allListings, newListings) {
  const dir = path.dirname(opts.output);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(opts.output, JSON.stringify(allListings, null, 2));
  console.log(`✓ Written ${allListings.length} listings to ${opts.output}\n`);

  const statsPath = path.resolve(path.dirname(opts.output), 'scrape-stats.json');
  fs.writeFileSync(statsPath, JSON.stringify({
    scrapedAt: new Date().toISOString(),
    mode: opts.mode,
    newListings: newListings.length,
    grandTotal: allListings.length,
    citiesScraped: [...new Set(newListings.map((l) => l.city || l.location))],
    schema: Object.keys(newListings[0] || {}),
  }, null, 2));

  if (opts.frontend) {
    writeFrontendProperties(allListings);
  }
}

async function runMode(opts) {
  switch (opts.mode) {
    case 'generate': return runGenerate(opts);
    case 'import':   return runImport(opts);
    case 'scrape':
      return opts.source === 'apartments' ? runApartments(opts) : runScrape(opts);
    default:
      console.error(`Unknown mode: ${opts.mode}`);
      process.exit(1);
  }
}

/* ── Main ─────────────────────────────────────────────────── */

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    HomeBlend Real Estate Data Pipeline 🏠    ║');
  console.log('╚══════════════════════════════════════════════╝');

  let existingListings = [];
  if (opts.keepOld && fs.existsSync(opts.output)) {
    try {
      existingListings = JSON.parse(fs.readFileSync(opts.output, 'utf-8'));
      console.log(`\nLoaded ${existingListings.length} existing listings to merge.`);
    } catch { /* start fresh */ }
  }

  const newListings = await runMode(opts);
  const allListings = [...existingListings, ...newListings];

  printSummary(opts, newListings, existingListings, allListings);

  if (opts.dryRun) {
    console.log('(dry run — nothing written)\n');
  } else {
    writeOutput(opts, allListings, newListings);
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
