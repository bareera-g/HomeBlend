"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTasteVector = computeTasteVector;
exports.compatibilityPercent = compatibilityPercent;
exports.computeBlend = computeBlend;
const loadListings_1 = require("../data/loadListings");
const FEATURE_KEYS = [
    "naturalLight",
    "parking",
    "openKitchen",
    "balcony",
    "inUnitLaundry",
];
function computeTasteVector(userId, swipes) {
    const yesListings = swipes
        .filter((s) => s.vote === "YES")
        .map((s) => (0, loadListings_1.getListingById)(s.listingId))
        .filter((l) => l != null);
    const vec = {
        naturalLight: 0,
        parking: 0,
        openKitchen: 0,
        balcony: 0,
        inUnitLaundry: 0,
    };
    if (yesListings.length === 0)
        return vec;
    for (const k of FEATURE_KEYS) {
        let sum = 0;
        for (const l of yesListings)
            sum += l.features[k];
        vec[k] = sum / yesListings.length;
    }
    return vec;
}
function cosineDistance(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (const k of FEATURE_KEYS) {
        dot += a[k] * b[k];
        normA += a[k] * a[k];
        normB += b[k] * b[k];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0)
        return 0;
    const sim = dot / denom;
    return 1 - (sim + 1) / 2; // map [-1,1] to [0,1] distance
}
function compatibilityPercent(vecA, vecB) {
    const dist = cosineDistance(vecA, vecB);
    return Math.round((1 - dist) * 100);
}
function computeBlend(users, swipesByUser) {
    const tasteVectors = {};
    for (const u of users) {
        tasteVectors[u.id] = computeTasteVector(u.id, swipesByUser(u.id));
    }
    const compatibilityMatrix = {};
    for (const a of users) {
        compatibilityMatrix[a.id] = {};
        for (const b of users) {
            if (a.id === b.id) {
                compatibilityMatrix[a.id][b.id] = 100;
            }
            else {
                compatibilityMatrix[a.id][b.id] = compatibilityPercent(tasteVectors[a.id], tasteVectors[b.id]);
            }
        }
    }
    let groupSum = 0;
    let pairCount = 0;
    for (const a of users) {
        for (const b of users) {
            if (a.id < b.id) {
                groupSum += compatibilityMatrix[a.id][b.id];
                pairCount++;
            }
        }
    }
    const groupCompatibility = pairCount > 0 ? Math.round(groupSum / pairCount) : 100;
    const conflicts = [];
    for (const a of users) {
        for (const b of users) {
            if (a.id >= b.id)
                continue;
            const va = tasteVectors[a.id];
            const vb = tasteVectors[b.id];
            if (va.naturalLight > 0.7 && vb.parking > 0.7 && Math.abs(va.naturalLight - vb.parking) > 0.3) {
                conflicts.push(`${a.name} prioritizes natural light; ${b.name} prioritizes parking.`);
            }
            if (va.parking > 0.7 && vb.naturalLight > 0.7 && Math.abs(va.parking - vb.naturalLight) > 0.2) {
                conflicts.push(`${a.name} and ${b.name} have different must-haves (parking vs light).`);
            }
        }
    }
    const comp = groupCompatibility;
    if (comp < 50)
        conflicts.push("Group has low taste alignment overall.");
    if (conflicts.length > 5)
        conflicts.length = 5;
    const insights = [];
    for (const u of users) {
        const swipes = swipesByUser(u.id);
        const yesSwipes = swipes.filter((s) => s.vote === "YES");
        const yesListings = yesSwipes
            .map((s) => (0, loadListings_1.getListingById)(s.listingId))
            .filter((l) => l != null);
        const bullets = [];
        const vec = tasteVectors[u.id];
        if (vec.naturalLight > 0.75)
            bullets.push("Always says yes to natural light.");
        if (vec.parking > 0.75)
            bullets.push("Prioritizes parking.");
        if (vec.openKitchen > 0.75)
            bullets.push("Loves open kitchens.");
        if (vec.balcony > 0.75)
            bullets.push("Values outdoor space (balcony).");
        if (vec.inUnitLaundry > 0.75)
            bullets.push("Wants in-unit laundry.");
        if (yesListings.length > 0) {
            const avgPrice = yesListings.reduce((s, l) => s + l.price, 0) / yesListings.length;
            bullets.push(`Tends to like listings around $${Math.round(avgPrice)}.`);
        }
        if (bullets.length === 0)
            bullets.push("No strong preferences yet.");
        insights.push({ userId: u.id, bullets: bullets.slice(0, 3) });
    }
    const groupBullets = [];
    if (groupCompatibility >= 80)
        groupBullets.push("High group compatibility.");
    if (groupCompatibility < 50)
        groupBullets.push("Mixed preferences; compromise will help.");
    if (conflicts.length > 0)
        groupBullets.push("Some dealbreaker differences to discuss.");
    insights.push({ bullets: groupBullets.slice(0, 3) });
    return {
        tasteVectors,
        compatibilityMatrix,
        groupCompatibility,
        conflicts,
        insights,
    };
}
