#!/usr/bin/env node
/**
 * Browser-based scraper: uses Puppeteer to fetch rent.com listings for 50 US cities.
 * Scrapes search pages via headless Chromium, then fetches detail pages for geo/price/amenities.
 *
 * Usage:  node server/src/scraper/scrape50browser.js
 * Output: /tmp/scraped_all.json
 */

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');

const CITIES = [
  { slug: 'new-york/new-york-apartments',           city: 'New York',         state: 'NY' },
  { slug: 'california/los-angeles-apartments',       city: 'Los Angeles',      state: 'CA' },
  { slug: 'illinois/chicago-apartments',             city: 'Chicago',          state: 'IL' },
  { slug: 'texas/houston-apartments',                city: 'Houston',          state: 'TX' },
  { slug: 'arizona/phoenix-apartments',              city: 'Phoenix',          state: 'AZ' },
  { slug: 'pennsylvania/philadelphia-apartments',    city: 'Philadelphia',     state: 'PA' },
  { slug: 'texas/san-antonio-apartments',            city: 'San Antonio',      state: 'TX' },
  { slug: 'california/san-diego-apartments',         city: 'San Diego',        state: 'CA' },
  { slug: 'texas/dallas-apartments',                 city: 'Dallas',           state: 'TX' },
  { slug: 'california/san-jose-apartments',          city: 'San Jose',         state: 'CA' },
  { slug: 'texas/austin-apartments',                 city: 'Austin',           state: 'TX' },
  { slug: 'florida/jacksonville-apartments',         city: 'Jacksonville',     state: 'FL' },
  { slug: 'texas/fort-worth-apartments',             city: 'Fort Worth',       state: 'TX' },
  { slug: 'ohio/columbus-apartments',                city: 'Columbus',         state: 'OH' },
  { slug: 'north-carolina/charlotte-apartments',     city: 'Charlotte',        state: 'NC' },
  { slug: 'indiana/indianapolis-apartments',         city: 'Indianapolis',     state: 'IN' },
  { slug: 'california/san-francisco-apartments',     city: 'San Francisco',    state: 'CA' },
  { slug: 'washington/seattle-apartments',           city: 'Seattle',          state: 'WA' },
  { slug: 'colorado/denver-apartments',              city: 'Denver',           state: 'CO' },
  { slug: 'tennessee/nashville-apartments',          city: 'Nashville',        state: 'TN' },
  { slug: 'oklahoma/oklahoma-city-apartments',       city: 'Oklahoma City',    state: 'OK' },
  { slug: 'oregon/portland-apartments',              city: 'Portland',         state: 'OR' },
  { slug: 'nevada/las-vegas-apartments',             city: 'Las Vegas',        state: 'NV' },
  { slug: 'tennessee/memphis-apartments',            city: 'Memphis',          state: 'TN' },
  { slug: 'kentucky/louisville-apartments',          city: 'Louisville',       state: 'KY' },
  { slug: 'maryland/baltimore-apartments',           city: 'Baltimore',        state: 'MD' },
  { slug: 'wisconsin/milwaukee-apartments',          city: 'Milwaukee',        state: 'WI' },
  { slug: 'new-mexico/albuquerque-apartments',       city: 'Albuquerque',      state: 'NM' },
  { slug: 'arizona/tucson-apartments',               city: 'Tucson',           state: 'AZ' },
  { slug: 'california/sacramento-apartments',        city: 'Sacramento',       state: 'CA' },
  { slug: 'missouri/kansas-city-apartments',         city: 'Kansas City',      state: 'MO' },
  { slug: 'georgia/atlanta-apartments',              city: 'Atlanta',          state: 'GA' },
  { slug: 'nebraska/omaha-apartments',               city: 'Omaha',            state: 'NE' },
  { slug: 'colorado/colorado-springs-apartments',    city: 'Colorado Springs', state: 'CO' },
  { slug: 'north-carolina/raleigh-apartments',       city: 'Raleigh',          state: 'NC' },
  { slug: 'virginia/virginia-beach-apartments',      city: 'Virginia Beach',   state: 'VA' },
  { slug: 'florida/miami-apartments',                city: 'Miami',            state: 'FL' },
  { slug: 'minnesota/minneapolis-apartments',        city: 'Minneapolis',      state: 'MN' },
  { slug: 'florida/tampa-apartments',                city: 'Tampa',            state: 'FL' },
  { slug: 'oklahoma/tulsa-apartments',               city: 'Tulsa',            state: 'OK' },
  { slug: 'louisiana/new-orleans-apartments',        city: 'New Orleans',      state: 'LA' },
  { slug: 'ohio/cleveland-apartments',               city: 'Cleveland',        state: 'OH' },
  { slug: 'hawaii/honolulu-apartments',              city: 'Honolulu',         state: 'HI' },
  { slug: 'pennsylvania/pittsburgh-apartments',      city: 'Pittsburgh',       state: 'PA' },
  { slug: 'massachusetts/boston-apartments',          city: 'Boston',           state: 'MA' },
  { slug: 'utah/salt-lake-city-apartments',          city: 'Salt Lake City',   state: 'UT' },
  { slug: 'michigan/detroit-apartments',             city: 'Detroit',          state: 'MI' },
  { slug: 'district-of-columbia/washington-apartments', city: 'Washington',    state: 'DC' },
  { slug: 'california/oakland-apartments',           city: 'Oakland',          state: 'CA' },
  { slug: 'north-carolina/durham-apartments',        city: 'Durham',           state: 'NC' },
];

const LIMIT = 10;
const BASE = 'https://www.rent.com';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ── Transform a rent.com listing to HomeBlend schema ──── */
function transform(summary, detail, id, cityMeta) {
  const name = detail?.name || summary.name || 'Rental Listing';
  const city = detail?.city || summary.city || cityMeta.city;
  const state = detail?.state || summary.state || cityMeta.state;
  let priceNum = 0;
  if (detail?.lowPrice) {
    priceNum = Math.round(detail.highPrice ? (detail.lowPrice + detail.highPrice) / 2 : detail.lowPrice);
  }
  const price = priceNum > 0 ? `$${priceNum.toLocaleString()} / mo` : 'Call for price';
  let beds = 1, baths = 1, sqft = 0;
  if (detail?.floorplans?.length > 0) {
    const plan = detail.floorplans[Math.floor(detail.floorplans.length / 2)];
    beds = plan.beds || 1; baths = plan.baths || 1; sqft = plan.sqft || 0;
  }
  const lowerName = name.toLowerCase();
  let category = 'Apartment';
  if (lowerName.includes('townhome') || lowerName.includes('townhouse')) category = 'Townhome';
  else if (lowerName.includes('condo')) category = 'Condo';
  else if (lowerName.includes('loft')) category = 'Loft';
  const amenText = (detail?.amenities || []).join(' ').toLowerCase();
  const tags = [];
  if (amenText.includes('pool') || amenText.includes('swimming')) tags.push('Pool');
  if (amenText.includes('gym') || amenText.includes('fitness')) tags.push('Fitness Center');
  if (amenText.includes('balcony') || amenText.includes('patio')) tags.push('Balcony/Patio');
  if (amenText.includes('pet')) tags.push('Pet Friendly');
  if (amenText.includes('air conditioning') || amenText.includes('a/c')) tags.push('A/C');
  if (amenText.includes('dishwasher')) tags.push('Dishwasher');
  if (amenText.includes('ev charging')) tags.push('EV Charging');
  if (amenText.includes('clubhouse') || amenText.includes('lounge')) tags.push('Clubhouse');
  if (amenText.includes('rooftop')) tags.push('Rooftop');
  if (amenText.includes('dog park')) tags.push('Dog Park');
  if (amenText.includes('grill') || amenText.includes('bbq')) tags.push('BBQ Area');
  if (amenText.includes('garage')) tags.push('Garage');
  if (amenText.includes('gated')) tags.push('Gated Community');
  const finalTags = tags.slice(0, 5);
  if (finalTags.length === 0) finalTags.push(category);
  let parking = null;
  if (detail?.hasParking) parking = amenText.includes('garage') ? 'Garage' : 'Parking available';
  let laundry = null;
  if (detail?.hasInUnitLaundry) laundry = 'In-unit';
  else if (amenText.includes('laundry')) laundry = 'On-site laundry';
  const images = (detail?.images?.length > 0 ? detail.images : summary.images || []).slice(0, 8);
  const desc = detail?.description || '';
  const aiOverview = desc.length > 30 ? desc.replaceAll(/\s+/g, ' ').slice(0, 500)
    : `${name} offers ${beds > 0 ? beds + '-bedroom' : 'studio'} rental living in ${city}, ${state}. ${finalTags.length > 0 ? `Features include ${finalTags.join(', ').toLowerCase()}.` : ''}`;
  return {
    id, title: name, location: `${city}, ${state}`,
    price, priceNum: priceNum || 0, category,
    beds, baths, sqft, yearBuilt: null,
    tags: finalTags, petFriendly: detail?.petFriendly ?? false,
    parking, laundry,
    lng: detail?.lng || null, lat: detail?.lat || null,
    images, aiOverview,
    listingUrl: summary.detailUrl || '',
  };
}

/* ── Main ──────────────────────────────────────────────── */
async function main() {
  console.log(`Launching browser...`);
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  // Block images/css/fonts for speed
  await page.setRequestInterception(true);
  page.on('request', req => {
    const rt = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(rt)) req.abort();
    else req.continue();
  });

  const all = [];
  let nextId = 71; // existing properties are 1-70
  let successCities = 0;

  for (let ci = 0; ci < CITIES.length; ci++) {
    const c = CITIES[ci];
    const url = `${BASE}/${c.slug}`;
    console.log(`\n[${ci + 1}/${CITIES.length}] ${c.city}, ${c.state} — ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000); // let JSON-LD scripts settle

      // Extract search page JSON-LD summaries
      const summaries = await page.evaluate((limit) => {
        const els = document.querySelectorAll('script[type="application/ld+json"]');
        const results = [];
        for (const el of els) {
          try {
            const data = JSON.parse(el.textContent);
            if (data['@type'] === 'ApartmentComplex') {
              const addr = data.address || {};
              const images = (data.image || []).map(img => typeof img === 'string' ? img : img?.contentUrl).filter(Boolean);
              results.push({
                name: data.name || '',
                detailUrl: data.url || '',
                city: addr.addressLocality || '',
                state: addr.addressRegion || '',
                images,
              });
            }
          } catch { /* skip */ }
        }
        return results.slice(0, limit);
      }, LIMIT);

      if (summaries.length === 0) { console.log('  ○ No results'); continue; }
      console.log(`  Found ${summaries.length} listings, enriching details...`);
      successCities++;

      for (const summary of summaries) {
        if (!summary.detailUrl) continue;
        try {
          await page.goto(summary.detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(1500);

          const detail = await page.evaluate(() => {
            const els = document.querySelectorAll('script[type="application/ld+json"]');
            let mainEntity = null, aboutProduct = null;
            for (const el of els) {
              try {
                const data = JSON.parse(el.textContent);
                if (data['@type'] === 'ItemPage') { mainEntity = data.mainEntity; aboutProduct = data.about; }
                else if (data['@type'] === 'ApartmentComplex') mainEntity = data;
              } catch { /* skip */ }
            }
            if (!mainEntity) return null;
            const addr = mainEntity.address || {};
            const geo = mainEntity.geo || {};
            const offers = aboutProduct?.offers || mainEntity.offers || {};
            const amenities = (mainEntity.amenityFeature || []).filter(a => a.value === true).map(a => a.name).filter(Boolean);
            const floorplans = (mainEntity.containsPlace || []).map(p => {
              const rooms = p.numberOfRooms || [];
              let beds = 0, baths = 0;
              for (const r of rooms) {
                if (r.unitText === 'Bedrooms') beds = r.value || 0;
                if (r.unitText === 'Bathrooms') baths = r.value || 0;
              }
              return { beds, baths, sqft: p.floorSize?.value || 0 };
            });
            const images = (mainEntity.image || []).map(img => typeof img === 'string' ? img : img?.contentUrl).filter(Boolean);
            return {
              name: mainEntity.name || '',
              city: addr.addressLocality || '',
              state: addr.addressRegion || '',
              lat: geo.latitude || null,
              lng: geo.longitude || null,
              description: (mainEntity.description || aboutProduct?.description || '').slice(0, 500),
              lowPrice: offers.lowPrice || null,
              highPrice: offers.highPrice || null,
              images: images.slice(0, 8),
              amenities,
              floorplans,
              petFriendly: amenities.some(a => /pet/i.test(a)),
              hasParking: amenities.some(a => /parking|garage/i.test(a)),
              hasInUnitLaundry: amenities.some(a => /washer|dryer|laundry|in[- ]unit/i.test(a)),
            };
          });

          if (detail?.lat && detail?.lng && (detail?.images?.length > 0 || summary.images.length > 0)) {
            const prop = transform(summary, detail, nextId, c);
            if (prop.images.length > 0) {
              all.push(prop);
              nextId++;
              process.stdout.write(`    ✓ ${prop.title.slice(0,40)}\n`);
            }
          }
        } catch (err) {
          console.warn(`  Skipped listing: ${err.message}`);
        }
        await sleep(400 + Math.random() * 600);
      }
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`);
    }

    // Small delay between cities
    if (ci < CITIES.length - 1) await sleep(800 + Math.random() * 1200);
  }

  await browser.close();
  console.log(`\n✓ Scraped ${all.length} listings from ${successCities} cities`);
  fs.writeFileSync('/tmp/scraped_all.json', JSON.stringify(all, null, 2));
  console.log('Wrote to /tmp/scraped_all.json');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
