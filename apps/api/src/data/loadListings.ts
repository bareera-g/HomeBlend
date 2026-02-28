import type { Listing, Constraints } from "@homeblend/types";
import listingsData from "./listings.json";

const listings = listingsData as Listing[];

const byId = new Map<string, Listing>();
listings.forEach((l) => byId.set(l.id, l));

export function getAllListings(): Listing[] {
  return listings;
}

export function getListingById(id: string): Listing | undefined {
  return byId.get(id);
}

export function filterListingsByConstraints(
  list: Listing[],
  constraints: Constraints | null
): Listing[] {
  if (!constraints) return list;
  return list.filter((l) => {
    if (l.price < constraints.budgetMin || l.price > constraints.budgetMax) return false;
    if (l.beds < constraints.bedsMin) return false;
    if (l.baths < constraints.bathsMin) return false;
    if (constraints.location && constraints.location.trim() !== "") {
      if (!l.city.toLowerCase().includes(constraints.location.toLowerCase().trim())) return false;
    }
    if (constraints.hardNo?.includes("no_parking") && l.features.parking === 1) return false;
    if (constraints.hardNo?.includes("no_in_unit_laundry") && l.features.inUnitLaundry === 1)
      return false;
    return true;
  });
}
