import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProperties } from "../hooks/useProperties";
import { useBlends, addPropertyToBlend } from "../hooks/useBlends";
import { useAuth } from "../context/AuthContext";
import ListingMap from "../components/ListingMap";
import PropertyCard from "../components/PropertyCard";
import AddToBlendModal from "../components/AddToBlendModal";
import RoomsPanel from "../components/RoomsPanel";

const PROPERTY_TYPES = ["All", "Apartment", "Condo", "Townhome", "Single Family"] as const;

function deriveType(name: string, raw: Record<string, unknown>): string {
  if (raw.property_type) return raw.property_type as string;
  const n = name.toLowerCase();
  if (n.includes("townhome") || n.includes("townhouse")) return "Townhome";
  if (n.includes("condo") || n.includes("condominium")) return "Condo";
  if (n.includes("single family") || n.includes("house")) return "Single Family";
  return "Apartment";
}

export default function Home() {
  const navigate = useNavigate();
  const { properties, loading, error } = useProperties();
  const { user, authLoading, signOut, openAuthModal } = useAuth();
  const { blends, loading: blendsLoading } = useBlends();

  const [search,       setSearch]       = useState("");
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [typeFilter,   setTypeFilter]   = useState<string>("All");
  const [maxRent,      setMaxRent]      = useState(5000);
  const [roomsFilter,  setRoomsFilter]  = useState<number | "">("");
  const [savedOpen,    setSavedOpen]    = useState(false);
  const [newBlendName, setNewBlendName] = useState("");
  const [joinCode,     setJoinCode]     = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Drag-and-drop state
  const [dragPropertyId,    setDragPropertyId]    = useState<string | null>(null);
  const [dragOverBlendId,   setDragOverBlendId]   = useState<string | null>(null);
  const [dropSuccessId,     setDropSuccessId]     = useState<string | null>(null);
  const [dragOverNewBlend,  setDragOverNewBlend]  = useState(false);
  const [creatingFromDrop,  setCreatingFromDrop]  = useState(false);

  const cardsRef = useRef<HTMLDivElement>(null);
  const [blendPropertyId, setBlendPropertyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const raw = p.raw as Record<string, unknown>;
        const addr = ((raw.address as string) ?? "").toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q) && !addr.includes(q))
          return false;
      }

      if (typeFilter !== "All") {
        const t = deriveType(p.name, p.raw as Record<string, unknown>);
        if (t !== typeFilter) return false;
      }

      const cheapest = p.floorplans?.slice().sort((a, b) => a.rent - b.rent)[0];
      if (cheapest) {
        if (cheapest.rent > maxRent) return false;
        if (roomsFilter !== "" && cheapest.beds < roomsFilter) return false;
      }

      return true;
    });
  }, [properties, search, typeFilter, maxRent, roomsFilter]);

  function handleSelectPin(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
    const el = document.getElementById(`card-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleDragStart(e: React.DragEvent, propertyId: string) {
    if (!user) { e.preventDefault(); openAuthModal(); return; }
    // Set dataTransfer synchronously — required during the event
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("propertyId", propertyId);
    // Defer all setState to avoid re-render cancelling the drag
    setTimeout(() => {
      setDragPropertyId(propertyId);
      setSavedOpen(true);
    }, 0);
  }

  function handleDragEnd() {
    setDragPropertyId(null);
    setDragOverBlendId(null);
    setSavedOpen(false);
  }

  async function handleDropOnBlend(blendId: string) {
    if (!dragPropertyId || !user) return;
    setDragOverBlendId(null);
    const { error } = await addPropertyToBlend(blendId, dragPropertyId, user.id);
    if (!error) {
      setDropSuccessId(blendId);
      setTimeout(() => { setDropSuccessId(null); setSavedOpen(false); }, 1400);
    }
    setDragPropertyId(null);
  }

  async function handleDropCreateBlend() {
    if (!dragPropertyId || !user) return;
    setDragOverNewBlend(false);
    setCreatingFromDrop(true);
    const propName = properties.find((p) => p.id === dragPropertyId)?.name ?? "New Room";
    const roomName = `${propName.split(" ").slice(0, 2).join(" ")} Room`;
    const { createBlend: cb } = await import("../hooks/useBlends");
    const { id: newBlendId, error: createErr } = await cb(roomName);
    if (!createErr && newBlendId) {
      await addPropertyToBlend(newBlendId, dragPropertyId, user.id);
      setCreatingFromDrop(false);
      setDragPropertyId(null);
      setSavedOpen(false);
      navigate(`/blend/${newBlendId}`);
    } else {
      setCreatingFromDrop(false);
      setDragPropertyId(null);
    }
  }

  async function handleCreateRoom() {
    if (!newBlendName.trim() || !user) return;
    setRoomsLoading(true);
    const { createBlend: cb } = await import("../hooks/useBlends");
    await cb(newBlendName.trim());
    setNewBlendName("");
    setRoomsLoading(false);
  }

  async function handleJoinRoom() {
    if (!joinCode.trim() || !user) return;
    setRoomsLoading(true);
    const { requestJoinBlend } = await import("../hooks/useBlends");
    await requestJoinBlend(joinCode.trim());
    setJoinCode("");
    setRoomsLoading(false);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FFF2E1]">

      {/* ═══════════════════════════════════════════════════════════════════════
          NAV BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="shrink-0 h-12 bg-white border-b border-[#e8d5b7] flex items-center px-5 gap-3 z-30">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-1.5 font-bold text-stone-900 text-[15px] shrink-0 hover:opacity-80 transition-opacity"
        >
          <span className="w-6 h-6 bg-[#A67C52] rounded-md flex items-center justify-center text-white">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </span>
          HomeBlend
        </Link>

        {/* Discover / Saved toggle */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            type="button"
            onClick={() => setSavedOpen(false)}
            className={`px-3.5 py-1 rounded-full text-[13px] font-semibold transition-colors ${
              !savedOpen ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-[#FFF2E1]"
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => { if (!user) { openAuthModal(); return; } setSavedOpen((v) => !v); }}
            className={`px-3.5 py-1 rounded-full text-[13px] font-semibold transition-colors ${
              savedOpen ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800 hover:bg-[#FFF2E1]"
            }`}
          >
            Saved
          </button>
        </div>

        <div className="flex-1" />

        {/* Rent slider */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <span className="text-[13px] text-stone-600 font-medium whitespace-nowrap">
            Up to <span className="font-bold text-stone-900">${maxRent.toLocaleString()}</span>
          </span>
          <input
            type="range" min={1000} max={10000} step={100} value={maxRent}
            onChange={(e) => setMaxRent(Number(e.target.value))}
            className="w-28 h-1 rounded-full appearance-none cursor-pointer accent-[#A67C52]"
            style={{ background: `linear-gradient(to right, #A67C52 ${((maxRent - 1000) / 9000) * 100}%, #d6d3d1 ${((maxRent - 1000) / 9000) * 100}%)` }}
          />
        </div>

        {/* Rooms button */}
        {authLoading ? (
          <div className="w-20 h-8 rounded-xl bg-[#FFF2E1] animate-pulse shrink-0" />
        ) : (
          <button
            type="button"
            onClick={() => { if (!user) { openAuthModal(); return; } setSavedOpen((v) => !v); }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e8d5b7] bg-white hover:bg-[#FFF2E1] transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-[#A67C52]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-[13px] font-medium text-stone-700">Rooms</span>
            {user && blends.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#A67C52] text-white text-[10px] font-bold flex items-center justify-center">
                {blends.length}
              </span>
            )}
          </button>
        )}

        {/* Help / ? */}
        <button
          type="button"
          onClick={() => !user && openAuthModal()}
          className="w-8 h-8 rounded-full border border-[#e8d5b7] bg-white text-stone-500 text-sm font-semibold flex items-center justify-center hover:bg-[#FFF2E1] transition-colors shrink-0"
        >
          ?
        </button>

        {/* Sign in / Sign out */}
        {authLoading ? null : user ? (
          <button
            type="button"
            onClick={() => signOut()}
            className="shrink-0 text-[13px] font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="shrink-0 text-[13px] font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Sign in
          </button>
        )}
      </nav>

      {/* ── Filter pills (full width) ── */}
      <div className="shrink-0 bg-white border-b border-[#e8d5b7] px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {PROPERTY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-px rounded-full text-[11px] font-medium whitespace-nowrap transition-colors border ${
              typeFilter === t
                ? "bg-[#3D2B1F] text-white border-[#3D2B1F]"
                : "bg-white text-stone-500 border-[#d4c4ae] hover:border-[#A67C52] hover:text-stone-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Property count (full width) ── */}
      <div className="shrink-0 bg-white border-b border-[#e8d5b7] px-4 py-1.5">
        {loading ? (
          <span className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-[#A67C52] border-t-transparent animate-spin" />
            Loading…
          </span>
        ) : (
          <span className="text-[12px]">
            <span className="font-semibold text-stone-800">{filtered.length}</span>{" "}
            <span className="text-stone-400">{filtered.length === 1 ? "property" : "properties"}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 border-b border-red-100 text-[11px] text-red-600 flex items-center gap-1.5">
          <span>⚠</span> {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN: Cards (left) + Map (right)
          ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* Cards panel (left) — scrollable list only */}
        <div className="w-[27%] shrink-0 flex flex-col border-r border-[#e8d5b7]">
          <div
            ref={cardsRef}
            className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3 bg-[#FFF2E1]"
          >
          {loading &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border border-[#e8d5b7]">
                <div className="h-48 bg-[#f0dfc0]" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-[#f0dfc0] rounded w-1/3" />
                  <div className="h-4 bg-[#f0dfc0] rounded w-2/3" />
                  <div className="h-3 bg-[#f0dfc0] rounded w-full" />
                </div>
              </div>
            ))}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl mb-3">🏠</div>
              <p className="font-semibold text-stone-700">No listings found</p>
              <p className="text-sm text-stone-400 mt-1">
                Try adjusting filters or{" "}
                <button
                  type="button"
                  className="underline text-[#A67C52] hover:text-[#8B6843]"
                  onClick={() => { setTypeFilter("All"); setMaxRent(5000); setRoomsFilter(""); setSearch(""); }}
                >
                  clearing them
                </button>
              </p>
            </div>
          )}

          {!loading &&
            filtered.map((p) => (
              <div
                key={p.id}
                id={`card-${p.id}`}
                draggable={!!user}
                onDragStart={(e) => handleDragStart(e, p.id)}
                onDragEnd={handleDragEnd}
                className={`select-none transition-opacity duration-150 ${
                  dragPropertyId && dragPropertyId !== p.id ? "opacity-50" : ""
                } ${dragPropertyId === p.id ? "opacity-70 scale-95 cursor-grabbing" : "cursor-grab"}`}
              >
                <PropertyCard
                  property={p}
                  isSelected={selectedId === p.id}
                  onClick={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                  onSaveToBlend={(id) => setBlendPropertyId(id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Map panel (right) */}
        <div className="flex-1 relative">
          <ListingMap
            properties={filtered}
            selectedId={selectedId}
            onSelect={handleSelectPin}
          />

        </div>

        {/* ── Your Rooms panel ── */}
        {savedOpen && (
          <RoomsPanel
            blends={blends}
            blendsLoading={blendsLoading}
            dragPropertyId={dragPropertyId}
            dragOverBlendId={dragOverBlendId}
            dropSuccessId={dropSuccessId}
            dragOverNewBlend={dragOverNewBlend}
            creatingFromDrop={creatingFromDrop}
            newBlendName={newBlendName}
            joinCode={joinCode}
            roomsLoading={roomsLoading}
            onClose={() => setSavedOpen(false)}
            onSetDragOverBlendId={setDragOverBlendId}
            onSetDragOverNewBlend={setDragOverNewBlend}
            onDropOnBlend={handleDropOnBlend}
            onDropCreateBlend={handleDropCreateBlend}
            onSetNewBlendName={setNewBlendName}
            onSetJoinCode={setJoinCode}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}
      </main>

      {/* ── Floating rooms button (bottom-right) ── */}
      <button
        type="button"
        onClick={() => { if (!user) { openAuthModal(); return; } setSavedOpen((v) => !v); }}
        className={`
          fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl
          transition-all duration-200 hover:scale-105 active:scale-95
          ${savedOpen
            ? "bg-[#3D2B1F] text-white shadow-2xl"
            : "bg-white border border-[#e8d5b7] text-stone-700 hover:bg-[#FFF2E1] hover:border-[#A67C52]"
          }
        `}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
        </svg>
        <span className="text-sm font-semibold">Rooms</span>
        {user && blends.length > 0 && (
          <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
            savedOpen ? "bg-white text-[#3D2B1F]" : "bg-[#A67C52] text-white"
          }`}>
            {blends.length}
          </span>
        )}
      </button>

      {/* Add to Blend modal */}
      <AddToBlendModal
        propertyId={blendPropertyId}
        onClose={() => setBlendPropertyId(null)}
      />

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
