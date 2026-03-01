/**
 * Realistic Rental Listing Generator
 * ────────────────────────────────────
 * Generates market-representative rental listings based on real median rents,
 * market characteristics, and property distributions for each city.
 *
 * This is the instant fallback when live scraping isn't available.
 * Data ranges are based on 2025-2026 rental market data.
 */

const { FEATURE_KEYWORD_MAP } = require('./config');

/* ── Real market data per city (2025-2026 typical ranges) ─── */

const MARKET_DATA = {
  'Los Angeles': {
    state: 'CA', zip: ['90001', '90012', '90024', '90036', '90046', '90048', '90066', '90210', '90291', '90292'],
    medianRent1BR: 2200, medianRent2BR: 2950, medianRent3BR: 3800,
    priceVariance: 0.35, sqftPer1BR: [500, 850], sqftPer2BR: [800, 1200], sqftPer3BR: [1100, 1700],
    yearBuiltRange: [1925, 2025], lat: [33.92, 34.12], lng: [-118.5, -118.18],
    neighborhoods: ['Silver Lake', 'Echo Park', 'West Hollywood', 'Santa Monica', 'Venice', 'Arts District', 'Koreatown', 'Los Feliz', 'Mid-Wilshire', 'Culver City'],
    types: ['apartment', 'condo', 'house', 'studio'],
    featureBias: { naturalLight: 0.7, balcony: 0.5, parking: 0.6, modernFinishes: 0.5 },
    descriptions: [
      'Stylish unit nestled in the heart of {neighborhood} with gorgeous natural light pouring through oversized windows.',
      'Recently renovated apartment featuring quartz countertops, stainless steel appliances, and in-unit washer/dryer.',
      'Spacious layout with hardwood floors throughout and a private balcony overlooking tree-lined streets.',
      'Modern open-concept living with high ceilings, designer finishes, and walkable to trendy restaurants.',
      'Sun-drenched home with a chef\'s kitchen, walk-in closets, and secure underground parking.',
      'Charming vintage building with original hardwood floors, crown molding, and abundant storage space.',
    ],
  },
  'New York': {
    state: 'NY', zip: ['10001', '10003', '10011', '10013', '10014', '10021', '10023', '10025', '10036', '10128'],
    medianRent1BR: 3200, medianRent2BR: 4200, medianRent3BR: 5500,
    priceVariance: 0.4, sqftPer1BR: [350, 650], sqftPer2BR: [650, 1000], sqftPer3BR: [900, 1400],
    yearBuiltRange: [1890, 2025], lat: [40.71, 40.82], lng: [-74.01, -73.94],
    neighborhoods: ['Upper West Side', 'East Village', 'West Village', 'Chelsea', 'SoHo', 'Tribeca', 'Midtown', 'Harlem', 'Hell\'s Kitchen', 'Murray Hill'],
    types: ['apartment', 'studio', 'loft', 'condo'],
    featureBias: { highCeilings: 0.4, hardwoodFloors: 0.7, naturalLight: 0.4, inUnitLaundry: 0.2 },
    descriptions: [
      'Pre-war charm meets modern luxury in this beautifully renovated {neighborhood} apartment with exposed brick.',
      'Light-filled corner unit with floor-to-ceiling windows and sweeping city views from every room.',
      'Gut-renovated space with chef\'s kitchen, marble bathroom, and in-unit washer/dryer — rare find!',
      'Classic walkup with soaring 10-foot ceilings, hardwood floors throughout, and quiet tree-lined street.',
      'Doorman building with roof deck, gym, and perfectly located steps from the subway.',
      'Expansive open loft with original tin ceilings, exposed columns, and incredible natural light.',
    ],
  },
  'Brooklyn': {
    state: 'NY', zip: ['11201', '11211', '11215', '11217', '11222', '11225', '11231', '11238', '11249'],
    medianRent1BR: 2800, medianRent2BR: 3600, medianRent3BR: 4500,
    priceVariance: 0.35, sqftPer1BR: [400, 700], sqftPer2BR: [700, 1100], sqftPer3BR: [950, 1500],
    yearBuiltRange: [1880, 2025], lat: [40.64, 40.72], lng: [-73.99, -73.92],
    neighborhoods: ['Williamsburg', 'Park Slope', 'DUMBO', 'Bushwick', 'Greenpoint', 'Bed-Stuy', 'Carroll Gardens', 'Brooklyn Heights', 'Crown Heights'],
    types: ['apartment', 'brownstone', 'loft', 'condo'],
    featureBias: { hardwoodFloors: 0.75, highCeilings: 0.5, entertainingSpace: 0.4, naturalLight: 0.5 },
    descriptions: [
      'Gorgeous brownstone apartment in {neighborhood} with original details, private garden access, and tons of charm.',
      'Industrial-chic loft with exposed brick, high ceilings, and a massive open living area perfect for entertaining.',
      'Sunny apartment featuring in-unit laundry, dishwasher, and a spacious bedroom with walk-in closet.',
      'Newly renovated with modern kitchen, heated floors, and a shared rooftop with Manhattan skyline views.',
      'Classic Brooklyn living — tree-lined street, bay windows, natural light, and your own private outdoor space.',
    ],
  },
  'Chicago': {
    state: 'IL', zip: ['60601', '60605', '60607', '60610', '60613', '60614', '60622', '60625', '60640', '60657'],
    medianRent1BR: 1800, medianRent2BR: 2400, medianRent3BR: 3200,
    priceVariance: 0.3, sqftPer1BR: [550, 850], sqftPer2BR: [850, 1250], sqftPer3BR: [1100, 1800],
    yearBuiltRange: [1900, 2025], lat: [41.85, 41.97], lng: [-87.7, -87.6],
    neighborhoods: ['Lincoln Park', 'Wicker Park', 'Logan Square', 'River North', 'Lakeview', 'West Loop', 'Old Town', 'Gold Coast', 'Bucktown', 'Andersonville'],
    types: ['apartment', 'condo', 'townhouse', 'house'],
    featureBias: { parking: 0.5, inUnitLaundry: 0.5, openKitchen: 0.5, naturalLight: 0.5 },
    descriptions: [
      'Character-filled unit in classic {neighborhood} three-flat with hardwood floors and original built-ins.',
      'Modern high-rise with stunning lake views, floor-to-ceiling windows, and premium building amenities.',
      'Spacious layout with open kitchen, in-unit laundry, and a private balcony overlooking the neighborhood.',
      'Renovated vintage apartment featuring exposed brick, new kitchen, and gorgeous tree-top views.',
      'Contemporary condo with parking included, chef\'s kitchen, and walking distance to everything.',
    ],
  },
  'San Francisco': {
    state: 'CA', zip: ['94102', '94103', '94107', '94109', '94110', '94114', '94117', '94118', '94122', '94133'],
    medianRent1BR: 2800, medianRent2BR: 3800, medianRent3BR: 5000,
    priceVariance: 0.3, sqftPer1BR: [450, 750], sqftPer2BR: [750, 1100], sqftPer3BR: [1000, 1500],
    yearBuiltRange: [1895, 2025], lat: [37.73, 37.8], lng: [-122.48, -122.39],
    neighborhoods: ['Mission District', 'Hayes Valley', 'SOMA', 'Noe Valley', 'Pacific Heights', 'Marina', 'Castro', 'Richmond', 'Sunset', 'Russian Hill'],
    types: ['apartment', 'condo', 'victorian', 'house'],
    featureBias: { naturalLight: 0.5, hardwoodFloors: 0.6, highCeilings: 0.4, quietNeighborhood: 0.4 },
    descriptions: [
      'Classic Victorian charm with modern updates in sought-after {neighborhood} — bay windows and period details.',
      'Renovated flat with stunning city views, open kitchen, and beautifully maintained shared garden.',
      'Bright corner unit featuring hardwood floors, high ceilings, and easy access to parks and transit.',
      'Contemporary build with smart home features, in-unit laundry, and deeded parking spot.',
      'Spacious home with eat-in kitchen, formal dining room, and quiet residential street.',
    ],
  },
  'Austin': {
    state: 'TX', zip: ['73301', '78701', '78702', '78704', '78745', '78751', '78753', '78757', '78759'],
    medianRent1BR: 1400, medianRent2BR: 1900, medianRent3BR: 2600,
    priceVariance: 0.3, sqftPer1BR: [550, 800], sqftPer2BR: [850, 1200], sqftPer3BR: [1200, 1800],
    yearBuiltRange: [1960, 2026], lat: [30.22, 30.38], lng: [-97.82, -97.68],
    neighborhoods: ['East Austin', 'South Congress', 'Mueller', 'Domain', 'Downtown', 'Hyde Park', 'Zilker', 'Travis Heights', 'Barton Hills', 'North Loop'],
    types: ['apartment', 'condo', 'house', 'townhouse'],
    featureBias: { parking: 0.7, modernFinishes: 0.6, openKitchen: 0.6, balcony: 0.5 },
    descriptions: [
      'Modern {neighborhood} apartment with resort-style pool, dog park, and stunning Hill Country views.',
      'Recently built with smart home features, quartz countertops, and covered parking included.',
      'Spacious layout with open floor plan, walk-in closets, and private patio for outdoor living.',
      'Live/work space near South Congress with concrete floors, high ceilings, and eclectic Austin vibes.',
      'Contemporary home with EV charging, solar panels, and a gourmet kitchen for the home chef.',
    ],
  },
  'Miami': {
    state: 'FL', zip: ['33101', '33109', '33125', '33127', '33129', '33130', '33131', '33133', '33137', '33139'],
    medianRent1BR: 2200, medianRent2BR: 3200, medianRent3BR: 4200,
    priceVariance: 0.35, sqftPer1BR: [550, 850], sqftPer2BR: [850, 1300], sqftPer3BR: [1200, 1800],
    yearBuiltRange: [1950, 2026], lat: [25.75, 25.82], lng: [-80.22, -80.12],
    neighborhoods: ['Brickell', 'Wynwood', 'Coconut Grove', 'South Beach', 'Edgewater', 'Midtown', 'Little Havana', 'Design District', 'Coral Gables', 'Downtown'],
    types: ['apartment', 'condo', 'penthouse', 'house'],
    featureBias: { balcony: 0.7, naturalLight: 0.6, modernFinishes: 0.6, entertainingSpace: 0.5 },
    descriptions: [
      'Sleek {neighborhood} high-rise with wraparound balcony, bay views, and world-class building amenities.',
      'Art Deco gem steps from the beach with tropical landscaping, pool, and updated interiors.',
      'Contemporary luxury with floor-to-ceiling impact windows, Italian kitchen, and resort-style amenities.',
      'Waterfront living with marina access, concierge service, and breathtaking sunset views nightly.',
      'Renovated space with open layout, modern finishes, and walkable to the best restaurants and nightlife.',
    ],
  },
  'Seattle': {
    state: 'WA', zip: ['98101', '98102', '98103', '98105', '98107', '98109', '98112', '98115', '98116', '98122'],
    medianRent1BR: 1900, medianRent2BR: 2600, medianRent3BR: 3400,
    priceVariance: 0.3, sqftPer1BR: [450, 750], sqftPer2BR: [750, 1100], sqftPer3BR: [1000, 1500],
    yearBuiltRange: [1910, 2025], lat: [47.6, 47.7], lng: [-122.38, -122.29],
    neighborhoods: ['Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne', 'University District', 'Wallingford', 'Green Lake', 'South Lake Union', 'Columbia City', 'Beacon Hill'],
    types: ['apartment', 'condo', 'townhouse', 'house'],
    featureBias: { naturalLight: 0.4, inUnitLaundry: 0.6, quietNeighborhood: 0.5, hardwoodFloors: 0.4 },
    descriptions: [
      'Charming {neighborhood} apartment with views of the Cascades, in-unit laundry, and walkable to everything.',
      'Modern build with rooftop deck, bike storage, and spectacular mountain and water views.',
      'Cozy craftsman-style home with original hardwood floors, built-in shelves, and a private garden.',
      'Urban living with floor-to-ceiling windows, open kitchen, and steps from Pike Place Market.',
      'Eco-friendly building with green roof, EV charging, and beautifully designed community spaces.',
    ],
  },
  'Denver': {
    state: 'CO', zip: ['80202', '80203', '80204', '80205', '80206', '80209', '80210', '80211', '80218', '80220'],
    medianRent1BR: 1600, medianRent2BR: 2100, medianRent3BR: 2800,
    priceVariance: 0.3, sqftPer1BR: [500, 800], sqftPer2BR: [800, 1200], sqftPer3BR: [1100, 1700],
    yearBuiltRange: [1920, 2025], lat: [39.68, 39.78], lng: [-105.01, -104.9],
    neighborhoods: ['RiNo', 'LoDo', 'Capitol Hill', 'Highland', 'Wash Park', 'Baker', 'Sloan\'s Lake', 'Cherry Creek', 'Congress Park', 'Five Points'],
    types: ['apartment', 'condo', 'townhouse', 'house'],
    featureBias: { parking: 0.6, naturalLight: 0.6, openKitchen: 0.5, balcony: 0.5 },
    descriptions: [
      'Rocky Mountain views from your private balcony in this modern {neighborhood} apartment.',
      'Newly built with parking included, fitness center, and walkable to restaurants and breweries.',
      'Charming bungalow with original character, updated kitchen, and a shaded front porch.',
      'Loft-style living with exposed ductwork, concrete floors, and floor-to-ceiling windows.',
      'Bright and airy with mountain views, open layout, and access to hiking trails nearby.',
    ],
  },
  'Portland': {
    state: 'OR', zip: ['97201', '97202', '97205', '97209', '97210', '97211', '97212', '97213', '97214', '97221'],
    medianRent1BR: 1400, medianRent2BR: 1800, medianRent3BR: 2400,
    priceVariance: 0.25, sqftPer1BR: [450, 700], sqftPer2BR: [700, 1050], sqftPer3BR: [1000, 1500],
    yearBuiltRange: [1910, 2025], lat: [45.48, 45.56], lng: [-122.72, -122.62],
    neighborhoods: ['Pearl District', 'Alberta', 'Hawthorne', 'Division', 'Mississippi', 'Sellwood', 'Irvington', 'St. Johns', 'Hollywood', 'Northwest'],
    types: ['apartment', 'house', 'cottage', 'townhouse'],
    featureBias: { hardwoodFloors: 0.6, quietNeighborhood: 0.6, naturalLight: 0.5, inUnitLaundry: 0.4 },
    descriptions: [
      'Quirky Portland charm in {neighborhood} — craftsman details, garden access, and amazing walkability.',
      'Eco-friendly building with bike storage, composting, and beautifully maintained common areas.',
      'Bright and airy with hardwood floors throughout, updated kitchen, and quiet tree-lined street.',
      'Modern micro-living with smart storage solutions, rooftop views, and excellent transit access.',
      'Cozy cottage with private yard, washer/dryer hookups, and a neighborhood full of character.',
    ],
  },
  'Nashville': {
    state: 'TN', zip: ['37201', '37203', '37204', '37206', '37208', '37209', '37210', '37212', '37215', '37216'],
    medianRent1BR: 1500, medianRent2BR: 2000, medianRent3BR: 2700,
    priceVariance: 0.3, sqftPer1BR: [550, 800], sqftPer2BR: [850, 1200], sqftPer3BR: [1200, 1800],
    yearBuiltRange: [1940, 2026], lat: [36.12, 36.2], lng: [-86.83, -86.72],
    neighborhoods: ['East Nashville', 'The Gulch', 'Germantown', '12 South', 'Sylvan Park', 'Hillsboro Village', 'West End', 'Lockeland Springs', 'Salemtown', 'Wedgewood-Houston'],
    types: ['apartment', 'house', 'townhouse', 'condo'],
    featureBias: { parking: 0.7, openKitchen: 0.5, entertainingSpace: 0.5, hardwoodFloors: 0.5 },
    descriptions: [
      'Music City living at its finest — modern {neighborhood} apartment with rooftop and city views.',
      'Renovated craftsman with original hardwood floors, covered porch, and walkable to local favorites.',
      'New construction with smart home features, open floor plan, and a gorgeous chef\'s kitchen.',
      'Charming cottage with private yard, updated throughout, and incredible neighborhood character.',
      'Contemporary townhome with garage parking, outdoor living space, and close to everything.',
    ],
  },
  'Boston': {
    state: 'MA', zip: ['02108', '02109', '02110', '02111', '02113', '02114', '02115', '02116', '02118', '02127'],
    medianRent1BR: 2400, medianRent2BR: 3200, medianRent3BR: 4000,
    priceVariance: 0.3, sqftPer1BR: [400, 700], sqftPer2BR: [700, 1050], sqftPer3BR: [950, 1400],
    yearBuiltRange: [1870, 2025], lat: [42.33, 42.38], lng: [-71.09, -71.03],
    neighborhoods: ['Back Bay', 'South End', 'Beacon Hill', 'North End', 'Fenway', 'Seaport', 'Cambridge', 'Jamaica Plain', 'Dorchester', 'Allston'],
    types: ['apartment', 'brownstone', 'condo', 'townhouse'],
    featureBias: { hardwoodFloors: 0.7, naturalLight: 0.4, highCeilings: 0.3, inUnitLaundry: 0.3 },
    descriptions: [
      'Classic {neighborhood} brownstone with exposed brick, high ceilings, and steps from the Common.',
      'Modern build in the Seaport with harbor views, full amenity package, and waterfront living.',
      'Sun-drenched apartment with bay windows, in-unit laundry (rare!), and T access at your doorstep.',
      'Historic charm meets modern comfort — renovated kitchen, original details, and quiet courtyard.',
      'Spacious layout near the Esplanade with hardwood floors and gorgeous river views.',
    ],
  },
  'Atlanta': {
    state: 'GA', zip: ['30301', '30305', '30306', '30307', '30308', '30309', '30312', '30313', '30316', '30318'],
    medianRent1BR: 1600, medianRent2BR: 2100, medianRent3BR: 2800,
    priceVariance: 0.3, sqftPer1BR: [550, 850], sqftPer2BR: [850, 1300], sqftPer3BR: [1200, 1800],
    yearBuiltRange: [1940, 2026], lat: [33.73, 33.82], lng: [-84.42, -84.35],
    neighborhoods: ['Midtown', 'Buckhead', 'Virginia Highland', 'Inman Park', 'Old Fourth Ward', 'West Midtown', 'Decatur', 'Kirkwood', 'Grant Park', 'Poncey-Highland'],
    types: ['apartment', 'condo', 'townhouse', 'house'],
    featureBias: { parking: 0.6, modernFinishes: 0.5, openKitchen: 0.5, balcony: 0.5 },
    descriptions: [
      'Stunning {neighborhood} apartment with resort-style pool, fitness center, and walkable lifestyle.',
      'Renovated bungalow along the BeltLine with original charm and a gorgeous backyard oasis.',
      'Modern high-rise living with panoramic city views, concierge, and premium finishes throughout.',
      'Bright and spacious with hardwood floors, open kitchen, and a private balcony with tree-top views.',
      'New construction townhome with rooftop deck, smart features, and steps from Ponce City Market.',
    ],
  },
  'San Diego': {
    state: 'CA', zip: ['92101', '92102', '92103', '92104', '92106', '92107', '92109', '92116', '92120', '92130'],
    medianRent1BR: 2000, medianRent2BR: 2700, medianRent3BR: 3500,
    priceVariance: 0.3, sqftPer1BR: [500, 800], sqftPer2BR: [800, 1200], sqftPer3BR: [1100, 1600],
    yearBuiltRange: [1950, 2026], lat: [32.7, 32.82], lng: [-117.2, -117.1],
    neighborhoods: ['North Park', 'Hillcrest', 'Pacific Beach', 'Ocean Beach', 'Little Italy', 'Gaslamp', 'Mission Hills', 'University Heights', 'Normal Heights', 'La Jolla'],
    types: ['apartment', 'condo', 'house', 'studio'],
    featureBias: { naturalLight: 0.7, balcony: 0.6, parking: 0.5, openKitchen: 0.5 },
    descriptions: [
      'Beachside living in {neighborhood} with ocean breezes, sun-drenched rooms, and outdoor living space.',
      'Modern apartment with chef\'s kitchen, private balcony, and community pool steps from the bay.',
      'Renovated craftsman with hardwood floors, updated bathroom, and a quiet residential setting.',
      'Contemporary build with rooftop deck, stunning sunset views, and walkable to restaurants.',
      'Bright and breezy coastal home with open floor plan and year-round perfect weather lifestyle.',
    ],
  },
  'Philadelphia': {
    state: 'PA', zip: ['19102', '19103', '19104', '19106', '19107', '19121', '19123', '19125', '19130', '19146'],
    medianRent1BR: 1500, medianRent2BR: 1900, medianRent3BR: 2500,
    priceVariance: 0.3, sqftPer1BR: [450, 750], sqftPer2BR: [750, 1100], sqftPer3BR: [1000, 1500],
    yearBuiltRange: [1870, 2025], lat: [39.93, 39.98], lng: [-75.19, -75.13],
    neighborhoods: ['Rittenhouse', 'Fishtown', 'Graduate Hospital', 'Northern Liberties', 'Old City', 'Center City', 'Fairmount', 'Passyunk', 'University City', 'Spring Garden'],
    types: ['apartment', 'rowhouse', 'condo', 'townhouse'],
    featureBias: { hardwoodFloors: 0.6, highCeilings: 0.4, quietNeighborhood: 0.4, naturalLight: 0.4 },
    descriptions: [
      'Historic {neighborhood} rowhouse with original details, exposed brick, and stunningly renovated kitchen.',
      'Modern apartment in a converted warehouse with soaring ceilings and industrial character.',
      'Bright and spacious with bay windows, hardwood floors, and walkable to South Street.',
      'Newly renovated with in-unit laundry, central air, and quiet tree-lined residential block.',
      'Contemporary living near Rittenhouse Square with roof deck access and premium finishes.',
    ],
  },
  'Phoenix': {
    state: 'AZ', zip: ['85003', '85004', '85006', '85008', '85012', '85013', '85014', '85016', '85018', '85281'],
    medianRent1BR: 1300, medianRent2BR: 1700, medianRent3BR: 2300,
    priceVariance: 0.3, sqftPer1BR: [550, 850], sqftPer2BR: [850, 1300], sqftPer3BR: [1200, 1900],
    yearBuiltRange: [1960, 2026], lat: [33.41, 33.52], lng: [-112.1, -111.93],
    neighborhoods: ['Downtown', 'Arcadia', 'Scottsdale', 'Tempe', 'Roosevelt Row', 'Camelback', 'Biltmore', 'Central Phoenix', 'Encanto', 'Coronado'],
    types: ['apartment', 'condo', 'house', 'townhouse'],
    featureBias: { parking: 0.8, modernFinishes: 0.6, openKitchen: 0.5, entertainingSpace: 0.5 },
    descriptions: [
      'Desert modern living in {neighborhood} with mountain views, resort-style pool, and covered parking.',
      'Spacious home with open floor plan, gourmet kitchen, and a backyard oasis with fire pit.',
      'Contemporary apartment with smart home features, fitness center, and stunning sunset views.',
      'Renovated with tile floors, energy-efficient windows, and beautifully xeriscaped private patio.',
      'Modern build with community pool, hot tub, and panoramic views of Camelback Mountain.',
    ],
  },
};

/* ── Image URLs (high-quality Unsplash real estate photos) ── */

const IMAGES = {
  exterior: [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800',
  ],
  interior: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800',
    'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800',
    'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800',
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800',
    'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=800',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800',
    'https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800',
    'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800',
    'https://images.unsplash.com/photo-1600047508788-786f3865b4b5?w=800',
    'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800',
  ],
  kitchen: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
    'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800',
    'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800',
  ],
  bathroom: [
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
  ],
};

/* ── RNG helpers ──────────────────────────────────────────── */

/** Seeded PRNG for reproducibility (optional) */
let seed = null;

function setSeed(s) { seed = s; }

function random() {
  if (seed !== null) {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  return Math.random();
}

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return min + random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => random() - 0.5);
  return shuffled.slice(0, n);
}

/* ── Feature generation ───────────────────────────────────── */

function generateFeatures(market, description) {
  const features = {};
  const featureKeys = Object.keys(FEATURE_KEYWORD_MAP);

  for (const key of featureKeys) {
    const bias = market.featureBias[key] || 0.4;
    // Check if description mentions keywords
    let fromDesc = false;
    for (const kw of FEATURE_KEYWORD_MAP[key]) {
      if (description.toLowerCase().includes(kw)) {
        fromDesc = true;
        break;
      }
    }
    features[key] = fromDesc ? 1 : (random() < bias ? 1 : 0);
  }

  return features;
}

/* ── Amenity generation ───────────────────────────────────── */

function generateAmenities(features, propertyType) {
  const amenities = { building: [], unit: [], outdoor: [], location: [] };

  // Building amenities
  const buildingPool = ['elevator', 'package room', 'bike storage', 'gym', 'fitness center', 'pool', 'lounge', 'courtyard', 'roof deck', 'concierge', 'doorman', 'co-working'];
  amenities.building = pickN(buildingPool, randInt(2, 5));

  // Unit amenities
  const unitPool = ['dishwasher', 'microwave', 'central air', 'ceiling fan', 'garbage disposal'];
  amenities.unit = pickN(unitPool, randInt(2, 4));
  if (features.hardwoodFloors) amenities.unit.push('hardwood floors');
  if (features.modernFinishes) amenities.unit.push('stainless steel appliances', 'quartz countertops');
  if (features.inUnitLaundry) amenities.unit.push('in-unit washer/dryer');
  if (features.highCeilings) amenities.unit.push('high ceilings');

  // Outdoor
  if (features.balcony) amenities.outdoor.push('private balcony');
  if (random() > 0.5) amenities.outdoor.push('pet-friendly');
  if (random() > 0.6) amenities.outdoor.push('bbq area');

  // Location
  const locationPool = ['near transit', 'walkable', 'near park', 'near shopping', 'near dining'];
  amenities.location = pickN(locationPool, randInt(1, 3));

  return amenities;
}

/* ── Main generator ───────────────────────────────────────── */

/**
 * Generate realistic rental listings for all (or specified) cities.
 *
 * @param {{ cities?: string[], limit?: number, seed?: number }} opts
 * @returns {Array} Listings in HomeBlend schema
 */
function generate(opts = {}) {
  const limit = opts.limit || 10;
  if (opts.seed) setSeed(opts.seed);

  const targetCities = opts.cities
    ? Object.keys(MARKET_DATA).filter((c) =>
        opts.cities.map((x) => x.toLowerCase()).includes(c.toLowerCase())
      )
    : Object.keys(MARKET_DATA);

  const listings = [];
  let idCounter = 0;

  for (const cityName of targetCities) {
    const market = MARKET_DATA[cityName];
    if (!market) continue;

    for (let i = 0; i < limit; i++) {
      idCounter++;
      const id = `lst-${String(idCounter).padStart(3, '0')}`;

      // Random bed count (weighted toward 1-2BR)
      const bedsRoll = random();
      const beds = bedsRoll < 0.15 ? 0 : bedsRoll < 0.4 ? 1 : bedsRoll < 0.75 ? 2 : bedsRoll < 0.92 ? 3 : 4;

      // Price based on beds + market data
      const medianKey = beds <= 1 ? 'medianRent1BR' : beds === 2 ? 'medianRent2BR' : 'medianRent3BR';
      const median = market[medianKey];
      const variance = market.priceVariance;
      const rawPrice = median * randFloat(1 - variance, 1 + variance);
      const price = Math.round(rawPrice / 25) * 25; // round to $25

      // Baths
      const baths = beds <= 1 ? 1 : beds === 2 ? (random() > 0.4 ? 2 : 1) : (random() > 0.3 ? 2 : beds);

      // Sqft
      const sqftKey = beds <= 1 ? 'sqftPer1BR' : beds === 2 ? 'sqftPer2BR' : 'sqftPer3BR';
      const sqft = randInt(market[sqftKey][0], market[sqftKey][1]);

      // Year built
      const yearBuilt = randInt(market.yearBuiltRange[0], market.yearBuiltRange[1]);

      // Location
      const neighborhood = pick(market.neighborhoods);
      const lat = +randFloat(market.lat[0], market.lat[1]).toFixed(6);
      const lng = +randFloat(market.lng[0], market.lng[1]).toFixed(6);
      const zip = pick(market.zip);
      const propertyType = pick(market.types);

      // Description
      const descTemplate = pick(market.descriptions);
      const description = descTemplate.replace('{neighborhood}', neighborhood);

      // Features (driven by description + market bias)
      const features = generateFeatures(market, description);

      // Amenities
      const amenities = generateAmenities(features, propertyType);

      // Images (3-6 per listing)
      const numImages = randInt(3, 6);
      const images = [
        pick(IMAGES.exterior),
        pick(IMAGES.interior),
        pick(IMAGES.interior),
        pick(IMAGES.kitchen),
        pick(IMAGES.bathroom),
        pick(IMAGES.interior),
      ].slice(0, numImages);

      // Title
      const adjectives = ['Charming', 'Modern', 'Spacious', 'Bright', 'Cozy', 'Sleek', 'Stylish', 'Sun-Drenched', 'Renovated', 'Stunning'];
      const adj = pick(adjectives);
      const typeLabel = beds === 0 ? 'Studio' : propertyType.charAt(0).toUpperCase() + propertyType.slice(1);
      const title = `${adj} ${beds > 0 ? beds + '-Bed ' : ''}${typeLabel} in ${neighborhood}`;

      // Address
      const streetNum = randInt(100, 9999);
      const streetNames = ['Main St', 'Oak Ave', 'Elm Dr', 'Park Blvd', 'Broadway', 'Market St', '1st Ave', '2nd St', 'Highland Ave', 'Maple Ln', 'Cedar Rd', 'Pine St'];
      const address = `${streetNum} ${pick(streetNames)}, ${cityName}, ${market.state} ${zip}`;

      listings.push({
        id,
        title,
        address,
        city: cityName,
        state: market.state,
        zipCode: zip,
        price,
        beds,
        baths,
        sqft,
        yearBuilt,
        propertyType,
        latitude: lat,
        longitude: lng,
        imageUrl: images[0],
        images,
        floorPlanUrl: null,
        description,
        amenities,
        features,
        listingUrl: '',
        source: 'generated',
        scrapedAt: new Date().toISOString(),
      });
    }
  }

  return listings;
}

module.exports = { generate, MARKET_DATA, setSeed };
