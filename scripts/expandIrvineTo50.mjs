#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), "src/data/properties.js");
let raw = fs.readFileSync(file, "utf8");

const start = raw.indexOf("export const PROPERTIES = ");
if (start === -1) throw new Error("PROPERTIES export not found");

const arrStart = raw.indexOf("[", start);
const arrEnd = raw.lastIndexOf("];");
if (arrStart === -1 || arrEnd === -1) throw new Error("Could not locate array bounds");

const jsonLike = raw.slice(arrStart, arrEnd + 1);
const asJson = jsonLike
  .replaceAll(/(\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":')
  .replaceAll(/,\s*\]/g, "]")
  .replaceAll(/,\s*\}/g, "}");

const properties = JSON.parse(asJson);

const irvineExisting = properties.filter(p => p.location === "Irvine, CA");
if (irvineExisting.length >= 50) {
  console.log(`Already has ${irvineExisting.length} Irvine properties.`);
  process.exit(0);
}

const nextId = Math.max(...properties.map(p => Number(p.id) || 0)) + 1;
let id = nextId;

const realIrvineCommunities = [
  { title: "Park Place Apartment Homes", lng: -117.8512, lat: 33.6706, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Villa Siena Apartment Homes", lng: -117.8368, lat: 33.6887, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Northwood Apartment Homes", lng: -117.7679, lat: 33.7175, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Cypress Village Apartment Homes", lng: -117.7614, lat: 33.6901, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "The Park at Irvine Spectrum", lng: -117.7422, lat: 33.6553, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Centerpointe at Irvine Spectrum", lng: -117.7425, lat: 33.6545, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Westview at Irvine Spectrum", lng: -117.7399, lat: 33.6518, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Esperanza Apartment Homes", lng: -117.7947, lat: 33.7038, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Deerfield Apartment Homes", lng: -117.7862, lat: 33.6701, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Oak Glen Apartment Homes", lng: -117.8093, lat: 33.6847, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Woodbury Place Apartment Homes", lng: -117.7448, lat: 33.6967, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Sonterra at Foothill Ranch", lng: -117.7148, lat: 33.6825, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Quail Hill Apartment Homes", lng: -117.7719, lat: 33.6428, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Los Olivos Apartment Village", lng: -117.7407, lat: 33.6807, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Aventura Apartment Homes", lng: -117.7429, lat: 33.6685, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Main Street Village", lng: -117.8625, lat: 33.6851, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Harvard Court", lng: -117.8377, lat: 33.6819, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "San Marino Villa", lng: -117.8264, lat: 33.6689, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Somerset Apartments", lng: -117.8121, lat: 33.6874, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Culver Gardens", lng: -117.7988, lat: 33.6828, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Rancho San Joaquin Apartments", lng: -117.8375, lat: 33.6539, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Willowbend Apartment Homes", lng: -117.8039, lat: 33.6742, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Montecito Vista", lng: -117.7593, lat: 33.7018, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Skyline Terrace Apartments", lng: -117.7762, lat: 33.7142, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Heritage Point Apartments", lng: -117.7461, lat: 33.7055, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Bristol Place Apartments", lng: -117.8621, lat: 33.6691, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Camden Main & Jamboree", lng: -117.8628, lat: 33.6807, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "The Kelvin Apartments", lng: -117.7476, lat: 33.6526, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Baker Block Apartments", lng: -117.8349, lat: 33.6743, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Elements 616", lng: -117.8528, lat: 33.6867, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "The Murphy Apartments", lng: -117.8613, lat: 33.6838, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Palisade Apartments", lng: -117.7601, lat: 33.6674, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Mason Park Apartments", lng: -117.8232, lat: 33.6668, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Pinecreek Village", lng: -117.8045, lat: 33.6664, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Colony Apartments", lng: -117.8161, lat: 33.6721, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Ambrose Apartments", lng: -117.7471, lat: 33.6811, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "The Alton Apartments", lng: -117.7432, lat: 33.6745, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "The Cartwright Apartments", lng: -117.7421, lat: 33.6731, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Rise Park Apartments", lng: -117.7289, lat: 33.6666, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Lapis Apartment Homes", lng: -117.7599, lat: 33.6951, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Crescent Village Apartments", lng: -117.7497, lat: 33.6863, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Axiom Apartment Homes", lng: -117.7479, lat: 33.6894, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Lexington Place Apartments", lng: -117.8348, lat: 33.6695, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Verona at Northpark", lng: -117.7765, lat: 33.7088, url: "https://www.rent.com/california/irvine-apartments" },
  { title: "Alderwood Apartments", lng: -117.7897, lat: 33.6982, url: "https://www.rent.com/california/irvine-apartments" },
];

const categories = ["Apartment", "Condo", "Townhome"];
const laundries = ["In-unit", "Shared", null];

function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const needed = 50 - irvineExisting.length;
const additions = [];

for (let i = 0; i < needed; i++) {
  const base = realIrvineCommunities[i % realIrvineCommunities.length];
  const beds = randint(1, 3);
  const baths = (() => {
    if (beds === 1) return 1;
    if (beds === 2) return 2;
    return 2.5;
  })();
  const sqft = randint(640 + beds * 120, 980 + beds * 260);
  const priceNum = randint(2450 + beds * 180, 3600 + beds * 320);
  const price = `$${priceNum.toLocaleString()} / mo`;
  additions.push({
    id: id++,
    title: base.title,
    location: "Irvine, CA",
    price,
    priceNum,
    category: categories[i % categories.length],
    beds,
    baths,
    sqft,
    yearBuilt: null,
    tags: ["Fitness Center", "Balcony/Patio", "Pet Friendly", "A/C"],
    petFriendly: true,
    parking: Math.random() > 0.4 ? "Garage" : "Assigned",
    laundry: laundries[i % laundries.length],
    lng: Number((base.lng + (Math.random() - 0.5) * 0.01).toFixed(6)),
    lat: Number((base.lat + (Math.random() - 0.5) * 0.01).toFixed(6)),
    images: [
      "https://i.rent.com/t_3x2_fixed_webp_xl/33334e32218116342464a4c7bd839c32",
      "https://i.rent.com/t_3x2_fixed_webp_xl/4d2056b77ecd6c7c6be079cc2daba137",
      "https://i.rent.com/t_3x2_fixed_webp_xl/c70b6a0d816bafc30133bd76fb46ac1d",
      "https://i.rent.com/t_3x2_fixed_webp_xl/31ca757e9fa31abe0d849c06094d8aa6",
    ],
    aiOverview: `${base.title} offers contemporary Irvine living with quick access to shopping, dining, and major employment centers.`,
    listingUrl: base.url,
  });
}

const merged = [...properties, ...additions];

const out = `export const PROPERTIES = ${JSON.stringify(merged, null, 2)};\n`;
fs.writeFileSync(file, out, "utf8");

const irvineCount = merged.filter(p => p.location === "Irvine, CA").length;
console.log(`Added ${additions.length} Irvine properties.`);
console.log(`Total Irvine properties: ${irvineCount}`);
console.log(`Total properties: ${merged.length}`);
