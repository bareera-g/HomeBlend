export type SessionStatus = "LOBBY" | "SWIPING" | "RESULTS";
export type Vote = "YES" | "NO" | "MAYBE";
export type RentOrBuy = "RENT" | "BUY";
export interface ListingFeatures {
    naturalLight: 0 | 1;
    parking: 0 | 1;
    openKitchen: 0 | 1;
    balcony: 0 | 1;
    inUnitLaundry: 0 | 1;
}
export interface Constraints {
    rentOrBuy: RentOrBuy;
    budgetMin: number;
    budgetMax: number;
    bedsMin: number;
    bathsMin: number;
    location: string;
    hardNo: string[];
}
export interface Session {
    id: string;
    code: string;
    createdAt: number;
    hostName?: string;
    constraints: Constraints | null;
    listingPoolId: string;
    status: SessionStatus;
}
export interface User {
    id: string;
    sessionId: string;
    name: string;
    createdAt: number;
    isReady: boolean;
}
export interface Swipe {
    sessionId: string;
    userId: string;
    listingId: string;
    vote: Vote;
    ts: number;
}
export interface Listing {
    id: string;
    title: string;
    city: string;
    price: number;
    beds: number;
    baths: number;
    imageUrl: string;
    features: ListingFeatures;
}
export declare const DEFAULT_CONSTRAINTS: Constraints;
//# sourceMappingURL=index.d.ts.map