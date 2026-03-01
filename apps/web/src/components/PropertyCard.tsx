import { useState } from "react";
import type { PropertyWithFloorplans, FloorplanRow } from "@homeblend/types";
import { useAuth } from "../context/AuthContext";

type PropertyRaw = {
  address?: string;
  amenities?: string[];
  pet_policy?: { cats?: boolean; dogs?: boolean; weight_limit_lbs?: number; deposit?: number };
  parking?: { type?: string; monthly_cost?: number; included?: boolean };
  laundry?: string;
  walk_score?: number;
  transit_score?: number;
  image_url?: string;
  year_built?: number;
  property_type?: string;
};

const MARKET_AVG: Record<string, Record<number, number>> = {
  Irvine:      { 0: 2100, 1: 2550, 2: 3300, 3: 4250 },
  "Santa Ana": { 0: 1850, 1: 2200, 2: 2800, 3: 3800 },
};

function marketAvg(city: string, beds: number): number {
  const table = MARKET_AVG[city] ?? MARKET_AVG["Irvine"];
  return table[Math.min(beds, 3)] ?? 3000;
}

function derivePropertyType(name: string, raw: PropertyRaw): string {
  if (raw.property_type) return raw.property_type;
  const n = name.toLowerCase();
  if (n.includes("townhome") || n.includes("townhouse")) return "Townhome";
  if (n.includes("condo") || n.includes("condominium")) return "Condo";
  if (n.includes("single family") || n.includes("house")) return "Single Family";
  return "Apartment";
}

/** Extract a short neighbourhood label from the property name */
function extractNeighborhood(name: string): string {
  return name
    .replace(/^the\s+/i, "")
    .replace(/\s+(apartments?|apt|homes?|townhomes?|residences?|place|center|centre|complex|communities?|square|park|lofts?)\b.*/i, "")
    .replace(/\s+at\s+.*/i, "")
    .trim();
}

interface Props {
  property: PropertyWithFloorplans;
  isSelected: boolean;
  onClick: () => void;
  onSaveToBlend?: (propertyId: string) => void;
}

export default function PropertyCard({ property, isSelected, onClick, onSaveToBlend }: Props) {
  const [showExplain, setShowExplain] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const { user, openAuthModal } = useAuth();

  function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) openAuthModal();
    else onSaveToBlend?.(property.id);
  }

  const raw      = (property.raw ?? {}) as PropertyRaw;
  const propType = derivePropertyType(property.name, raw);
  const location = `${extractNeighborhood(property.name)}, ${property.city} CA`;

  const cheapest: FloorplanRow | undefined = property.floorplans?.length
    ? [...property.floorplans].sort((a, b) => a.rent - b.rent)[0]
    : undefined;

  const avg      = cheapest ? marketAvg(property.city, cheapest.beds) : null;
  const diff     = cheapest && avg ? cheapest.rent - avg : null;
  const perSqft  = cheapest?.sqft && cheapest.sqft > 0
    ? (cheapest.rent / cheapest.sqft).toFixed(2)
    : null;
  const yearBuilt  = raw.year_built ?? null;
  const hasPets    = raw.pet_policy?.cats || raw.pet_policy?.dogs;
  const imageUrl   = raw.image_url ?? "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80";

  // Row 1: icon features
  const iconFeatures: { icon: string; label: string }[] = [];
  if (raw.parking?.type) iconFeatures.push({ icon: "🚗", label: raw.parking.type });
  if (raw.laundry)        iconFeatures.push({ icon: "🧺", label: raw.laundry });
  if (hasPets)            iconFeatures.push({ icon: "🐾", label: "Pets OK" });

  // Row 2+: all amenities
  const amenities = raw.amenities ?? [];

  return (
    <>
      <article
        onClick={onClick}
        className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer hover:shadow-md ${
          isSelected
            ? "border-[#A67C52] ring-1 ring-[#A67C52]/40 shadow-md"
            : "border-[#e8d5b7] shadow-sm"
        }`}
      >
        {/* ── Image ── */}
        <div className="relative h-[140px] overflow-hidden bg-[#f0dfc0]">
          <img
            src={imageUrl}
            alt={property.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />

          {/* Gradient */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent pointer-events-none" />

          {/* Type badge */}
          <span className="absolute top-2 right-2 bg-[#A67C52] text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase shadow-sm">
            {propType}
          </span>

          {/* Price */}
          <div className="absolute bottom-2 left-3">
            <p className="text-white font-bold text-[17px] leading-tight">
              {cheapest ? `$${cheapest.rent.toLocaleString()}` : "—"}
              <span className="text-sm font-normal text-white/80"> / mo</span>
            </p>
            {perSqft && cheapest?.sqft && (
              <p className="text-[10px] text-white/70 leading-tight">
                ≈ ${perSqft}/sqft/mo · sqft: {cheapest.sqft.toLocaleString()}
              </p>
            )}
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`w-1 h-1 rounded-full ${i === 0 ? "bg-white" : "bg-white/45"}`} />
            ))}
          </div>

          {/* Save/heart */}
          <button
            type="button"
            onClick={handleSaveClick}
            title={user ? "Save to Blend" : "Sign in to save"}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center transition-all hover:scale-110"
          >
            <svg className="w-3.5 h-3.5 text-stone-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-3 pt-2.5 pb-2 space-y-2">

          {/* Name + location */}
          <div>
            <p className="font-bold text-stone-900 text-[13px] leading-snug">{property.name}</p>
            <p className="text-[11px] text-[#A67C52] mt-0.5 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
              </svg>
              {location}
            </p>
          </div>

          {/* Stats grid */}
          {cheapest && (
            <div className="grid grid-cols-4 border border-[#e8d5b7] rounded-lg overflow-hidden bg-[#FFF2E1]">
              {[
                { value: cheapest.beds === 0 ? "0" : String(cheapest.beds), label: "BEDS" },
                { value: String(cheapest.baths), label: "BATHS" },
                { value: cheapest.sqft ? cheapest.sqft.toLocaleString() : "—", label: "SQ FT" },
                { value: yearBuilt ? String(yearBuilt) : "—", label: "BUILT" },
              ].map((stat, i, arr) => (
                <div key={stat.label} className={`text-center py-2 ${i < arr.length - 1 ? "border-r border-[#e8d5b7]" : ""}`}>
                  <p className="text-[13px] font-bold text-stone-900 leading-none">{stat.value}</p>
                  <p className="text-[9px] text-stone-400 uppercase tracking-wider mt-0.5 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Feature pills */}
          {(iconFeatures.length > 0 || amenities.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {iconFeatures.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 text-[11px] bg-[#FFF2E1] text-stone-700 px-2 py-0.5 rounded-full border border-[#e8d5b7] font-medium"
                >
                  {f.icon} {f.label}
                </span>
              ))}
              {amenities.map((a) => (
                <span
                  key={a}
                  className="text-[11px] bg-[#FFF2E1] text-stone-700 px-2 py-0.5 rounded-full border border-[#e8d5b7] font-medium"
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* All Overview accordion */}
          <div className="border border-[#e8d5b7] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOverviewOpen((v) => !v); }}
              className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-[#FFF2E1] transition-colors text-left"
            >
              <svg className="w-3.5 h-3.5 text-[#A67C52] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[12px] font-medium text-stone-700 flex-1">All Overview</span>
              <svg
                className={`w-3.5 h-3.5 text-stone-400 transition-transform shrink-0 ${overviewOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {overviewOpen && (
              <div className="px-3 pb-3 pt-1.5 space-y-1.5 border-t border-[#e8d5b7] bg-[#FFF2E1]">
                {diff !== null && (
                  <p className="text-[11px] text-stone-600">
                    <span className={diff <= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                      {diff <= 0 ? "▼" : "▲"} ${Math.abs(diff).toLocaleString()}
                    </span>{" "}
                    vs market avg for {property.city}
                  </p>
                )}
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  {property.name} offers{" "}
                  {property.floorplans?.length ?? 0} floor plan{(property.floorplans?.length ?? 0) !== 1 ? "s" : ""}
                  {cheapest?.sqft ? ` from ${cheapest.sqft.toLocaleString()} sqft` : ""}.{" "}
                  {hasPets ? "Pet-friendly. " : ""}
                  {raw.walk_score ? `Walk: ${raw.walk_score}/100.` : ""}
                </p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowExplain(true); }}
                  className="text-[11px] font-semibold text-[#A67C52] hover:underline"
                >
                  Full breakdown →
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* ── Explain modal ── */}
      {showExplain && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowExplain(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-base leading-snug">{property.name}</h3>
                {raw.address && <p className="text-xs text-stone-400 mt-0.5">{raw.address}</p>}
              </div>
              <button
                type="button"
                onClick={() => setShowExplain(false)}
                className="shrink-0 w-8 h-8 rounded-full bg-[#FFF2E1] hover:bg-[#f0dfc0] flex items-center justify-center text-stone-500 text-lg leading-none"
              >×</button>
            </div>

            {property.floorplans?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Floor Plans</p>
                <div className="space-y-1.5">
                  {[...property.floorplans].sort((a, b) => a.rent - b.rent).map((fp) => (
                    <div key={fp.id} className="flex items-center justify-between text-xs bg-[#FFF2E1] rounded-xl px-3 py-2">
                      <span className="text-stone-700 font-medium">{fp.floorplan_name}</span>
                      <div className="flex items-center gap-2 text-stone-500">
                        <span>{fp.beds === 0 ? "Studio" : `${fp.beds}bd`}/{fp.baths}ba{fp.sqft ? ` · ${fp.sqft.toLocaleString()} sqft` : ""}</span>
                        <span className="font-semibold text-stone-800">${fp.rent.toLocaleString()}/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {amenities.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map((a) => (
                    <span key={a} className="text-xs bg-[#A67C52]/10 text-[#A67C52] px-2.5 py-0.5 rounded-full font-medium">{a}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {raw.pet_policy && (
                <div className="bg-[#FFF2E1] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-stone-400 mb-1">Pets</p>
                  <p className="text-sm text-stone-700">
                    {[raw.pet_policy.cats && "Cats", raw.pet_policy.dogs && "Dogs"].filter(Boolean).join(" & ") || "No pets"}
                  </p>
                  {raw.pet_policy.weight_limit_lbs && <p className="text-xs text-stone-400 mt-0.5">Up to {raw.pet_policy.weight_limit_lbs} lbs</p>}
                </div>
              )}
              {raw.parking && (
                <div className="bg-[#FFF2E1] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-stone-400 mb-1">Parking</p>
                  <p className="text-sm text-stone-700">{raw.parking.type}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{raw.parking.included ? "Included" : `$${raw.parking.monthly_cost}/mo`}</p>
                </div>
              )}
              {raw.walk_score !== undefined && (
                <div className="bg-[#FFF2E1] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-stone-400 mb-1">Walk Score</p>
                  <p className="text-xl font-bold text-stone-800">{raw.walk_score}</p>
                  <p className="text-xs text-stone-400">/ 100</p>
                </div>
              )}
              {raw.transit_score !== undefined && (
                <div className="bg-[#FFF2E1] rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-stone-400 mb-1">Transit Score</p>
                  <p className="text-xl font-bold text-stone-800">{raw.transit_score}</p>
                  <p className="text-xs text-stone-400">/ 100</p>
                </div>
              )}
            </div>

            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 text-center text-sm font-semibold text-white bg-[#A67C52] hover:bg-[#8B6843] rounded-xl transition-colors"
            >
              View listing →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
