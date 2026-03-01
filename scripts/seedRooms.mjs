#!/usr/bin/env node
/**
 * seedRooms.mjs — Seed Firestore with demo users, rooms, properties & votes.
 *
 * Creates:
 *   • Users: Abhi, Rishi, Colleen, Alex
 *   • Room 1: "Abhi & Rishi's Apartment Hunt" — Abhi (owner) + Rishi, 10 Irvine props
 *   • Room 2: "Colleen & Alex's Place Search" — Colleen (owner) + Alex, 15 props (Irvine + Tustin)
 *   • Room 3: "OC Squad" — All 4 users, 20 props (Irvine + Tustin), overlapping preferences
 *
 * Run:  node scripts/seedRooms.mjs
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";

// ── Firebase config (same as the app) ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAGXAdIIrqsx_5HLrkU3ilLb_H2OCLpnwk",
  authDomain: "homeblend-5192f.firebaseapp.com",
  projectId: "homeblend-5192f",
  storageBucket: "homeblend-5192f.firebasestorage.app",
  messagingSenderId: "753671088483",
  appId: "1:753671088483:web:cf91851c1714e1f23f4b56",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const AVATAR_COLORS = ["#A67C3D", "#5C8A6B", "#7B6FA0", "#C0624A", "#4A7EA0", "#8A6B5C"];

// ── Users ────────────────────────────────────────────────────────────────────
const USERS = [
  { id: "abhi",    display_name: "Abhi",    avatar_color: "#A67C3D" },
  { id: "rishi",   display_name: "Rishi",   avatar_color: "#5C8A6B" },
  { id: "colleen", display_name: "Colleen", avatar_color: "#7B6FA0" },
  { id: "alex",    display_name: "Alex",    avatar_color: "#C0624A" },
];

// ── Room Definitions ─────────────────────────────────────────────────────────
// Property IDs:
//   1-10  = Irvine, CA
//   11-20 = Tustin, CA
//   21-30 = Costa Mesa, CA
//   31-40 = Lake Forest, CA

const ROOMS = [
  {
    name: "Abhi & Rishi's Apartment Hunt",
    owner: "abhi",
    members: ["abhi", "rishi"],
    // All 10 Irvine properties
    properties: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    votes: {
      // propertyId → { userId: 1 (like) or -1 (dislike) }
      1:  { abhi: 1,  rishi: 1  },  // Both like  — Las Palmas
      2:  { abhi: 1,  rishi: -1 },  // Split      — Stanford Court
      3:  { abhi: 1,  rishi: 1  },  // Both like  — Village at Irvine Spectrum
      4:  { abhi: -1, rishi: -1 },  // Both dislike — Santa Maria
      5:  { abhi: 1,  rishi: -1 },  // Split      — Portola Court
      6:  { abhi: -1, rishi: 1  },  // Split      — Mirasol
      7:  { abhi: 1,  rishi: 1  },  // Both like  — Volar
      8:  { abhi: -1, rishi: 1  },  // Split      — Orchard Hills
      9:  { abhi: -1, rishi: -1 },  // Both dislike — San Carlo Villa
      10: { abhi: 1,  rishi: -1 },  // Split      — Cedar Creek
    },
  },
  {
    name: "Colleen & Alex's Place Search",
    owner: "colleen",
    members: ["colleen", "alex"],
    // Irvine + Tustin properties
    properties: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    votes: {
      1:  { colleen: 1,  alex: 1  },  // Both like  — Las Palmas
      2:  { colleen: -1, alex: -1 },  // Both dislike — Stanford Court
      3:  { colleen: 1,  alex: 1  },  // Both like  — Village at Irvine Spectrum
      4:  { colleen: -1, alex: 1  },  // Split      — Santa Maria
      5:  { colleen: -1, alex: -1 },  // Both dislike — Portola Court
      6:  { colleen: 1,  alex: 1  },  // Both like  — Mirasol
      7:  { colleen: 1,  alex: 1  },  // Both like  — Volar
      8:  { colleen: 1,  alex: -1 },  // Split      — Orchard Hills
      9:  { colleen: -1, alex: -1 },  // Both dislike — San Carlo Villa
      10: { colleen: 1,  alex: 1  },  // Both like  — Cedar Creek
      11: { colleen: 1,  alex: 1  },  // Both like  — Briarwood (Tustin)
      12: { colleen: -1, alex: 1  },  // Split      — Woodside Garden
      13: { colleen: 1,  alex: -1 },  // Split      — Chatham Village
      14: { colleen: -1, alex: -1 },  // Both dislike — Tustin Cottages
      15: { colleen: 1,  alex: 1  },  // Both like  — Axiom Tustin
    },
  },
  {
    name: "OC Squad",
    owner: "abhi",
    members: ["abhi", "rishi", "colleen", "alex"],
    // Irvine + Tustin properties
    properties: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    votes: {
      // All 4 like
      1:  { abhi: 1,  rishi: 1,  colleen: 1,  alex: 1  },  // Las Palmas
      3:  { abhi: 1,  rishi: 1,  colleen: 1,  alex: 1  },  // Village at Irvine Spectrum
      7:  { abhi: 1,  rishi: 1,  colleen: 1,  alex: 1  },  // Volar
      // All 4 dislike
      4:  { abhi: -1, rishi: -1, colleen: -1, alex: -1 },  // Santa Maria
      9:  { abhi: -1, rishi: -1, colleen: -1, alex: -1 },  // San Carlo Villa
      14: { abhi: -1, rishi: -1, colleen: -1, alex: -1 },  // Tustin Cottages
      // 3 like / 1 dislike
      2:  { abhi: 1,  rishi: 1,  colleen: -1, alex: 1  },  // Stanford Court
      8:  { abhi: 1,  rishi: 1,  colleen: 1,  alex: -1 },  // Orchard Hills
      11: { abhi: 1,  rishi: -1, colleen: 1,  alex: 1  },  // Briarwood
      15: { abhi: 1,  rishi: 1,  colleen: 1,  alex: -1 },  // Axiom Tustin
      // 3 dislike / 1 like
      5:  { abhi: -1, rishi: -1, colleen: -1, alex: 1  },  // Portola Court
      // 2-2 split
      6:  { abhi: -1, rishi: 1,  colleen: 1,  alex: -1 },  // Mirasol
      10: { abhi: 1,  rishi: -1, colleen: 1,  alex: -1 },  // Cedar Creek
      12: { abhi: -1, rishi: 1,  colleen: -1, alex: 1  },  // Woodside Garden
      // More mixed
      13: { abhi: 1,  rishi: 1,  colleen: 1,  alex: -1 },  // Chatham Village
      16: { abhi: 1,  rishi: -1, colleen: 1,  alex: 1  },  // Alders
      17: { abhi: -1, rishi: -1, colleen: 1,  alex: 1  },  // Rancho Maderas
      18: { abhi: 1,  rishi: 1,  colleen: -1, alex: -1 },  // Walnut East
      19: { abhi: -1, rishi: 1,  colleen: 1,  alex: -1 },  // Rancho Mariposa
      20: { abhi: 1,  rishi: -1, colleen: -1, alex: 1  },  // Sierra Vista
    },
  },
];

// ── Seed Logic ───────────────────────────────────────────────────────────────
async function ensureUsers() {
  console.log("👤 Creating users…");
  const userMap = {};
  for (const u of USERS) {
    userMap[u.id] = u;
    const userRef = doc(db, "users", u.id);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      console.log(`   ✓ ${u.display_name} already exists`);
    } else {
      await setDoc(userRef, {
        display_name: u.display_name,
        avatar_color: u.avatar_color,
        createdAt: new Date(),
      });
      console.log(`   + Created ${u.display_name} (${u.id})`);
    }
  }
  return userMap;
}

async function loadUserRoomsMap() {
  const userRoomsMap = {};
  for (const u of USERS) {
    const urRef = doc(db, "user_rooms", u.id);
    const snap = await getDoc(urRef);
    userRoomsMap[u.id] = snap.exists() ? { ...snap.data().rooms } : {};
  }
  return userRoomsMap;
}

async function createRoom(room, userMap, userRoomsMap) {
  console.log(`\n🏘  Creating room: "${room.name}"…`);
  const code = genCode();
  const roomRef = doc(collection(db, "rooms"));
  const roomId = roomRef.id;

  const batch1 = writeBatch(db);
  batch1.set(roomRef, {
    name: room.name,
    room_code: code,
    created_by: room.owner,
    createdAt: new Date(),
  });
  batch1.set(doc(db, "room_codes", code), { roomId });

  for (const uid of room.members) {
    const u = userMap[uid];
    batch1.set(doc(db, "rooms", roomId, "members", uid), {
      joined_at: Date.now(),
      role: uid === room.owner ? "owner" : "member",
      display_name: u.display_name,
      avatar_color: u.avatar_color,
    });
    userRoomsMap[uid][roomId] = Date.now();
  }
  await batch1.commit();
  console.log(`   ✓ Room created (ID: ${roomId}, Code: ${code})`);

  const batch2 = writeBatch(db);
  for (const pid of room.properties) {
    batch2.set(doc(db, "rooms", roomId, "properties", String(pid)), {
      added_by: room.owner,
      added_at: Date.now(),
    });
  }
  await batch2.commit();
  console.log(`   ✓ Added ${room.properties.length} properties`);

  const batch3 = writeBatch(db);
  let voteCount = 0;
  for (const [pid, votes] of Object.entries(room.votes)) {
    batch3.set(doc(db, "rooms", roomId, "votes", String(pid)), votes);
    voteCount += Object.keys(votes).length;
  }
  await batch3.commit();
  console.log(`   ✓ Recorded ${voteCount} votes across ${Object.keys(room.votes).length} properties`);
}

async function seed() {
  console.log("🏠 HomeBlend Seed — Starting…\n");

  const userMap = await ensureUsers();
  const userRoomsMap = await loadUserRoomsMap();

  for (const room of ROOMS) {
    await createRoom(room, userMap, userRoomsMap);
  }

  // 3. Update user_rooms for all users
  console.log("\n📋 Updating user room memberships…");
  const batch4 = writeBatch(db);
  for (const u of USERS) {
    batch4.set(doc(db, "user_rooms", u.id), { rooms: userRoomsMap[u.id] });
  }
  await batch4.commit();
  console.log("   ✓ All user_rooms updated");

  console.log("\n✅ Seed complete!\n");
  console.log("Users created: Abhi, Rishi, Colleen, Alex");
  console.log("Rooms created:");
  console.log('  1. "Abhi & Rishi\'s Apartment Hunt" — 10 Irvine properties, 20 votes');
  console.log('  2. "Colleen & Alex\'s Place Search" — 15 Irvine+Tustin properties, 30 votes');
  console.log('  3. "OC Squad" — 20 Irvine+Tustin properties, 80 votes (all 4 users)');
  console.log("\nSign in as any of these users in the app to explore!");

  // Exit cleanly
  process.exit(0);
}

try {
  await seed();
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exit(1);
}
