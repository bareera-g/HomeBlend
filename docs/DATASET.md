# HomeBlend — Dataset Reference

Complete documentation for all property datasets, their schemas, sources, and the scraping pipeline that populates them.

---

## Table of Contents

1. [Dataset Overview](#dataset-overview)
2. [Web Frontend Properties](#web-frontend-properties)
3. [Server Listings](#server-listings)
4. [Scraped Listings](#scraped-listings)
5. [Scrape Stats](#scrape-stats)
6. [Feature Flags](#feature-flags)
7. [Amenity Categories](#amenity-categories)
8. [Data Pipeline](#data-pipeline)
9. [Geographic Coverage](#geographic-coverage)

---

## Dataset Overview

| Dataset | File | Records | Format | Used By |
|---|---|---|---|---|
| Web Properties | `src/data/properties.js` | ~603 | JS export (`PROPERTIES`) | React web app |
| Server Listings | `server/src/data/listings.json` | 160 | JSON array | Express API (mobile) |
| Scraped Listings | `server/src/data/scraped-listings.json` | ~70 | JSON array | Pipeline output mirror |
| Server Properties | `server/src/data/properties.json` | ~603 | JSON array | Optional server copy |
| Scrape Stats | `server/src/data/scrape-stats.json` | 1 | JSON object | Pipeline metadata |

---

## Web Frontend Properties

**File:** `src/data/properties.js`  
**Export:** `export const PROPERTIES = [...]`  
**Count:** ~603 properties  
**Primary source:** Rent.com + Apartments.com scraping, supplemented by generated data across 50+ US cities

### Schema

| Field | Type | Nullable | Example | Description |
|---|---|---|---|---|
| `id` | `number` | No | `1` | Sequential integer ID |
| `title` | `string` | No | `"Las Palmas Apartment Homes"` | Property name |
| `location` | `string` | No | `"Irvine, CA"` | City, State |
| `price` | `string` | No | `"$3,703 / mo"` | Display-formatted price string |
| `priceNum` | `number` | No | `3703` | Numeric monthly price (used for filtering/sorting) |
| `category` | `string` | No | `"Apartment"` | Property type |
| `beds` | `number` | No | `1` | Bedroom count |
| `baths` | `number` | No | `1` | Bathroom count |
| `sqft` | `number` | No | `734` | Square footage |
| `yearBuilt` | `number` | Yes | `null` | Year of construction |
| `tags` | `string[]` | No | `["Fitness Center", "Balcony/Patio"]` | Amenity tags |
| `petFriendly` | `boolean` | Yes | `true` | Pet policy flag |
| `parking` | `string` | Yes | `null` | Parking info (often null for rentals) |
| `laundry` | `string` | Yes | `null` | Laundry info |
| `lng` | `number` | No | `-117.78726` | Longitude (decimal degrees) |
| `lat` | `number` | No | `33.724344` | Latitude (decimal degrees) |
| `images` | `string[]` | No | `["https://i.rent.com/..."]` | Array of image URLs (typically 5-8) |
| `aiOverview` | `string` | No | `"Self-Guided Tours..."` | Property description / AI-generated summary |
| `listingUrl` | `string` | No | `"https://www.rent.com/..."` | Link to original listing |

### Category Distribution

| Category | Count | Percentage |
|---|---|---|
| Apartment | 588 | 97.5% |
| Condo | 9 | 1.5% |
| Townhome | 3 | 0.5% |
| Loft | 2 | 0.3% |
| Single Family | 1 | 0.2% |

### Sample Record

```json
{
  "id": 1,
  "title": "Las Palmas Apartment Homes",
  "location": "Irvine, CA",
  "price": "$3,703 / mo",
  "priceNum": 3703,
  "category": "Apartment",
  "beds": 1,
  "baths": 1,
  "sqft": 734,
  "yearBuilt": null,
  "tags": ["Fitness Center", "Balcony/Patio", "Pet Friendly", "A/C"],
  "petFriendly": true,
  "parking": null,
  "laundry": null,
  "lng": -117.78726,
  "lat": 33.724344,
  "images": [
    "https://i.rent.com/t_3x2_fixed_webp_xl/4d2056b77ecd6c7c6be079cc2daba137",
    "https://i.rent.com/t_3x2_fixed_webp_xl/bb4d995410f8b8b0db2a5a4adafae06d"
  ],
  "aiOverview": "Self-Guided Tours Only. Appointment Required...",
  "listingUrl": "https://www.rent.com/apartment/las-palmas-apartment-homes-irvine-ca-lc5916266"
}
```

---

## Server Listings

**File:** `server/src/data/listings.json`  
**Count:** 160 listings  
**Source:** Generated via `npm run scrape -- --generate` across 16 US cities

### Schema

| Field | Type | Nullable | Example | Description |
|---|---|---|---|---|
| `id` | `string` | No | `"lst-001"` | Prefixed listing ID (`lst-NNN`) |
| `title` | `string` | No | `"Charming Studio in Santa Monica"` | Descriptive listing title |
| `address` | `string` | No | `"394 Oak Ave, Los Angeles, CA 90048"` | Full street address |
| `city` | `string` | No | `"Los Angeles"` | City name |
| `state` | `string` | No | `"CA"` | Two-letter state code |
| `zipCode` | `string` | No | `"90048"` | ZIP code |
| `price` | `number` | No | `2250` | Monthly rent (numeric, no formatting) |
| `beds` | `number` | No | `0` | Bedrooms (0 = studio) |
| `baths` | `number` | No | `1` | Bathrooms |
| `sqft` | `number` | No | `758` | Square footage |
| `yearBuilt` | `number` | No | `1951` | Year built |
| `propertyType` | `string` | No | `"house"` | Lowercase property type |
| `latitude` | `number` | No | `33.959257` | Latitude |
| `longitude` | `number` | No | `-118.18772` | Longitude |
| `imageUrl` | `string` | No | `"https://images.unsplash.com/..."` | Primary hero image (Unsplash) |
| `images` | `string[]` | No | `[...]` | Array of 5 Unsplash image URLs |
| `floorPlanUrl` | `string` | Yes | `null` | Floor plan image URL |
| `description` | `string` | No | `"Recently renovated..."` | Listing description |
| `amenities` | `object` | No | `{ building: [], unit: [], outdoor: [], location: [] }` | Categorized amenities (see below) |
| `features` | `object` | No | `{ naturalLight: 1, parking: 0, ... }` | Binary feature flags (see below) |
| `listingUrl` | `string` | No | `""` | Original listing URL (empty for generated) |
| `source` | `string` | No | `"generated"` | Data origin |
| `scrapedAt` | `string` | No | `"2026-03-01T00:12:59.209Z"` | ISO timestamp |

### Property Type Distribution

| Type | Count | Percentage |
|---|---|---|
| apartment | 38 | 23.8% |
| condo | 37 | 23.1% |
| house | 36 | 22.5% |
| townhouse | 20 | 12.5% |
| brownstone | 8 | 5.0% |
| loft | 6 | 3.8% |
| studio | 5 | 3.1% |
| rowhouse | 4 | 2.5% |
| victorian | 2 | 1.3% |
| penthouse | 2 | 1.3% |
| cottage | 2 | 1.3% |

### Sample Record

```json
{
  "id": "lst-001",
  "title": "Charming Studio in Santa Monica",
  "address": "394 Oak Ave, Los Angeles, CA 90048",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90048",
  "price": 2250,
  "beds": 0,
  "baths": 1,
  "sqft": 758,
  "yearBuilt": 1951,
  "propertyType": "house",
  "latitude": 33.959257,
  "longitude": -118.18772,
  "imageUrl": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
  "images": [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800",
    "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800"
  ],
  "floorPlanUrl": null,
  "description": "Recently renovated apartment featuring quartz countertops, stainless steel appliances, and in-unit washer/dryer.",
  "amenities": {
    "building": ["doorman", "courtyard", "lounge"],
    "unit": ["garbage disposal", "ceiling fan", "stainless steel appliances", "quartz countertops", "in-unit washer/dryer", "high ceilings"],
    "outdoor": ["pet-friendly"],
    "location": ["near transit"]
  },
  "features": {
    "naturalLight": 1,
    "parking": 0,
    "openKitchen": 1,
    "balcony": 0,
    "inUnitLaundry": 1,
    "hardwoodFloors": 0,
    "modernFinishes": 1,
    "quietNeighborhood": 1,
    "entertainingSpace": 1,
    "highCeilings": 1
  },
  "listingUrl": "",
  "source": "generated",
  "scrapedAt": "2026-03-01T00:12:59.209Z"
}
```

---

## Scraped Listings

**File:** `server/src/data/scraped-listings.json`  
**Format:** Same schema as Web Frontend Properties  
**Purpose:** Output of the scraper in the web-frontend-compatible format. Mirrors `src/data/properties.js` but as JSON.

---

## Scrape Stats

**File:** `server/src/data/scrape-stats.json`  
**Purpose:** Metadata from the most recent scraper run.

| Field | Type | Description |
|---|---|---|
| `scrapedAt` | `string` | ISO timestamp of the run |
| `mode` | `string` | `"scrape"`, `"generate"`, or `"import"` |
| `newListings` | `number` | Listings produced in this run |
| `grandTotal` | `number` | Total listing count after run |
| `citiesScraped` | `string[]` | Cities targeted |
| `schema` | `string[]` | Field names of the output schema |

---

## Feature Flags

The blend engine uses 10 binary feature flags (0 or 1) to build taste vectors for compatibility scoring.

| Key | Detects | Example Keywords |
|---|---|---|
| `naturalLight` | Natural lighting | "sun-drenched", "skylight", "floor-to-ceiling windows" |
| `parking` | Parking availability | "garage", "carport", "assigned parking", "ev charging" |
| `openKitchen` | Modern/open kitchen | "chef's kitchen", "kitchen island", "open-concept" |
| `balcony` | Outdoor private space | "balcony", "patio", "terrace", "deck", "rooftop" |
| `inUnitLaundry` | In-unit washer/dryer | "washer/dryer", "w/d in unit", "laundry in unit" |
| `hardwoodFloors` | Hardwood flooring | "hardwood", "oak floor", "bamboo floor", "wide plank" |
| `modernFinishes` | Modern renovations | "renovated", "contemporary", "luxury finish", "smart home" |
| `quietNeighborhood` | Quiet area | "peaceful", "tranquil", "cul-de-sac", "tree-lined" |
| `entertainingSpace` | Social/hosting space | "great room", "formal dining", "media room", "wet bar" |
| `highCeilings` | Tall/vaulted ceilings | "vaulted ceiling", "cathedral ceiling", "exposed beam" |

**How features are used:**  
Each user's vote history builds a 10-dimensional taste vector. The blend engine computes pairwise cosine similarity between members to score group compatibility and surface properties that match the group's collective preferences.

---

## Amenity Categories

Properties can have categorized amenity lists (server listings only).

### Building Amenities
pool, gym, fitness center, doorman, concierge, elevator, roof deck, lounge, courtyard, bike storage, package room, co-working, business center, sauna, hot tub, spa, game room, theater

### Unit Amenities
dishwasher, microwave, air conditioning, central air, fireplace, walk-in closet, storage, ceiling fan, garbage disposal, smart thermostat, crown molding, exposed brick, soaking tub, rain shower

### Outdoor Amenities
yard, garden, patio, pool, bbq, grill, fire pit, playground, dog park, pet-friendly, fenced yard, outdoor kitchen

### Location Amenities
near transit, walkable, near park, waterfront, downtown, near school, near shopping, near dining, bike-friendly, near highway

---

## Data Pipeline

### Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Scraper CLI                                 │
│           npm run scrape -- [mode] [options]                       │
├──────────┬─────────────┬───────────────┬──────────────────────────┤
│ Generate │  CSV Import  │  Live Scrape  │  Apartments.com Scrape   │
│ --generate│ --import f  │  --source X   │  --source apartments     │
└────┬─────┴──────┬──────┴───────┬───────┴────────────┬─────────────┘
     │            │              │                     │
     ▼            ▼              ▼                     ▼
┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────────────┐
│generator│ │csvImport │ │zillow.js     │ │scrapeApartments.js    │
│  .js    │ │  .js     │ │redfin.js     │ │  (Cheerio + Axios)    │
│         │ │          │ │browser.js    │ │                       │
│ (Faker) │ │ (CSV→obj)│ │ (Puppeteer)  │ │                       │
└────┬────┘ └─────┬────┘ └──────┬───────┘ └───────────┬───────────┘
     │            │              │                     │
     └────────────┴──────────────┴─────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  transform.js   │
                     │  (normalize →   │
                     │   detect feats  │
                     │   → uniform     │
                     │     schema)     │
                     └────────┬────────┘
                              │
                 ┌────────────┼─────────────────────┐
                 ▼            ▼                      ▼
         ┌────────────┐ ┌───────────────┐ ┌───────────────────┐
         │listings.json│ │properties.json│ │scraped-listings   │
         │ (server)    │ │  (server)     │ │  .json            │
         └─────────────┘ └───────────────┘ └───────────────────┘
                                                     │
                                                     ▼
                                           ┌──────────────────┐
                                           │src/data/          │
                                           │ properties.js     │
                                           │ (web frontend)    │
                                           └──────────────────┘
```

### Modes

#### 1. Generate (Default)

Creates synthetic listings with realistic data. No internet needed.

```bash
npm run scrape -- --generate
npm run scrape -- --generate --cities "Austin,Miami" --limit 15
npm run scrape -- --generate --seed 42    # reproducible output
```

#### 2. CSV Import

Imports Redfin CSV downloads.

```bash
npm run scrape -- --import path/to/redfin_download.csv
```

#### 3. Live Scrape

Launches headless Chrome via Puppeteer to scrape live listing sites.

```bash
npm run scrape -- --source browser --cities "Austin"
npm run scrape -- --source zillow
npm run scrape -- --source redfin
npm run scrape -- --source both
```

#### 4. Apartments.com Scrape

Scrapes Apartments.com and Rent.com (primarily Irvine / Orange County).

```bash
npm run scrape -- --source apartments
npm run scrape -- --source apartments --limit 15 --enrich
```

### CLI Options

| Flag | Default | Description |
|---|---|---|
| `--generate` | — | Use synthetic data generation |
| `--import <file>` | — | Import Redfin CSV |
| `--source <src>` | `both` | `zillow`, `redfin`, `browser`, `both`, `apartments` |
| `--cities "A,B"` | All 16 | Comma-separated city names |
| `--limit <n>` | `10` | Listings per city |
| `--enrich` | `false` | Fetch detail pages for richer data |
| `--seed <n>` | random | Reproducible random seed |
| `--output <path>` | `listings.json` | Output file path |
| `--keep-old` | `false` | Merge with existing data |
| `--dry-run` | `false` | Preview without writing |
| `--frontend` | `false` | Also write `src/data/properties.js` |

### Transform Pipeline

The `transform.js` module normalizes raw scraped data into a uniform schema:

1. **ID Generation** — Sequential `lst-NNN` IDs
2. **Address Parsing** — Extracts city, state, ZIP from raw address fields
3. **Feature Detection** — Scans description + amenity text against 10 keyword maps → binary flags
4. **Amenity Categorization** — Classifies amenity strings into building/unit/outdoor/location buckets
5. **Image Normalization** — Ensures `images[]` array and `imageUrl` primary image
6. **Output Formatting** — Produces the unified listing schema

---

## Geographic Coverage

### Web Frontend (~603 Properties) — 60 Cities

Primarily rental apartments from Rent.com across 50+ US cities spanning 25 states:

| Region | Cities |
|---|---|
| **California** | Irvine, Los Angeles, San Francisco, San Diego, San Jose, Sacramento, Anaheim, Costa Mesa, Newport Beach, Tustin, Santa Ana, Lake Forest, Foothill Ranch, Hollywood, Tarzana, Scottsdale |
| **Northeast** | New York, Brooklyn, Boston, Philadelphia, Pittsburgh, Long Island City, Staten Island, Baltimore, Richmond |
| **Southeast** | Miami, Atlanta, Nashville, Charlotte, Charleston, Tampa, Jacksonville, Savannah, Raleigh, Louisville, Memphis |
| **Midwest** | Chicago, Columbus, Cleveland, Detroit, Indianapolis, Kansas City, Milwaukee, Minneapolis, Oklahoma City |
| **West** | Seattle, Portland, Denver, Phoenix, Las Vegas, Salt Lake City, Boise, Honolulu, Albuquerque |
| **Texas** | Austin, Dallas, Houston, San Antonio, Fort Worth |
| **South** | New Orleans |

### Server Listings (160 Listings) — 16 Cities

Generated across the core target cities:

Los Angeles, New York, Brooklyn, Chicago, San Francisco, Austin, Miami, Seattle, Denver, Portland, Nashville, Boston, Atlanta, San Diego, Philadelphia, Phoenix

---

## Schema Comparison

| Field | Web (`properties.js`) | Server (`listings.json`) |
|---|---|---|
| ID | `id: 1` (number) | `"id": "lst-001"` (string) |
| Title | `title` | `title` |
| Location | `location: "City, ST"` | `city` + `state` + `address` + `zipCode` |
| Price | `price` (formatted) + `priceNum` | `price` (numeric only) |
| Type | `category` (Title Case) | `propertyType` (lowercase) |
| Beds/Baths/Sqft | Same | Same |
| Year Built | Often `null` | Always populated |
| Coordinates | `lng`, `lat` | `longitude`, `latitude` |
| Images | `images[]` | `imageUrl` + `images[]` |
| Description | `aiOverview` | `description` |
| Features | — (not present) | `features` (10 binary flags) |
| Amenities | `tags[]` (flat list) | `amenities` (categorized object) |
| Source URL | `listingUrl` | `listingUrl` |
| Metadata | — | `source`, `scrapedAt`, `floorPlanUrl` |
