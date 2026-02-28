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
      {/* Image strip */}
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
        <p className="text-xs text-gray-400 mt-1">
          {propertyCount} {propertyCount === 1 ? "property" : "properties"} · {memberCount}{" "}
          {memberCount === 1 ? "member" : "members"}
        </p>
        <span className="inline-block mt-2 text-xs font-mono bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100">
          {blend.invite_code}
        </span>
      </div>
    </button>
  );
}

function ShareModal({
  blend,
  onClose,
}: {
  blend: BlendWithDetails;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/blend/join/${blend.invite_code}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">Share "{blend.name}"</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Invite code</p>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="flex-1 font-mono text-2xl font-bold tracking-widest text-gray-800 text-center">
              {blend.invite_code}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Or share link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Anyone with this code can join and view your blend
        </p>
      </div>
    </div>
  );
}

function BlendDetailView({
  blend,
  userId,
  onBack,
  onChanged,
}: {
  blend: BlendWithDetails;
  userId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [showShare,   setShowShare]   = useState(false);
  const [removing,    setRemoving]    = useState<string | null>(null);

  async function handleRemove(propertyId: string) {
    setRemoving(propertyId);
    await removePropertyFromBlend(blend.id, propertyId);
    setRemoving(null);
    onChanged();
  }

  const properties = (blend.blend_properties ?? []).map((bp) => bp.properties);

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Detail header */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{blend.name}</h2>
            <p className="text-xs text-gray-400">
              {properties.length} {properties.length === 1 ? "property" : "properties"} ·{" "}
              {blend.blend_members?.length ?? 0} members
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>

        {/* Properties grid + Members sidebar */}
        <div className="flex-1 overflow-hidden flex">
          {/* Properties */}
          <div className="flex-1 overflow-y-auto p-5">
            {properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-4">🏡</div>
                <p className="font-semibold text-gray-700">No properties yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Head to Discover and tap the bookmark on any listing
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {properties.map((property) => {
                  if (!property) return null;
                  const p = property as PropertyWithFloorplans;
                  const raw = p.raw as Record<string, unknown>;
                  const imageUrl = (raw.image_url as string | undefined) ??
                    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80";
                  const cheapest = p.floorplans?.slice().sort((a, b) => a.rent - b.rent)[0];

                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      <div className="relative h-36 overflow-hidden bg-gray-100">
                        <img src={imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        <button
                          type="button"
                          disabled={removing === p.id}
                          onClick={() => handleRemove(p.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                          title="Remove from blend"
                        >
                          {removing === p.id ? (
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-gray-800 text-sm leading-snug">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.city}, {p.state}</p>
                        {cheapest && (
                          <p className="text-sm font-bold text-gray-900 mt-1.5">
                            ${cheapest.rent.toLocaleString()}/mo{" "}
                            <span className="text-xs font-normal text-gray-400">
                              · {cheapest.beds === 0 ? "Studio" : `${cheapest.beds}bd`}/{cheapest.baths}ba
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members sidebar */}
          <div className="hidden lg:flex w-56 shrink-0 border-l border-gray-100 bg-white flex-col">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Members</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {blend.blend_members?.map((member) => (
                <div key={member.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {member.user_id === userId ? "You" : member.user_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {member.user_id === userId ? "You" : `Member`}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showShare && (
        <ShareModal blend={blend} onClose={() => setShowShare(false)} />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Blend() {
  const { user, authLoading } = useAuth();
  const { blends, loading, error, reload } = useBlends();

  const [view,          setView]          = useState<View>("list");
  const [activeBlend,   setActiveBlend]   = useState<BlendWithDetails | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [newName,       setNewName]       = useState("");
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState<string | null>(null);
  const [joinCode,      setJoinCode]      = useState("");
  const [joining,       setJoining]       = useState(false);
  const [joinError,     setJoinError]     = useState<string | null>(null);

  if (!authLoading && !user) return <Navigate to="/" replace />;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { error: err } = await createBlend(newName.trim(), user.id);
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
    const { blendId, error: err } = await joinBlendByCode(joinCode.trim(), user.id);
    setJoining(false);
    if (err || !blendId) { setJoinError(err ?? "Not found"); return; }
    setJoinCode("");
    reload();
  }

  function openDetail(blend: BlendWithDetails) {
    setActiveBlend(blend);
    setView("detail");
  }

  function handleBack() {
    setView("list");
    setActiveBlend(null);
    reload();
  }

  // Sync active blend after reload
  const currentBlend = activeBlend
    ? blends.find((b) => b.id === activeBlend.id) ?? activeBlend
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <NavBar />

      {view === "detail" && currentBlend && user ? (
        <BlendDetailView
          blend={currentBlend}
          userId={user.id}
          onBack={handleBack}
          onChanged={reload}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Page header */}
          <div className="bg-white border-b border-gray-100 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Blends</h1>
                <p className="text-sm text-gray-400 mt-0.5">Shared albums of properties you love</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Blend
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Blend grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="h-32 bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : blends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-4xl mb-5">
                  📦
                </div>
                <p className="font-bold text-gray-800 text-lg">No blends yet</p>
                <p className="text-gray-400 text-sm mt-1 max-w-xs">
                  Create a blend to start saving and sharing properties with roommates, partners, or friends.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  Create your first Blend
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {blends.map((b) => (
                  <BlendCard key={b.id} blend={b} onClick={() => openDetail(b)} />
                ))}
              </div>
            )}

            {/* Join a blend */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Join a Blend</h3>
              <p className="text-sm text-gray-400 mb-3">Enter an invite code from someone else's blend</p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ABC12345"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
                <button
                  type="submit"
                  disabled={!joinCode.trim() || joining}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {joining && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Join
                </button>
              </form>
              {joinError && <p className="text-xs text-red-500 mt-2">{joinError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create blend modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-lg">New Blend</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Blend name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder='e.g. "Dream Apartments", "Irvine Search"'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creating && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Create Blend
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
