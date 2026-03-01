/**
 * Scraper configuration — cities, search defaults, and feature-keyword mapping.
 */

// Target cities to scrape (matching the existing dataset cities + extras)
const CITIES = [
  { city: 'Los Angeles', state: 'CA', zillow: 'los-angeles-ca', redfin: '/city/11203/CA/Los-Angeles' },
  { city: 'New York', state: 'NY', zillow: 'new-york-ny', redfin: '/city/30749/NY/New-York' },
  { city: 'Brooklyn', state: 'NY', zillow: 'brooklyn-new-york-ny', redfin: '/neighborhood/30749/NY/New-York/Brooklyn' },
  { city: 'Chicago', state: 'IL', zillow: 'chicago-il', redfin: '/city/29470/IL/Chicago' },
  { city: 'San Francisco', state: 'CA', zillow: 'san-francisco-ca', redfin: '/city/17151/CA/San-Francisco' },
  { city: 'Austin', state: 'TX', zillow: 'austin-tx', redfin: '/city/30818/TX/Austin' },
  { city: 'Miami', state: 'FL', zillow: 'miami-fl', redfin: '/city/10195/FL/Miami' },
  { city: 'Seattle', state: 'WA', zillow: 'seattle-wa', redfin: '/city/16163/WA/Seattle' },
  { city: 'Denver', state: 'CO', zillow: 'denver-co', redfin: '/city/5155/CO/Denver' },
  { city: 'Portland', state: 'OR', zillow: 'portland-or', redfin: '/city/14734/OR/Portland' },
  { city: 'Nashville', state: 'TN', zillow: 'nashville-tn', redfin: '/city/22592/TN/Nashville' },
  { city: 'Boston', state: 'MA', zillow: 'boston-ma', redfin: '/city/1826/MA/Boston' },
  { city: 'Atlanta', state: 'GA', zillow: 'atlanta-ga', redfin: '/city/512/GA/Atlanta' },
  { city: 'San Diego', state: 'CA', zillow: 'san-diego-ca', redfin: '/city/16904/CA/San-Diego' },
  { city: 'Philadelphia', state: 'PA', zillow: 'philadelphia-pa', redfin: '/city/14240/PA/Philadelphia' },
  { city: 'Phoenix', state: 'AZ', zillow: 'phoenix-az', redfin: '/city/14240/AZ/Phoenix' },
];

// Default search parameters
const SEARCH_DEFAULTS = {
  listingsPerCity: 10,        // how many to pull per city
  minPrice: 800,              // $/month
  maxPrice: 8000,
  minBeds: 1,
  maxBeds: 5,
  propertyTypes: ['apartment', 'condo', 'townhouse', 'house'],
  forRent: true,              // rental listings (not for-sale)
};

// HTTP request defaults
const REQUEST_DEFAULTS = {
  timeout: 15000,
  retries: 2,
  retryDelay: 3000,          // ms between retries
  delayBetweenCities: 2000,  // politeness delay ms
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  ],
};

/**
 * Keyword mapping: real-world amenity text → project feature flag.
 * Each feature key has an array of keywords/phrases that indicate it.
 */
const FEATURE_KEYWORD_MAP = {
  naturalLight: [
    'natural light', 'sun-drenched', 'sun drenched', 'sun-filled', 'sun filled',
    'bright', 'sunlit', 'floor-to-ceiling windows', 'floor to ceiling windows',
    'large windows', 'oversized windows', 'skylight', 'south-facing', 'south facing',
    'wall of windows', 'abundant light', 'light-filled', 'light filled',
  ],
  parking: [
    'parking', 'garage', 'carport', 'driveway', 'covered parking',
    'assigned parking', 'parking spot', 'parking space', 'car port',
    'underground parking', 'detached garage', 'attached garage', 'ev charging',
  ],
  openKitchen: [
    'open kitchen', 'chef\'s kitchen', "chef's kitchen", 'gourmet kitchen',
    'kitchen island', 'open-concept', 'open concept', 'open floor plan',
    'open floorplan', 'eat-in kitchen', 'granite countertop', 'quartz countertop',
    'stainless steel appliances', 'modern kitchen', 'updated kitchen',
  ],
  balcony: [
    'balcony', 'patio', 'terrace', 'deck', 'outdoor space', 'porch',
    'lanai', 'veranda', 'rooftop', 'roof deck', 'wrap-around', 'wraparound',
    'private outdoor', 'screened porch', 'sun deck',
  ],
  inUnitLaundry: [
    'in-unit laundry', 'in unit laundry', 'washer/dryer', 'washer dryer',
    'washer and dryer', 'w/d in unit', 'w/d in-unit', 'laundry in unit',
    'in-home laundry', 'private laundry', 'full-size washer',
  ],
  hardwoodFloors: [
    'hardwood floor', 'hardwood', 'wood floor', 'oak floor', 'bamboo floor',
    'original hardwood', 'refinished hardwood', 'wide plank', 'wood plank',
    'engineered hardwood', 'maple floor',
  ],
  modernFinishes: [
    'modern finish', 'modern', 'contemporary', 'renovated', 'remodeled',
    'updated', 'sleek', 'luxury finish', 'high-end finish', 'premium',
    'designer', 'upgraded', 'newly renovated', 'gut renovated', 'smart home',
  ],
  quietNeighborhood: [
    'quiet', 'peaceful', 'tranquil', 'serene', 'residential',
    'cul-de-sac', 'tree-lined', 'tree lined', 'suburban', 'family-friendly',
    'low traffic', 'secluded', 'private setting', 'dead end',
  ],
  entertainingSpace: [
    'entertaining', 'great room', 'spacious living', 'open living',
    'formal dining', 'dining room', 'bonus room', 'recreation room',
    'game room', 'media room', 'family room', 'great for hosting',
    'loft space', 'finished basement', 'wet bar',
  ],
  highCeilings: [
    'high ceiling', 'tall ceiling', 'vaulted ceiling', 'cathedral ceiling',
    'soaring ceiling', 'double-height', 'double height', '10-foot ceiling',
    '10 foot ceiling', '12-foot ceiling', '12 foot ceiling', 'loft-style',
    'exposed beam', 'open beam',
  ],
};

/**
 * Extra amenity categories to extract (beyond the 10 feature flags).
 */
const AMENITY_CATEGORIES = {
  building: [
    'pool', 'gym', 'fitness center', 'doorman', 'concierge', 'elevator',
    'roof deck', 'rooftop', 'lounge', 'courtyard', 'garden', 'bike storage',
    'package room', 'co-working', 'coworking', 'business center', 'sauna',
    'hot tub', 'spa', 'game room', 'theater', 'screening room',
  ],
  unit: [
    'dishwasher', 'microwave', 'air conditioning', 'central air', 'heat',
    'fireplace', 'walk-in closet', 'storage', 'ceiling fan', 'garbage disposal',
    'smart thermostat', 'usb outlets', 'crown molding', 'exposed brick',
    'tile bathroom', 'double vanity', 'soaking tub', 'rain shower',
  ],
  outdoor: [
    'yard', 'garden', 'patio', 'pool', 'bbq', 'grill', 'fire pit',
    'playground', 'dog park', 'pet-friendly', 'pet friendly', 'fenced yard',
    'outdoor kitchen',
  ],
  location: [
    'near transit', 'walk score', 'walkable', 'near park', 'waterfront',
    'downtown', 'near school', 'near shopping', 'near dining', 'bike-friendly',
    'near highway', 'commuter friendly',
  ],
};

module.exports = {
  CITIES,
  SEARCH_DEFAULTS,
  REQUEST_DEFAULTS,
  FEATURE_KEYWORD_MAP,
  AMENITY_CATEGORIES,
};
