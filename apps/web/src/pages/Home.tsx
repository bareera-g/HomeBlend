import { useMemo, useRef, useState } from "react";
import { useProperties } from "../hooks/useProperties";
import ListingMap from "../components/ListingMap";
import PropertyCard from "../components/PropertyCard";
import NavBar from "../components/NavBar";
import AddToBlendModal from "../components/AddToBlendModal";

const CITIES = ["Irvine", "Santa Ana"];

export default function Home() {
  const { properties, loading, error } = useProperties();

  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cityFilter,  setCityFilter]  = useState("");
  const [minRent,     setMinRent]     = useState<number | "">("");
  const [maxRent,     setMaxRent]     = useState<number | "">("");
  const [minBeds,     setMinBeds]     = useState<number | "">("");

  const cardsRef = useRef<HTMLDivElement>(null);
  const [blendPropertyId, setBlendPropertyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const raw = p.raw as Record<string, unknown>;
        const addr = ((raw.address as string) ?? "").toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.city.toLowerCase().includes(q) &&
          !addr.includes(q)
        ) return false;
      }

      if (cityFilter && p.city !== cityFilter) return false;

      const cheapest = p.floorplans?.slice().sort((a, b) => a.rent - b.rent)[0];
      if (cheapest) {
        if (minRent !== "" && cheapest.rent < minRent) return false;
        if (maxRent !== "" && cheapest.rent > maxRent) return false;
        if (minBeds !== "" && cheapest.beds < minBeds) return false;
      }

      return true;
    });
  }, [properties, search, cityFilter, minRent, maxRent, minBeds]);

  const totalFloorplans = filtered.reduce(
    (sum, p) => sum + (p.floorplans?.length ?? 0),
    0
  );

  const hasFilters = !!(cityFilter || minRent !== "" || maxRent !== "" || minBeds !== "");

  function handleSelectPin(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
    const el = document.getElementById(`card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function clearFilters() {
    setCityFilter("");
    setMinRent("");
    setMaxRent("");
    setMinBeds("");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <NavBar />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative shrink-0 bg-gray-900 overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900/75 via-gray-900/60 to-gray-900/80" />

        <div className="relative z-10 px-5 pt-5 pb-5">
          {/* Top row: title */}
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Find Your Next Rental
            </h1>
            <p className="text-sm text-gray-300 mt-0.5">
              AI-powered insights on{" "}
              <span className="font-semibold text-white">{totalFloorplans}</span>{" "}
              rentals in{" "}
              <span className="font-semibold text-white">
                {cityFilter ? `${cityFilter}, CA` : "Irvine & Santa Ana, CA"}
              </span>
            </p>
          </div>

          {/* Search + Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by name, city or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-gray-800 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border transition-all ${
                showFilters || hasFilters
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
                />
              </svg>
              Filters
              {hasFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">City</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">All cities</option>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">Min rent</label>
                  <input
                    type="number"
                    placeholder="$0"
                    value={minRent}
                    onChange={(e) => setMinRent(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">Max rent</label>
                  <input
                    type="number"
                    placeholder="No limit"
                    value={maxRent}
                    onChange={(e) => setMaxRent(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">Min bedrooms</label>
                  <select
                    value={minBeds}
                    onChange={(e) => setMinBeds(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">Any</option>
                    <option value="0">Studio+</option>
                    <option value="1">1 bed+</option>
                    <option value="2">2 beds+</option>
                    <option value="3">3 beds+</option>
                  </select>
                </div>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-xs text-white/70 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Results bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-2 bg-white border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              Loading...
            </span>
          ) : (
            <>
              <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "property" : "properties"} ·{" "}
              <span className="font-semibold text-gray-800">{totalFloorplans}</span> floor plans found
            </>
          )}
        </span>
        <span className="text-xs text-gray-400">
          Demo data · {cityFilter ? `${cityFilter}, CA` : "Irvine & Santa Ana, CA"}
        </span>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="shrink-0 px-5 py-2.5 bg-red-50 border-b border-red-100 text-sm text-red-600 flex items-center gap-2">
          <span>⚠</span> {error}
        </div>
      )}

      {/* ── Main: Map + Cards ──────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* Map panel */}
        <div className="w-[56%] shrink-0 relative">
          <ListingMap
            properties={filtered}
            selectedId={selectedId}
            onSelect={handleSelectPin}
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md border border-gray-100">
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-600 inline-block" />
                Apartments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 inline-block" />
                Zillow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-red-600 inline-block" />
                Redfin
              </span>
            </div>
          </div>
        </div>

        {/* Cards panel */}
        <div
          ref={cardsRef}
          className="flex-1 overflow-y-auto min-w-0 px-4 py-4 space-y-4 bg-gray-50"
        >
          {/* Loading skeletons */}
          {loading &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-8 bg-gray-100 rounded-xl mt-4" />
                </div>
              </div>
            ))}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-4">
                🏠
              </div>
              <p className="font-semibold text-gray-700">No listings found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your search or{" "}
                <button
                  type="button"
                  className="underline text-blue-500 hover:text-blue-600"
                  onClick={clearFilters}
                >
                  clearing filters
                </button>
              </p>
            </div>
          )}

          {/* Property cards */}
          {!loading &&
            filtered.map((p) => (
              <div key={p.id} id={`card-${p.id}`}>
                <PropertyCard
                  property={p}
                  isSelected={selectedId === p.id}
                  onClick={() =>
                    setSelectedId((prev) => (prev === p.id ? null : p.id))
                  }
                  onSaveToBlend={(id) => setBlendPropertyId(id)}
                />
              </div>
            ))}
        </div>
      </main>

      {/* Add to Blend modal */}
      <AddToBlendModal
        propertyId={blendPropertyId}
        onClose={() => setBlendPropertyId(null)}
      />
    </div>
  );
}
