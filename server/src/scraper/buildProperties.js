#!/usr/bin/env node
/**
 * Build final properties.js with:
 * 1. Existing 70 Irvine/OC properties (IDs 1–70)
 * 2. 63 scraped rent.com properties (7 cities: NY, LA, Chicago, Houston, Phoenix, Philly, San Antonio)
 * 3. Generated realistic properties for remaining 43 cities (10 each)
 *
 * Uses real apartment names, real apartments.com image URLs (from earlier scrape),
 * and accurate city-center coordinates with natural spread.
 *
 * Writes to src/data/properties.js
 */
const fs = require("fs");
const path = require("path");

/* ── State abbreviation map ─────────────────────────────────────────────── */
const STATE_ABBR = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI",
  "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME",
  "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
  "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
  "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
  "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
  "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
};

function normalizeLocation(loc) {
  // "Chicago, Illinois" → "Chicago, IL"
  const parts = loc.split(", ");
  if (parts.length === 2) {
    const abbr = STATE_ABBR[parts[1]];
    if (abbr) return `${parts[0]}, ${abbr}`;
  }
  return loc;
}

/* ── City center coordinates + real apartment complex names ─────────────── */
const CITY_DATA = {
  "San Diego, CA":      { lat: 32.7157, lng: -117.1611, names: ["Broadway Towers","IMT Mission Valley","AMLI Aero","Diega","GEMA","Vora Mission Valley","The Lindley","The Wyatt","Silo Apartments","Folia Apartments"] },
  "Dallas, TX":         { lat: 32.7767, lng: -96.7970, names: ["The Statler Residences","Maple District Lofts","Alexan West End","Peak at LBJ","Lennox at West Village","The Katy","Elan Uptown","1900 McKinney","JeffJack Apartments","The Victor"] },
  "Austin, TX":         { lat: 30.2672, lng: -97.7431, names: ["The Independent","Rainey Street Flats","Amli on 2nd","East Avenue","The Bowie","Windsor South Lamar","Camden Rainey Street","Eleven by Windsor","Hanover Republic Square","Moontower Apartments"] },
  "Jacksonville, FL":   { lat: 30.3322, lng: -81.6557, names: ["Brooklyn Riverside","The Lofts at Brooklyn","RiverVue","220 Riverside","San Marco Place","Vista Brooklyn","The Palms at Nocatee","SoDo Apartments","Lofts at Murray Hill","Parkside at Town Center"] },
  "San Jose, CA":       { lat: 37.3382, lng: -121.8863, names: ["Centerra","Axis SJ","Meridian at Midtown","The Pierce","South Almaden","Modera San Pedro","The Grad","Sparq","Cerano","M at Santana Row"] },
  "Fort Worth, TX":     { lat: 32.7555, lng: -97.3308, names: ["The Stockyards Lofts","West 7th Flats","Near Southside","Crestmont Reserve","Trinity Bluff","Magnolia Sycamore","Alexan Southside","Lola Apartments","850 South","River East"] },
  "Columbus, OH":       { lat: 39.9612, lng: -82.9988, names: ["The Jeffrey","Jeffrey Park","145 Front","Gravity","Broad & High","The Nicholas","Arena Crossing","Discovery Park","Harrison West Lofts","The Avenue"] },
  "Charlotte, NC":      { lat: 35.2271, lng: -80.8431, names: ["Novel NoDa","Crescent Dilworth","Camden Gallery","The Railyard","SkyHouse South End","Novel South End","MAA Reserve","Arden Westover","Link Apartments","Ascent Uptown"] },
  "Indianapolis, IN":   { lat: 39.7684, lng: -86.1581, names: ["The Ardmore","Artistry Apartments","Lockerbie Lofts","Mass Ave Flats","The Coil","Penrose on Mass","Park at Traders Point","CityWay","Millikan on Mass","The Waverley"] },
  "San Francisco, CA":  { lat: 37.7749, lng: -122.4194, names: ["NEMA SF","Jasper","The Hamilton","L Seven","33 Tehama","Avalon at Mission Bay","Channel Mission Bay","Arc Light","Potrero Launch","Etta Castro"] },
  "Seattle, WA":        { lat: 47.6062, lng: -122.3321, names: ["Cirrus","Kiara","Gridiron","The Cove","Luma","Anthem","The Post","8th & Republican","Stratus","Modera Capitol Hill"] },
  "Denver, CO":         { lat: 39.7392, lng: -104.9903, names: ["The Confluence","Alexan RiNo","Novel RiNo","The Coloradan","The Parkline","Verve","Broadstone Infinity","One River North","The Lydian","Parc Mosaic"] },
  "Nashville, TN":      { lat: 36.1627, lng: -86.7816, names: ["505 Nashville","Novel Gulch","The Cadence","Peridot Midtown","Broadstone Germantown","The Melrose","Novel Edgehill","Modera Gulch","1201 Demonbreun","Pine Street Flats"] },
  "Oklahoma City, OK":  { lat: 35.4676, lng: -97.5164, names: ["The Steelyard","The Edge at Midtown","Level Urban","Midtown Renaissance","The Metropolitan","Film Row Lofts","Classen25","The Rise at Northgate","Deep Deuce at Bricktown","Park Harvey"] },
  "Portland, OR":       { lat: 45.5152, lng: -122.6784, names: ["The Overton","Modera Pearl","Hassalo on Eighth","Block 17","The Janey","Asa Flats","12th & Stark","The Wyatt PDX","NV Apartments","Goose Hollow Tower"] },
  "Las Vegas, NV":      { lat: 36.1699, lng: -115.1398, names: ["Juhl","The Ogden","Newport Lofts","One Las Vegas","Veer Towers","Panorama Towers","Sky Las Vegas","Allure","The Mercer","Rumor Residences"] },
  "Memphis, TN":        { lat: 35.1495, lng: -90.0490, names: ["The Ravine","Harbor Town Place","South Bluffs","Novel at Crosstown","Edge District Flats","Uptown Flats","The Citizen","502 Poplar","Mud Island Apartments","The Township"] },
  "Louisville, KY":     { lat: 38.2527, lng: -85.7585, names: ["Whiskey Row Lofts","800 City Club","The Nic at NuLu","NuLu Marketplace Lofts","Meidinger Tower","The Residences at Omni","The Henry","Speed Art Flats","800 Tower City Lofts","Main & Clay"] },
  "Baltimore, MD":      { lat: 39.2904, lng: -76.6122, names: ["The Zenith","414 Light Street","The Rotunda","Anthem House","The Bozzuto at Harbor East","Stadium Square","Union Wharf","Park Charles","The Fitzgerald","The Wexley"] },
  "Milwaukee, WI":      { lat: 43.0389, lng: -87.9065, names: ["The Couture","Ascent MKE","The Bohemian","7Seven","Moderne","Catalyst","New Land Lofts","Rhythm Apartments","Huron Building","The North End"] },
  "Albuquerque, NM":    { lat: 35.0844, lng: -106.6504, names: ["Silver Gardens","Nob Hill Apartments","Urbane Uptown","One Central","Montecito Pointe","Volte Apartments","Mesa del Sol","Ventana Ranch","The Lofts at Martineztown","Sandia Shadows"] },
  "Tucson, AZ":         { lat: 32.2226, lng: -110.9747, names: ["The Cadence at 4th Ave","Poseidon on 4th","Hub at Tucson","Sol y Luna","Sabino Vista","La Cholla Urban Living","Rillito Village","The District on 5th","Grant Road Lofts","Iron Horse"] },
  "Sacramento, CA":     { lat: 38.5816, lng: -121.4944, names: ["The Hardin","The Press","Ice Blocks","Aura Midtown","Township Nine","Eviva Midtown","Sierra Oaks","400 Capitol Mall","The Residences at DoCo","Riverview Plaza"] },
  "Kansas City, MO":    { lat: 39.0997, lng: -94.5786, names: ["Power & Light Lofts","The Roost","Crossroads West","Union Berkley","The Grand","One Light","Two Light","Three Light","The Reverb","Arterra Place"] },
  "Atlanta, GA":        { lat: 33.7490, lng: -84.3880, names: ["Broadstone Midtown","Modera Midtown","The Local","Gables Residences","Hanover West Peachtree","Citizen Ponce","Novel O4W","The Interlock","Alexan Lenox","Ascent Peachtree"] },
  "Raleigh, NC":        { lat: 35.7796, lng: -78.6382, names: ["The Lincoln","Skyhouse Raleigh","The Dillon","Origin North Hills","Novel Glenwood","Union Station Lofts","Link Apartments Glenwood","Bloc83","Elan City Center","Park Central"] },
  "Miami, FL":          { lat: 25.7617, lng: -80.1918, names: ["Brickell Heights","SLS Lux Brickell","Paraiso Bayviews","Natiivo Miami","Panorama Tower","Quadro","Canvas","Broadstone Brickell","AMLI Wynwood","The Crosby"] },
  "Minneapolis, MN":    { lat: 44.9778, lng: -93.2650, names: ["The Nordic","Nolo at North Loop","Nic on Fifth","The Elliot","Latitude 45","4Marq","The Expo","Flux Apartments","Junction Flats","Mill City Quarter"] },
  "Tampa, FL":          { lat: 27.9506, lng: -82.4572, names: ["Novel Midtown Tampa","The Grayson","Heron Adamo","The Pearl","Central Ave Lofts","Broadstone Hyde Park","Modera Westshore","The Heights at Armature","Channel Club","The Residences at Sparkman Wharf"] },
  "Tulsa, OK":          { lat: 36.1540, lng: -95.9928, names: ["Tulsa Arts Lofts","Blue Dome Flats","Cimarron Tower","The Edge at East Village","Brady Lofts","The Boxyard","Mayo 420","Deco on 2nd","Cherry Street Flats","The Pearl District Apartments"] },
  "New Orleans, LA":    { lat: 29.9511, lng: -90.0715, names: ["The Standard NOLA","South Market District","Crescent Club","HRI at The Strand","The Saulet","Bywater Landing","Canal 1535","The Brandon","930 Poydras","Felicite"] },
  "Cleveland, OH":      { lat: 41.4993, lng: -81.6944, names: ["The Beacon","9 on the River","The Residences at 1717","Playhouse Square Lofts","The Quarter","The Lumen","Reserve Square","Intro","The May Apartments","Battery Park"] },
  "Honolulu, HI":       { lat: 21.3069, lng: -157.8583, names: ["Ke Kilohana","The Collection","Aalii at Ward Village","Koa Ridge","Kuilei Place","Waiea","Anaha","Victoria Place","Park Lane Ala Moana","Kakaako Apartments"] },
  "Pittsburgh, PA":     { lat: 40.4406, lng: -79.9959, names: ["The Cork Factory","The Highline","350 Oliver","Three PNC Plaza","Bakery Square Lofts","Arsenal 201","SouthSide Works City Apartments","Schenley Apartments","Lot 24","The Yard"] },
  "Boston, MA":         { lat: 42.3601, lng: -71.0589, names: ["Watermark Seaport","The Lantera","The Eddy","Hub50House","One Canal","315 on A","100 Pier 4","Channel Center","Ora Seaport","The Victor Boston"] },
  "Salt Lake City, UT": { lat: 40.7608, lng: -111.8910, names: ["The Aster","Hardware Apartments","Liberty Sky","Milagro","999 South","The Flats at Cityunity","Pierpont Lofts","Liberty Center","Post District","247 Lofts"] },
  "Detroit, MI":        { lat: 42.3314, lng: -83.0458, names: ["The Scott at Brush Park","The Griswold","City Club Apartments","Orleans Landing","The Albert","The Foundry","Parker Durand","Rivertown Lofts","The Burton","Elton Park"] },
  "Washington, DC":     { lat: 38.9072, lng: -77.0369, names: ["The Wharf","Anthem Row","City Ridge","The Harper","Resa at Navy Yard","Novel South Capitol","The Kelvin","The Maren","Insignia on M","The Apollo"] },
  "Richmond, VA":       { lat: 37.5407, lng: -77.4360, names: ["Canal Lofts","The Locks","SCAD Quarter","Deco at CNB","The Current","River Lofts at Tobacco Row","Haxall Point","The Valentine","Capital Square","Manchester Flats"] },
  "Boise, ID":          { lat: 43.6150, lng: -116.2023, names: ["The Fowler","Hannah Lofts","Front Street Station","JUMP Lofts","8th & Main","Boise River Flats","Terrace Apartments","The Depot","Ada Lofts","Capitol Blvd Studios"] },
  "Scottsdale, AZ":     { lat: 33.4942, lng: -111.9261, names: ["Optima Kierland","The Mark Scottsdale","Cavasson","Broadstone Fashion Center","The Core Scottsdale","Camelback Vue","Sage Scottsdale","Scottsdale Quarter","Palladium Scottsdale","The Luxe at Talking Stick"] },
  "Charleston, SC":     { lat: 32.7765, lng: -79.9311, names: ["The Jasper","Elan Midtown Charleston","The Portside","Lindy on the Ashley","Meeting at Broad","Merchant at Upper King","The Local on King","Laurel Island","Midtown Charleston","567 King"] },
  "Savannah, GA":       { lat: 32.0809, lng: -81.0912, names: ["The Abercorn","River District Lofts","Starland Flats","Broughton Commons","The Drayton","Plant Riverside","Oglethorpe Apartments","Bull Street Lofts","The Forsyth","Habersham Apartments"] },
};

/* ── Real apartments.com image CDN URLs from scraped San Diego data ────── */
const APT_IMAGES = [
  "https://images1.apartments.com/i2/e-TQ5fE2je0iWS_sunUjT5R5e9odUg6TEYYTI85NaIo/118/broadway-towers-san-diego-ca-living-space-with-huge-windows.jpg",
  "https://images1.apartments.com/i2/U8aPV8Ojw-1XYfBf29YFiMb8eRCN9uEgFB49XWqXzgU/118/imt-mission-valley-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/94FIoX5tNKVxANsJI41o46lxHoC4mdKv3U7VcYKWpjw/118/amli-aero-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/wo2awbPjJsR92aXdZAASkdcO3poxocu2iHQQ6G4-VAI/118/del-oro-on-broadway-chula-vista-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/iIbEFjjefOX5H0WlX4Z0MyN-mBcBzelR-kRWFkomFHM/118/diega-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/7zoCdQTrEkdkJJD3_Q1a3c-8QyGTZq8zBbc_VwYrQAA/118/gema-san-diego-ca-interior-photo.jpg",
  "https://images1.apartments.com/i2/8DR7wGReSyfaebOg7LJvxCFBmAaS3mTs1Z7tWo5gImw/118/vora-mission-valley-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/C8nZOcC72qNHqpLBCErGkOrqovqcyeMG2H_Srue5CfQ/118/the-lindley-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/2DNnbs7N-vzoJPxKzK6G6zR3Skuf50aFqcDE4_lUPOU/118/the-wyatt-makers-quarter-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/A8aMMjJoq0QcbE5zZdCoSt499WAqROfQpC7rUHuoIjw/118/silo-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/Jhm3NsngMQbtHfVTtef7pCt9Io0hCNKWFIvYdr-JVLk/118/folia-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/aDic__FMYpYrEfjn2XqO6ZgLDhdvVf9p2-skWhpkMCU/118/2911-adams-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/-XZVdxbzUpcrejeABy1B9SZmyYTGE2NUMkHkBWZFan0/118/alexan-camellia-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/kWVhgaie58BdV9COMYacdTQ1DpBgf0Q37Ugbg83mr0k/118/broadstone-mission-valley-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/sDoyNRNylI20lQnuEqhQxATTpOes5ahkfAqZ4a9KaHw/118/64-forty-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/1YHugw9d3l0-GctpGtVSBe3hF2xvvGF2CfMFCKbRIRI/118/ancora-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/EFh6xD3LKuAcgXhU7CG2_yKcLm3UII_zsC4i4QLWUxE/118/tenney-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/j5ZH0Hz-9497zMZx4JxudWg7S68EGGJkY9Rt6UrqlCA/118/rowyn-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/dLVdo-OH_pFWL2IRgYXDG3sTX9UhLyjYWHuMibzmO18/118/town-park-villas-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/7eVRIF147q0WPufAAHcww_uzddrYTqXJjZ_fQvaD-vw/118/the-villas-at-camino-bernardo-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/3Z5vknDa5SRl7qoGkojUV0pHph9-TJgZYsKnHRx2q6g/118/west-park-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/dLKqoV34O3GkzE98X34bx26S3DzhvH2Io7RJJ1N8Gvo/118/pinnacle-on-the-park-san-diego-ca-interior-photo.jpg",
  "https://images1.apartments.com/i2/d0xLKHJofd4lA0wqY7FZuEAi7a9EiZ0KqNQPjNMLOqg/118/pacific-ridge-san-diego-ca-cabana-pool.jpg",
  "https://images1.apartments.com/i2/pUwILXi4PFVJmspkhT598dKY_ls4pu5yaIF4SG47c-o/118/loft2015-apartments-san-diego-ca-building-photo.png",
  "https://images1.apartments.com/i2/WMdibGNU08bj1qlDl9w18xRDEugAjHFtRiSbVIe4DOo/118/alx-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/g1w9Cx9Fe0T5lbwaYhDWZIiWqhrCNU-tLBUdr-gUdO8/118/avia-la-jolla-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/KstXFWUt0DvQUlMIW7043Tcy1U0jxmrP8iKHvmEg5Dg/118/west-sd-apartments-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/C0ou3I1If1CXuDnMgbhFj7Aa74pa4H28r0QSjY84uSw/118/the-hub-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/WvsX3ylHWxrdbKkWQpstxvQgr_3SWVAARdprS_JZQ8I/118/rivair-apartment-homes-san-diego-ca-building-photo.jpg",
  "https://images1.apartments.com/i2/81Vc7kCrYwI72YLXH3tzS0eS9bgehjsrckcdWDrOfLI/118/radian-san-diego-ca-building-photo.jpg",
];

const TAGS_POOL = [
  "Pet Friendly","Pool","Gym","A/C","Dishwasher","Balcony",
  "Concierge","Rooftop","EV Charging","Smart Home","Furnished",
  "Fireplace","Storage","Clubhouse","Business Center","Dog Park",
  "Bike Storage","Package Lockers","Controlled Access","Fitness Center",
];

// Deterministic seeded random from hash
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

function offsetCoord(center, idx, total, rng) {
  const angle = (idx / total) * 2 * Math.PI + (rng() - 0.5) * 0.5;
  const radius = 0.01 + rng() * 0.04;
  return {
    lat: parseFloat((center.lat + radius * Math.sin(angle)).toFixed(6)),
    lng: parseFloat((center.lng + radius * Math.cos(angle)).toFixed(6)),
  };
}

function generateForCity(cityName, cityInfo, startId) {
  const rng = seededRandom(cityName);
  const listings = [];
  const names = cityInfo.names;

  for (let i = 0; i < 10; i++) {
    const coord = offsetCoord(cityInfo, i, 10, rng);
    const priceBase = cityName.includes("San Francisco") || cityName.includes("Boston") || cityName.includes("Honolulu") ? 2800 :
                      cityName.includes("New York") || cityName.includes("Miami") || cityName.includes("Seattle") ? 2400 :
                      cityName.includes("Denver") || cityName.includes("Portland") || cityName.includes("Nashville") ? 2000 :
                      cityName.includes("Memphis") || cityName.includes("Tulsa") || cityName.includes("Albuquerque") || cityName.includes("Detroit") ? 1200 :
                      1600;
    const priceNum = priceBase + Math.floor(rng() * 1500);

    const nTags = 2 + Math.floor(rng() * 4);
    const shuffled = [...TAGS_POOL].sort(() => rng() - 0.5);
    const tags = shuffled.slice(0, nTags);

    const beds = 1 + Math.floor(rng() * 3);
    const baths = 1 + Math.floor(rng() * 2);
    const sqft = 450 + Math.floor(rng() * 1200);
    const imgOffset = Math.floor(rng() * APT_IMAGES.length);
    const images = [];
    for (let j = 0; j < 3; j++) {
      images.push(APT_IMAGES[(imgOffset + j) % APT_IMAGES.length]);
    }

    const slug = names[i].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const citySlug = cityName.split(",")[0].toLowerCase().replace(/\s+/g, "-");
    const stateAbbr = cityName.split(", ")[1] || "";

    listings.push({
      id: startId + i,
      title: names[i],
      location: cityName,
      price: `$${priceNum.toLocaleString()} / mo`,
      priceNum,
      category: "Apartment",
      beds,
      baths,
      sqft,
      yearBuilt: null,
      tags,
      petFriendly: tags.includes("Pet Friendly"),
      parking: rng() > 0.3 ? "Garage" : null,
      laundry: ["In-unit", "Shared", "In-unit"][Math.floor(rng() * 3)],
      lng: coord.lng,
      lat: coord.lat,
      images,
      aiOverview: `Modern apartment living at ${names[i]} in the heart of ${cityName.split(",")[0]}, ${stateAbbr}. Features upscale amenities and convenient urban location.`,
      listingUrl: `https://www.apartments.com/${slug}-${citySlug}/`,
    });
  }
  return listings;
}

/* ── Main ───────────────────────────────────────────────────────────────── */
(function main() {
  // 1. Read existing properties from the JS module file
  const existingFile = path.join(__dirname, "../../../src/data/properties.js");
  const existingContent = fs.readFileSync(existingFile, "utf-8");
  // Extract the array body between first [ and last ]
  const match = existingContent.match(/export const PROPERTIES = (\[[\s\S]*\]);?\s*$/);
  let existingProps = [];
  if (match) {
    try {
      existingProps = eval(match[1]);
    } catch (e) {
      console.error("Failed to parse existing properties:", e.message);
      process.exit(1);
    }
  }
  console.log(`Existing properties: ${existingProps.length}`);

  // 2. Load scraped rent.com listings
  let scraped = [];
  try {
    scraped = JSON.parse(fs.readFileSync("/tmp/scraped_properties.json", "utf-8"));
    // Normalize locations
    scraped = scraped.map(p => ({
      ...p,
      location: normalizeLocation(p.location),
    }));
    console.log(`Scraped rent.com listings: ${scraped.length}`);
  } catch {
    console.log("No scraped data found");
  }

  // 3. Determine which cities we already cover
  const coveredCities = new Set();
  existingProps.forEach(p => coveredCities.add(p.location));
  scraped.forEach(p => coveredCities.add(p.location));
  console.log(`Cities already covered: ${[...coveredCities].join(", ")}`);

  // 4. Generate properties for remaining cities
  let nextId = Math.max(...existingProps.map(p => p.id), ...scraped.map(p => p.id)) + 1;
  const generated = [];

  for (const [cityName, cityInfo] of Object.entries(CITY_DATA)) {
    if (coveredCities.has(cityName)) {
      console.log(`  Skip ${cityName} (already covered)`);
      continue;
    }
    const listings = generateForCity(cityName, cityInfo, nextId);
    generated.push(...listings);
    nextId += listings.length;
    console.log(`  Generated ${listings.length} for ${cityName}`);
  }

  // 5. Combine all
  const allProps = [...existingProps, ...scraped, ...generated];
  console.log(`\nTotal properties: ${allProps.length}`);

  // By city
  const byCity = {};
  allProps.forEach(p => byCity[p.location] = (byCity[p.location] || 0) + 1);
  console.log(`Cities: ${Object.keys(byCity).length}`);
  Object.entries(byCity).sort((a, b) => a[0].localeCompare(b[0])).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  // 6. Write properties.js
  const lines = allProps.map(p => {
    const imgs = p.images.map(i => `      "${i}"`).join(",\n");
    const tags = p.tags.map(t => `"${t}"`).join(", ");
    return `  {
    id: ${p.id}, title: ${JSON.stringify(p.title)}, location: ${JSON.stringify(p.location)},
    price: ${JSON.stringify(p.price)}, priceNum: ${p.priceNum}, category: ${JSON.stringify(p.category)},
    beds: ${p.beds}, baths: ${p.baths}, sqft: ${p.sqft}, yearBuilt: ${p.yearBuilt},
    tags: [${tags}],
    petFriendly: ${p.petFriendly}, parking: ${p.parking ? JSON.stringify(p.parking) : "null"}, laundry: ${p.laundry ? JSON.stringify(p.laundry) : "null"},
    lng: ${p.lng}, lat: ${p.lat},
    images: [
${imgs}
    ],
    aiOverview: ${JSON.stringify(p.aiOverview)},
    listingUrl: ${JSON.stringify(p.listingUrl)},
  }`;
  });

  const output = `export const PROPERTIES = [\n${lines.join(",\n")}\n];\n`;
  fs.writeFileSync(existingFile, output, "utf-8");
  console.log(`\nWrote ${allProps.length} properties to ${existingFile}`);
})();
