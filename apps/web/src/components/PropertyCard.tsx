import { useState } from "react";
import type { PropertyWithFloorplans, FloorplanRow } from "@homeblend/types";
import { useAuth } from "../context/AuthContext";

const SOURCE_CONFIG: Record<string, { label: string; bg: string }> = {
  apartments: { label: "Apartments.com", bg: "bg-cyan-600" },
  zillow:     { label: "Zillow",          bg: "bg-blue-700" },
  redfin:     { label: "Redfin",          bg: "bg-red-600"  },
  other:      { label: "Other",           bg: "bg-gray-500" },
};

const MARKET_AVG: Record<string, Record<number, number>> = {
  Irvine:    { 0: 2100, 1: 2550, 2: 3300, 3: 4250 },
  "Santa Ana": { 0: 1850, 1: 2200, 2: 2800, 3: 3800 },
};

function marketAvg(city: string, beds: number): number {
  const table = MARKET_AVG[city] ?? MARKET_AVG["Irvine"];
  return table[Math.min(beds, 3)] ?? 3000;
}

type PropertyRaw = {
  address?: string;
  amenities?: string[];
  pet_policy?: { cats?: boolean; dogs?: boolean; weight_limit_lbs?: number; deposit?: number };
  parking?: { type?: string; monthly_cost?: number; included?: boolean };
  laundry?: string;
  walk_score?: number;
  transit_score?: number;
  image_url?: string;
};

interface Props {
  property: PropertyWithFloorplans;
  isSelected: boolean;
  onClick: () => void;
  /** Called when user clicks "Save to Blend" and is authenticated */
  onSaveToBlend?: (propertyId: string) => void;
}

export default function PropertyCard({ property, isSelected, onClick, onSaveToBlend }: Props) {
  const [showExplain, setShowExplain] = useState(false);
  const { user, openAuthModal } = useAuth();

  function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
    } else {
      onSaveToBlend?.(property.id);
    }
  }

  const raw = (property.raw ?? {}) as PropertyRaw;
  const source = SOURCE_CONFIG[property.source] ?? SOURCE_CONFIG.other;

  const cheapest: FloorplanRow | undefined = property.floorplans?.length
    ? [...property.floorplans].sort((a, b) => a.rent - b.rent)[0]
    : undefined;

  const avg  = cheapest ? marketAvg(property.city, cheapest.beds) : null;
  const diff = cheapest && avg ? cheapest.rent - avg : null;

  const imageUrl =
    raw.image_url ??
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80";

  const bedsLabel = !cheapest
    ? "—"
    : cheapest.beds === 0
    ? "Studio"
    : `${cheapest.beds} bed${cheapest.beds !== 1 ? "s" : ""}`;

  const hasPets    = raw.pet_policy?.cats || raw.pet_policy?.dogs;
  const parkingLabel = raw.parking?.type
    ? raw.parking.included
      ? raw.parking.type
      : `${raw.parking.type} (+$${raw.parking.monthly_cost}/mo)`
    : null;

  return (
    <>
      <article
        onClick={onClick}
        className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-200 cursor-pointer hover:shadow-md ${
          isSelected
            ? "border-blue-500 ring-1 ring-blue-400 shadow-blue-100 shadow-md"
            : "border-gray-100"
        }`}
      >
        {/* Image */}
        <div className="relative h-48 overflow-hidden bg-gray-100">
          <img
            src={imageUrl}
            alt={property.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <span className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            Available
          </span>
          <span
            className={`absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${source.bg}`}
          >
            {source.label}
          </span>
          {/* Save to Blend button */}
          <button
            type="button"
            onClick={handleSaveClick}
            title={user ? "Save to Blend" : "Sign in to save"}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-all hover:scale-110"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Price row */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900">
                {cheapest ? `$${cheapest.rent.toLocaleString()}` : "—"}
              </span>
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            {diff !== null && (
              <span
                className={`text-xs font-semibold flex items-center gap-0.5 shrink-0 ${
                  diff <= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {diff <= 0 ? "▼" : "▲"}${Math.abs(diff).toLocaleString()} vs market
              </span>
            )}
          </div>

          {/* Name */}
          <p className="font-semibold text-gray-800 leading-snug text-sm">{property.name}</p>

          {/* Address */}
          {raw.address && (
            <p className="text-xs text-gray-400 leading-snug flex items-center gap-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {raw.address}
            </p>
          )}

          {/* Stats row */}
          {cheapest && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                {bedsLabel}
              </span>
              <span className="text-gray-200">·</span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 2v4M18 2v4M2 10h20M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" />
                </svg>
                {cheapest.baths} ba
              </span>
              {cheapest.sqft && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="text-gray-500">{cheapest.sqft.toLocaleString()} sqft</span>
                </>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {hasPets && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                🐾 Pets OK
              </span>
            )}
            {parkingLabel && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                🚗 {parkingLabel}
              </span>
            )}
            {raw.laundry && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                🧺 {raw.laundry}
              </span>
            )}
            {(property.floorplans?.length ?? 0) > 1 && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                +{property.floorplans.length - 1} floor plan{property.floorplans.length - 1 !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExplain(true);
            }}
            className="w-full py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl border border-gray-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="text-purple-400">✦</span>
            Explain This Rental
          </button>
        </div>
      </article>

      {/* Explain modal */}
      {showExplain && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowExplain(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-snug">{property.name}</h3>
                {raw.address && <p className="text-sm text-gray-400 mt-0.5">{raw.address}</p>}
              </div>
              <button
                type="button"
                onClick={() => setShowExplain(false)}
                className="shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Floor plans summary */}
            {property.floorplans?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Floor Plans
                </p>
                <div className="space-y-1.5">
                  {[...property.floorplans]
                    .sort((a, b) => a.rent - b.rent)
                    .map((fp) => (
                      <div
                        key={fp.id}
                        className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2"
                      >
                        <span className="text-gray-700 font-medium">{fp.floorplan_name}</span>
                        <div className="flex items-center gap-3 text-gray-500 text-xs">
                          <span>
                            {fp.beds === 0 ? "Studio" : `${fp.beds}bd`}/{fp.baths}ba
                            {fp.sqft ? ` · ${fp.sqft.toLocaleString()} sqft` : ""}
                          </span>
                          <span className="font-semibold text-gray-800">${fp.rent.toLocaleString()}/mo</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {raw.amenities && raw.amenities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Amenities
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {raw.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {raw.pet_policy && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Pets</p>
                  <p className="text-sm text-gray-700">
                    {[raw.pet_policy.cats && "Cats", raw.pet_policy.dogs && "Dogs"]
                      .filter(Boolean)
                      .join(" & ") || "No pets"}
                  </p>
                  {raw.pet_policy.weight_limit_lbs && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Up to {raw.pet_policy.weight_limit_lbs} lbs
                    </p>
                  )}
                  {raw.pet_policy.deposit && (
                    <p className="text-xs text-gray-400">${raw.pet_policy.deposit} deposit</p>
                  )}
                </div>
              )}
              {raw.parking && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Parking</p>
                  <p className="text-sm text-gray-700">{raw.parking.type}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {raw.parking.included
                      ? "Included"
                      : `$${raw.parking.monthly_cost}/mo`}
                  </p>
                </div>
              )}
              {raw.walk_score !== undefined && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Walk Score</p>
                  <p className="text-2xl font-bold text-gray-800">{raw.walk_score}</p>
                  <p className="text-xs text-gray-400">out of 100</p>
                </div>
              )}
              {raw.transit_score !== undefined && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-400 mb-1">Transit Score</p>
                  <p className="text-2xl font-bold text-gray-800">{raw.transit_score}</p>
                  <p className="text-xs text-gray-400">out of 100</p>
                </div>
              )}
            </div>

            {/* View listing link */}
            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 text-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              View on {source.label} →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
