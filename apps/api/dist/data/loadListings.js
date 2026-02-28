"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllListings = getAllListings;
exports.getListingById = getListingById;
exports.filterListingsByConstraints = filterListingsByConstraints;
const listings_json_1 = __importDefault(require("./listings.json"));
const listings = listings_json_1.default;
const byId = new Map();
listings.forEach((l) => byId.set(l.id, l));
function getAllListings() {
    return listings;
}
function getListingById(id) {
    return byId.get(id);
}
function filterListingsByConstraints(list, constraints) {
    if (!constraints)
        return list;
    return list.filter((l) => {
        if (l.price < constraints.budgetMin || l.price > constraints.budgetMax)
            return false;
        if (l.beds < constraints.bedsMin)
            return false;
        if (l.baths < constraints.bathsMin)
            return false;
        if (constraints.location && constraints.location.trim() !== "") {
            if (!l.city.toLowerCase().includes(constraints.location.toLowerCase().trim()))
                return false;
        }
        if (constraints.hardNo?.includes("no_parking") && l.features.parking === 1)
            return false;
        if (constraints.hardNo?.includes("no_in_unit_laundry") && l.features.inUnitLaundry === 1)
            return false;
        return true;
    });
}
