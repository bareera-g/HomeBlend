import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  useBlends,
  createBlend,
  removePropertyFromBlend,
  joinBlendByCode,
} from "../hooks/useBlends";
import type { BlendWithDetails, PropertyWithFloorplans } from "@homeblend/types";
import NavBar from "../components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "detail";

// ─── Sub-components ───────────────────────────────────────────────────────────

function BlendCard({
  blend,
  onClick,
}: {
  blend: BlendWithDetails;
  onClick: () => void;
}) {
  const propertyCount = blend.blend_properties?.length ?? 0;
  const memberCount   = blend.blend_members?.length ?? 0;

  const images = blend.blend_properties
    ?.slice(0, 3)
    .map((bp) => {
      const raw = bp.properties?.raw as Record<string, unknown> | undefined;
      return (raw?.image_url as string | undefined) ?? null;
    })
    .filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
    >
      <div className="h-32 bg-gray-100 flex overflow-hidden">
        {images.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-4xl text-gray-200">🏠</div>
        ) : (
          images.map((src, i) => (
            <div
              key={i}
              className="flex-1 bg-cover bg-center"
              style={{ backgroundImage: `url(${src})` }}
            />
          ))
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {blend.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {propertyCount} {propertyCount === 1 ? "property" : "properties"} ·{" "}
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </p>
        <p className="text-xs text-gray-300 mt-2 font-mono tracking-widest">
          {blend.invite_code}
        </p>
      </div>
    </button>
  );
}

function SavedPropertyCard({
  property,
  onRemove,
  removing,
}: {
  property: PropertyWithFloorplans;
  onRemove: () => void;
  removing: boolean;
}) {
  const raw       = property.raw as Record<string, unknown>;
  const imageUrl  = raw?.image_url as string | undefined;
  const address   = raw?.address as string | undefined;
  const lowestRent = property.floorplans.length > 0
    ? Math.min(...property.floorplans.map((f) => f.rent))
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex">
      <div
        className="w-24 shrink-0 bg-gray-100 bg-cover bg-center"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      />
      <div className="flex-1 p-3 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{property.name}</p>
        {address && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{address}</p>
        )}
        {lowestRent !== null && (
          <p className="text-sm font-bold text-blue-600 mt-1">
            From ${lowestRent.toLocaleString()}/mo
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {property.floorplans.length} floor plan{property.floorplans.length !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="shrink-0 self-start m-2 w-7 h-7 rounded-full bg-gray-50 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors disabled:opacity-50"
        title="Remove from blend"
      >
        {removing ? (
          <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ blend, onClose }: { blend: BlendWithDetails; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(blend.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Share Blend</h3>
            <p className="text-xs text-gray-400 mt-0.5">Invite others to collaborate</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Invite Code</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <span className="flex-1 font-mono text-xl font-bold text-gray-900 tracking-widest text-center">
                {blend.invite_code}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Share this code with friends so they can join this blend.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function BlendDetail({
  blend,
  onBack,
  onReload,
}: {
  blend: BlendWithDetails;
  onBack: () => void;
  onReload: () => void;
}) {
  const [shareOpen,  setShareOpen]  = useState(false);
  const [removing,   setRemoving]   = useState<string | null>(null);

  async function handleRemove(propertyId: string, blendId: string) {
    setRemoving(propertyId);
    await removePropertyFromBlend(blendId, propertyId);
    setRemoving(null);
    onReload();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-lg truncate">{blend.name}</h2>
          <p className="text-xs text-gray-400">
            {blend.blend_properties?.length ?? 0} properties ·{" "}
            {blend.blend_members?.length ?? 0} members
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {blend.blend_properties?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-4">🏠</div>
            <p className="text-sm font-semibold text-gray-700">No properties yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Go to Discover and save properties to this blend.
            </p>
          </div>
        ) : (
          blend.blend_properties?.map((bp) => (
            <SavedPropertyCard
              key={bp.id}
              property={bp.properties}
              onRemove={() => handleRemove(bp.property_id, blend.id)}
              removing={removing === bp.property_id}
            />
          ))
        )}
      </div>

      {/* Members strip */}
      {(blend.blend_members?.length ?? 0) > 0 && (
        <div className="shrink-0 px-5 py-3 border-t border-gray-50 flex items-center gap-2">
          <p className="text-xs text-gray-400 mr-1">Members</p>
          {blend.blend_members?.map((m) => (
            <div
              key={m.id}
              title={m.user_id}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold"
            >
              {m.role === "owner" ? "★" : "M"}
            </div>
          ))}
        </div>
      )}

      {shareOpen && <ShareModal blend={blend} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Blend() {
  const { user, authLoading } = useAuth();
  const { blends, loading, reload } = useBlends();

  const [view,        setView]        = useState<View>("list");
  const [activeBlend, setActiveBlend] = useState<BlendWithDetails | null>(null);

  // Create blend modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [newName,      setNewName]      = useState("");
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);

  // Join blend modal
  const [showJoin,  setShowJoin]  = useState(false);
  const [joinCode,  setJoinCode]  = useState("");
  const [joining,   setJoining]   = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (!authLoading && !user) return <Navigate to="/" replace />;

  function openDetail(blend: BlendWithDetails) {
    setActiveBlend(blend);
    setView("detail");
  }

  function handleBack() {
    setView("list");
    setActiveBlend(null);
    reload();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { error: err } = await createBlend(newName.trim());
    setCreating(false);
    if (err) { setCreateError(err); return; }
    setNewName("");
    setShowCreate(false);
    reload();
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    const { error: err } = await joinBlendByCode(joinCode.trim(), user.id);
    setJoining(false);
    if (err) { setJoinError(err); return; }
    setJoinCode("");
    setShowJoin(false);
    reload();
  }

  // ── Detail view ──
  if (view === "detail" && activeBlend) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <NavBar />
        <div className="flex-1 overflow-hidden max-w-2xl mx-auto w-full">
          <BlendDetail blend={activeBlend} onBack={handleBack} onReload={reload} />
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <NavBar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-5 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Blends</h1>
              <p className="text-sm text-gray-400 mt-0.5">Shared property albums</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowJoin(true); setJoinError(null); setJoinCode(""); }}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateError(null); setNewName(""); }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Blend
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-32 bg-gray-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : blends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center text-4xl mb-5">
                🏡
              </div>
              <h2 className="text-lg font-semibold text-gray-800">No blends yet</h2>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">
                Create a blend to start saving and sharing properties with friends.
              </p>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateError(null); setNewName(""); }}
                className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                Create your first blend
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {blends.map((blend) => (
                <BlendCard
                  key={blend.id}
                  blend={blend}
                  onClick={() => openDetail(blend)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Blend Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">New Blend</h3>
                <p className="text-xs text-gray-400 mt-0.5">Create a shared property album</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Irvine Apartments"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating && (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                Create Blend
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Blend Modal */}
      {showJoin && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setShowJoin(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Join a Blend</h3>
                <p className="text-xs text-gray-400 mt-0.5">Enter an invite code</p>
              </div>
              <button
                type="button"
                onClick={() => setShowJoin(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleJoin} className="p-5 space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Invite code (e.g. AB12CD)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
              {joinError && <p className="text-xs text-red-500">{joinError}</p>}
              <button
                type="submit"
                disabled={!joinCode.trim() || joining}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {joining && (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                Join Blend
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
