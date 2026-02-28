import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database, PropertyInsert, FloorplanInsert } from "@homeblend/types";

// ─── Client ────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Seed data ─────────────────────────────────────────────────────────────────

type PropertySeed = PropertyInsert & {
  _floorplans: Omit<FloorplanInsert, "property_id">[];
};

const PROPERTIES: PropertySeed[] = [
  // ── 1. The Columns at Irvine Spectrum ────────────────────────────────────────
  {
    name: "The Columns at Irvine Spectrum",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/the-columns-at-irvine-spectrum-irvine-ca/tg3y0kp/",
    external_id: "tg3y0kp",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "100 Spectrum Center Dr, Irvine, CA 92618",
      phone: "(949) 555-0101",
      amenities: ["Pool", "Spa", "Fitness Center", "Rooftop Deck", "Dog Park", "EV Charging"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 50, deposit: 500 },
      parking: { type: "Gated Garage", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 72,
      transit_score: 45,
      lat: 33.6512,
      lng: -117.7400,
      image_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "A1 – Studio",
        beds: 0,
        baths: 1,
        sqft: 575,
        rent: 2195,
        available_on: "2025-03-15",
        source: "apartments",
        source_url: "https://www.apartments.com/the-columns-at-irvine-spectrum-irvine-ca/tg3y0kp/#floorplan-A1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 12, floor_range: "1-4", facing: "Courtyard" },
      },
      {
        floorplan_name: "B2 – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 752,
        rent: 2595,
        available_on: "2025-03-01",
        source: "apartments",
        source_url: "https://www.apartments.com/the-columns-at-irvine-spectrum-irvine-ca/tg3y0kp/#floorplan-B2",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 24, floor_range: "2-6", facing: "Pool" },
      },
      {
        floorplan_name: "C3 – 2Bd/2Ba",
        beds: 2,
        baths: 2,
        sqft: 1104,
        rent: 3295,
        available_on: "2025-04-01",
        source: "apartments",
        source_url: "https://www.apartments.com/the-columns-at-irvine-spectrum-irvine-ca/tg3y0kp/#floorplan-C3",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 18, floor_range: "3-8", facing: "City View" },
      },
    ],
  },

  // ── 2. Anton Irvine ──────────────────────────────────────────────────────────
  {
    name: "Anton Irvine",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/anton-irvine-irvine-ca/q5j7x3m/",
    external_id: "q5j7x3m",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "3141 Michelson Dr, Irvine, CA 92612",
      phone: "(949) 555-0202",
      amenities: ["Resort Pool", "Sun Deck", "24hr Gym", "Bike Storage", "Clubhouse", "BBQ Grills"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 75, deposit: 400 },
      parking: { type: "Covered Carport", monthly_cost: 75, included: false },
      laundry: "In-Unit",
      walk_score: 68,
      transit_score: 38,
      lat: 33.6683,
      lng: -117.8213,
      image_url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "S1 – Studio",
        beds: 0,
        baths: 1,
        sqft: 512,
        rent: 2095,
        available_on: "2025-03-10",
        source: "apartments",
        source_url: "https://www.apartments.com/anton-irvine-irvine-ca/q5j7x3m/#floorplan-S1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 8, floor_range: "1-3", facing: "Courtyard" },
      },
      {
        floorplan_name: "A3 – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 724,
        rent: 2450,
        available_on: "2025-02-28",
        source: "apartments",
        source_url: "https://www.apartments.com/anton-irvine-irvine-ca/q5j7x3m/#floorplan-A3",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 32, floor_range: "1-6", facing: "Garden" },
      },
      {
        floorplan_name: "B1 – 2Bd/2Ba",
        beds: 2,
        baths: 2,
        sqft: 1052,
        rent: 3150,
        available_on: "2025-04-15",
        source: "apartments",
        source_url: "https://www.apartments.com/anton-irvine-irvine-ca/q5j7x3m/#floorplan-B1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 20, floor_range: "2-8", facing: "Pool/Spa" },
      },
    ],
  },

  // ── 3. Avalon Irvine ─────────────────────────────────────────────────────────
  {
    name: "Avalon Irvine",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/avalon-irvine-irvine-ca/m8b2p9w/",
    external_id: "m8b2p9w",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "1 Park Pl, Irvine, CA 92614",
      phone: "(949) 555-0303",
      amenities: ["2 Pools", "Hot Tub", "State-of-the-Art Gym", "Tennis Courts", "Co-Working Lounge"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 80, deposit: 450 },
      parking: { type: "Underground Garage", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 81,
      transit_score: 55,
      lat: 33.6866,
      lng: -117.8153,
      image_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "1A – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 784,
        rent: 2750,
        available_on: "2025-03-05",
        source: "apartments",
        source_url: "https://www.apartments.com/avalon-irvine-irvine-ca/m8b2p9w/#floorplan-1A",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 40, floor_range: "1-10", facing: "Various" },
      },
      {
        floorplan_name: "2B – 2Bd/2Ba",
        beds: 2,
        baths: 2,
        sqft: 1182,
        rent: 3550,
        available_on: "2025-03-20",
        source: "apartments",
        source_url: "https://www.apartments.com/avalon-irvine-irvine-ca/m8b2p9w/#floorplan-2B",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 28, floor_range: "4-12", facing: "Tennis Courts/Pool" },
      },
    ],
  },

  // ── 4. Park Place Apartment Homes ────────────────────────────────────────────
  {
    name: "Park Place Apartment Homes",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/park-place-apartment-homes-irvine-ca/x2k5r8n/",
    external_id: "x2k5r8n",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "6650 Lusk Blvd, Irvine, CA 92618",
      phone: "(949) 555-0404",
      amenities: ["Olympic Pool", "Fitness Studio", "Dog Run", "Putting Green", "Concierge"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 50, deposit: 600 },
      parking: { type: "Attached Garage", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 65,
      transit_score: 32,
      lat: 33.6467,
      lng: -117.7488,
      image_url: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Acacia – Studio",
        beds: 0,
        baths: 1,
        sqft: 492,
        rent: 2050,
        available_on: "2025-04-01",
        source: "apartments",
        source_url: "https://www.apartments.com/park-place-apartment-homes-irvine-ca/x2k5r8n/#floorplan-Acacia",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 6, floor_range: "1-2", facing: "Courtyard" },
      },
      {
        floorplan_name: "Birch – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 708,
        rent: 2395,
        available_on: "2025-03-15",
        source: "apartments",
        source_url: "https://www.apartments.com/park-place-apartment-homes-irvine-ca/x2k5r8n/#floorplan-Birch",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 22, floor_range: "1-5", facing: "Putting Green" },
      },
      {
        floorplan_name: "Cedar – 3Bd/2Ba",
        beds: 3,
        baths: 2,
        sqft: 1498,
        rent: 4295,
        available_on: "2025-05-01",
        source: "apartments",
        source_url: "https://www.apartments.com/park-place-apartment-homes-irvine-ca/x2k5r8n/#floorplan-Cedar",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 10, floor_range: "3-6", facing: "Pool" },
      },
    ],
  },

  // ── 5. Broadstone Racquet Club ───────────────────────────────────────────────
  {
    name: "Broadstone Racquet Club",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/broadstone-racquet-club-irvine-ca/v7h4c6d/",
    external_id: "v7h4c6d",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "5510 Trabuco Rd, Irvine, CA 92620",
      phone: "(949) 555-0505",
      amenities: ["Racquetball Courts", "Tennis Courts", "Resort Pool", "Sauna", "Gym", "Clubhouse"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 100, deposit: 350 },
      parking: { type: "Open Lot + Carport", monthly_cost: 50, included: false },
      laundry: "In-Unit",
      walk_score: 58,
      transit_score: 28,
      lat: 33.7117,
      lng: -117.7583,
      image_url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Plan 1 – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 762,
        rent: 2695,
        available_on: "2025-03-01",
        source: "apartments",
        source_url: "https://www.apartments.com/broadstone-racquet-club-irvine-ca/v7h4c6d/#floorplan-Plan1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 30, floor_range: "1-4", facing: "Tennis Courts" },
      },
      {
        floorplan_name: "Plan 2 – 2Bd/2Ba",
        beds: 2,
        baths: 2,
        sqft: 1148,
        rent: 3395,
        available_on: "2025-03-22",
        source: "apartments",
        source_url: "https://www.apartments.com/broadstone-racquet-club-irvine-ca/v7h4c6d/#floorplan-Plan2",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 22, floor_range: "2-5", facing: "Pool" },
      },
      {
        floorplan_name: "Plan 3 – 3Bd/2Ba",
        beds: 3,
        baths: 2,
        sqft: 1452,
        rent: 4195,
        available_on: "2025-04-10",
        source: "apartments",
        source_url: "https://www.apartments.com/broadstone-racquet-club-irvine-ca/v7h4c6d/#floorplan-Plan3",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 12, floor_range: "3-5", facing: "Racquetball/Pool" },
      },
    ],
  },

  // ── 6. The Residences at Village Center ──────────────────────────────────────
  {
    name: "The Residences at Village Center",
    city: "Irvine",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/the-residences-at-village-center-irvine-ca/r3n1t5y/",
    external_id: "r3n1t5y",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "17150 Jamboree Rd, Irvine, CA 92614",
      phone: "(949) 555-0606",
      amenities: ["Rooftop Pool & Lounge", "Sky Deck", "Fitness Center", "Resident Lounge", "Package Lockers"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 65, deposit: 500 },
      parking: { type: "Structured Parking", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 88,
      transit_score: 60,
      lat: 33.6762,
      lng: -117.8150,
      image_url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "S2 – Studio",
        beds: 0,
        baths: 1,
        sqft: 542,
        rent: 2225,
        available_on: "2025-03-08",
        source: "apartments",
        source_url: "https://www.apartments.com/the-residences-at-village-center-irvine-ca/r3n1t5y/#floorplan-S2",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 14, floor_range: "2-5", facing: "Courtyard" },
      },
      {
        floorplan_name: "1B – 1Bd/1Ba Den",
        beds: 1,
        baths: 1,
        sqft: 812,
        rent: 2795,
        available_on: "2025-03-18",
        source: "apartments",
        source_url: "https://www.apartments.com/the-residences-at-village-center-irvine-ca/r3n1t5y/#floorplan-1B",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 28, floor_range: "3-9", facing: "City/Pool" },
      },
    ],
  },

  // ── 7. The Marke Santa Ana ───────────────────────────────────────────────────
  {
    name: "The Marke",
    city: "Santa Ana",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/the-marke-santa-ana-ca/p9w6e2f/",
    external_id: "p9w6e2f",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "1440 E 4th St, Santa Ana, CA 92701",
      phone: "(714) 555-0707",
      amenities: ["Rooftop Pool", "Outdoor Lounge", "Fitness Center", "Game Room", "Dog Wash Station"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 60, deposit: 400 },
      parking: { type: "Gated Garage", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 91,
      transit_score: 78,
      lat: 33.7455,
      lng: -117.8580,
      image_url: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Studio – S1",
        beds: 0,
        baths: 1,
        sqft: 522,
        rent: 1895,
        available_on: "2025-03-01",
        source: "apartments",
        source_url: "https://www.apartments.com/the-marke-santa-ana-ca/p9w6e2f/#floorplan-S1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 16, floor_range: "1-4", facing: "Street" },
      },
      {
        floorplan_name: "1BR – A2",
        beds: 1,
        baths: 1,
        sqft: 733,
        rent: 2250,
        available_on: "2025-02-28",
        source: "apartments",
        source_url: "https://www.apartments.com/the-marke-santa-ana-ca/p9w6e2f/#floorplan-A2",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 36, floor_range: "2-7", facing: "Pool/Rooftop" },
      },
      {
        floorplan_name: "2BR – B1",
        beds: 2,
        baths: 2,
        sqft: 1024,
        rent: 2895,
        available_on: "2025-04-01",
        source: "apartments",
        source_url: "https://www.apartments.com/the-marke-santa-ana-ca/p9w6e2f/#floorplan-B1",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 24, floor_range: "3-8", facing: "City View" },
      },
    ],
  },

  // ── 8. Centro Santa Ana ──────────────────────────────────────────────────────
  {
    name: "Centro Santa Ana",
    city: "Santa Ana",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/centro-santa-ana-ca/k4m7z1b/",
    external_id: "k4m7z1b",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "201 N Broadway, Santa Ana, CA 92701",
      phone: "(714) 555-0808",
      amenities: ["Courtyard Pool", "Sun Deck", "Yoga Studio", "Co-Working Space", "Bike Repair Station"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 55, deposit: 450 },
      parking: { type: "Covered Parking", monthly_cost: 80, included: false },
      laundry: "In-Unit",
      walk_score: 95,
      transit_score: 82,
      lat: 33.7495,
      lng: -117.8674,
      image_url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Cali – 1Bd/1Ba",
        beds: 1,
        baths: 1,
        sqft: 697,
        rent: 2150,
        available_on: "2025-03-12",
        source: "apartments",
        source_url: "https://www.apartments.com/centro-santa-ana-ca/k4m7z1b/#floorplan-Cali",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 30, floor_range: "1-6", facing: "Courtyard" },
      },
      {
        floorplan_name: "Del Mar – 2Bd/2Ba",
        beds: 2,
        baths: 2,
        sqft: 988,
        rent: 2750,
        available_on: "2025-04-05",
        source: "apartments",
        source_url: "https://www.apartments.com/centro-santa-ana-ca/k4m7z1b/#floorplan-DelMar",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 18, floor_range: "3-7", facing: "Pool/City" },
      },
    ],
  },

  // ── 9. Metro East Apartments ─────────────────────────────────────────────────
  {
    name: "Metro East Apartments",
    city: "Santa Ana",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/metro-east-apartments-santa-ana-ca/j6s9u3c/",
    external_id: "j6s9u3c",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "801 N Main St, Santa Ana, CA 92701",
      phone: "(714) 555-0909",
      amenities: ["Community Pool", "Gym", "Business Center", "Laundry Facilities", "Gated Entry"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 40, deposit: 350 },
      parking: { type: "Carport", monthly_cost: 60, included: false },
      laundry: "In-Unit",
      walk_score: 89,
      transit_score: 75,
      lat: 33.7502,
      lng: -117.8721,
      image_url: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Studio Compact",
        beds: 0,
        baths: 1,
        sqft: 482,
        rent: 1795,
        available_on: "2025-03-01",
        source: "apartments",
        source_url: "https://www.apartments.com/metro-east-apartments-santa-ana-ca/j6s9u3c/#floorplan-StudioCompact",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 10, floor_range: "1-3", facing: "Courtyard" },
      },
      {
        floorplan_name: "One Bedroom Classic",
        beds: 1,
        baths: 1,
        sqft: 684,
        rent: 2095,
        available_on: "2025-03-10",
        source: "apartments",
        source_url: "https://www.apartments.com/metro-east-apartments-santa-ana-ca/j6s9u3c/#floorplan-1BRClassic",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 24, floor_range: "1-5", facing: "Street/Garden" },
      },
      {
        floorplan_name: "Two Bedroom Plus",
        beds: 2,
        baths: 2,
        sqft: 1005,
        rent: 2695,
        available_on: "2025-04-20",
        source: "apartments",
        source_url: "https://www.apartments.com/metro-east-apartments-santa-ana-ca/j6s9u3c/#floorplan-2BRPlus",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 16, floor_range: "2-5", facing: "Pool" },
      },
    ],
  },

  // ── 10. Grand + Main ─────────────────────────────────────────────────────────
  {
    name: "Grand + Main",
    city: "Santa Ana",
    state: "CA",
    source: "apartments",
    source_url: "https://www.apartments.com/grand-main-santa-ana-ca/w1d8q4h/",
    external_id: "w1d8q4h",
    status: "active",
    last_checked_at: new Date().toISOString(),
    raw: {
      address: "300 N Grand Ave, Santa Ana, CA 92701",
      phone: "(714) 555-1010",
      amenities: ["Rooftop Terrace", "Pool & Cabanas", "Fitness Center", "Resident Lounge", "Art Gallery"],
      pet_policy: { cats: true, dogs: true, weight_limit_lbs: 70, deposit: 500 },
      parking: { type: "Gated Underground Garage", monthly_cost: 0, included: true },
      laundry: "In-Unit",
      walk_score: 93,
      transit_score: 80,
      lat: 33.7482,
      lng: -117.8693,
      image_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80",
    },
    _floorplans: [
      {
        floorplan_name: "Grand Studio",
        beds: 0,
        baths: 1,
        sqft: 538,
        rent: 1975,
        available_on: "2025-03-05",
        source: "apartments",
        source_url: "https://www.apartments.com/grand-main-santa-ana-ca/w1d8q4h/#floorplan-GrandStudio",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 12, floor_range: "2-5", facing: "Courtyard" },
      },
      {
        floorplan_name: "Main 1BR",
        beds: 1,
        baths: 1,
        sqft: 712,
        rent: 2195,
        available_on: "2025-03-15",
        source: "apartments",
        source_url: "https://www.apartments.com/grand-main-santa-ana-ca/w1d8q4h/#floorplan-Main1BR",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 28, floor_range: "2-8", facing: "City/Pool" },
      },
      {
        floorplan_name: "Corner 2BR/2Ba",
        beds: 2,
        baths: 2,
        sqft: 1015,
        rent: 2795,
        available_on: "2025-04-01",
        source: "apartments",
        source_url: "https://www.apartments.com/grand-main-santa-ana-ca/w1d8q4h/#floorplan-Corner2BR",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 20, floor_range: "4-10", facing: "Rooftop/City" },
      },
      {
        floorplan_name: "Penthouse 2BR/2Ba Loft",
        beds: 2,
        baths: 2,
        sqft: 1205,
        rent: 3095,
        available_on: "2025-05-01",
        source: "apartments",
        source_url: "https://www.apartments.com/grand-main-santa-ana-ca/w1d8q4h/#floorplan-PenthouseLoft",
        status: "active",
        last_checked_at: new Date().toISOString(),
        raw: { unit_count: 6, floor_range: "9-10", facing: "360° City View" },
      },
    ],
  },
];

// ─── Insert logic ──────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n🌱  Seeding ${PROPERTIES.length} properties...\n`);

  let totalFloorplans = 0;

  for (const { _floorplans, ...propertyData } of PROPERTIES) {
    // Upsert property (idempotent — safe to re-run)
    const { data: property, error: propErr } = await supabase
      .from("properties")
      .upsert(propertyData, { onConflict: "source,source_url" })
      .select("id, name")
      .single();

    if (propErr || !property) {
      console.error(`  ❌  Failed to upsert "${propertyData.name}":`, propErr?.message);
      continue;
    }

    console.log(`  ✅  Property: ${property.name} (${property.id})`);

    // Upsert each floorplan tied to this property
    const floorplanRows: FloorplanInsert[] = _floorplans.map((fp) => ({
      ...fp,
      property_id: property.id,
    }));

    const { data: insertedFps, error: fpErr } = await supabase
      .from("floorplans")
      .upsert(floorplanRows, { onConflict: "property_id,floorplan_name" })
      .select("id, floorplan_name, beds, baths, rent");

    if (fpErr) {
      console.error(`     ❌  Failed to upsert floorplans:`, fpErr.message);
      continue;
    }

    for (const fp of insertedFps ?? []) {
      const bedsLabel = fp.beds === 0 ? "Studio" : `${fp.beds}bd`;
      console.log(
        `     └─ ${fp.floorplan_name.padEnd(28)} ${bedsLabel}/${fp.baths}ba   $${fp.rent.toLocaleString()}/mo`
      );
      totalFloorplans++;
    }
  }

  console.log(`\n✨  Done — ${PROPERTIES.length} properties, ${totalFloorplans} floorplans seeded.\n`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
