import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  useBlends,
  createBlend,
  removePropertyFromBlend,
  requestJoinBlend,
  respondToJoinRequest,
  castBlendVote,
} from "../hooks/useBlends";
import type {
  BlendWithDetails,
  BlendPropertyVoteRow,
  PropertyWithFloorplans,
} from "@homeblend/types";
import NavBar from "../components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "list" | "detail";

// ─── Sub-components ───────────────────────────────────────────────────────────

function BlendCard({
  blend,
  userId,
  onClick,
}: {
  blend: BlendWithDetails;
  userId: string;
  onClick: () => void;
}) {
  const propertyCount  = blend.blend_properties?.length ?? 0;
  const memberCount    = blend.blend_members?.length ?? 0;
  const isOwner        = blend.created_by === userId;
  const pendingCount   = isOwner
    ? (blend.blend_join_requests?.filter((r) => r.status === "pending").length ?? 0)
    : 0;

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
      <div className="h-32 bg-gray-100 flex overflow-hidden relative">
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
        {pendingCount > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {pendingCount}
          </div>
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

// ─── Avatar helper ─────────────────────────────────────────────────────────

function VoterAvatar({ label, title, color }: { label: string; title: string; color: "green" | "red" }) {
  return (
    <div
      title={title}
      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        color === "green" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-500"
      }`}
    >
      {label}
    </div>
  );
}

// ─── Property card with voting ─────────────────────────────────────────────

function SavedPropertyCard({
  property,
  votes,
  serverScore,
  userId,
  rank,
  onRemove,
  onVote,
  removing,
  voting,
}: {
  property: PropertyWithFloorplans;
  votes: BlendPropertyVoteRow[];        // optimistic — for button highlight + voter avatars
  serverScore: number;                  // stable server score — for the rank badge
  userId: string;
  rank: number;
  onRemove: () => void;
  onVote: (v: "like" | "dislike") => void;
  removing: boolean;
  voting: boolean;
}) {
  const raw        = property.raw as Record<string, unknown>;
  const imageUrl   = raw?.image_url as string | undefined;
  const address    = raw?.address as string | undefined;
  const lowestRent = property.floorplans.length > 0
    ? Math.min(...property.floorplans.map((f) => f.rent))
    : null;

  const myVote    = votes.find((v) => v.user_id === userId)?.vote ?? null;
  const likers    = votes.filter((v) => v.vote === "like");
  const dislikers = votes.filter((v) => v.vote === "dislike");
  const showScore = serverScore !== 0 || likers.length > 0 || dislikers.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex">
        {/* Rank badge */}
        <div className="shrink-0 flex flex-col items-center justify-center w-9 gap-0.5 pl-2">
          <span className="text-xs font-bold text-gray-300 leading-none">#{rank}</span>
          {showScore && (
            <span className={`text-xs font-bold leading-none ${serverScore > 0 ? "text-emerald-500" : serverScore < 0 ? "text-red-400" : "text-gray-300"}`}>
              {serverScore > 0 ? `+${serverScore}` : serverScore}
            </span>
          )}
        </div>

        <div
          className="w-16 shrink-0 bg-gray-100 bg-cover bg-center"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        />
        <div className="flex-1 p-3 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{property.name}</p>
          {address && <p className="text-xs text-gray-400 truncate mt-0.5">{address}</p>}
          {lowestRent !== null && (
            <p className="text-sm font-bold text-blue-600 mt-1">
              From ${lowestRent.toLocaleString()}/mo
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5 p-2 pt-2.5">
          {/* Remove */}
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="w-6 h-6 rounded-full bg-gray-50 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-300 transition-colors disabled:opacity-50"
            title="Remove from blend"
          >
            {removing ? (
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
          {/* Vote buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={voting}
              onClick={() => onVote("like")}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                myVote === "like"
                  ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                  : "bg-gray-50 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
              }`}
            >
              <svg className="w-3 h-3" fill={myVote === "like" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {likers.length}
            </button>
            <button
              type="button"
              disabled={voting}
              onClick={() => onVote("dislike")}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                myVote === "dislike"
                  ? "bg-red-100 text-red-600 ring-1 ring-red-300"
                  : "bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <svg className="w-3 h-3" fill={myVote === "dislike" ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
              {dislikers.length}
            </button>
          </div>
        </div>
      </div>
      {/* Voter avatar strip */}
      {votes.length > 0 && (
        <div className="px-3 pb-2 flex items-center gap-1">
          {likers.map((v) => (
            <VoterAvatar key={v.id} label={(v.email?.[0] ?? "?").toUpperCase()} title={`${v.email ?? v.user_id} liked`} color="green" />
          ))}
          {likers.length > 0 && dislikers.length > 0 && (
            <span className="text-gray-200 text-xs mx-0.5">·</span>
          )}
          {dislikers.map((v) => (
            <VoterAvatar key={v.id} label={(v.email?.[0] ?? "?").toUpperCase()} title={`${v.email ?? v.user_id} passed`} color="red" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function BlendInsights({
  blend,
  votes,
}: {
  blend: BlendWithDetails;
  votes: BlendPropertyVoteRow[];
}) {
  const hasProperties = (blend.blend_properties?.length ?? 0) > 0;

  // Per-member stats derived from votes
  const memberMap = new Map<string, { email: string | null; likes: number; dislikes: number }>();
  for (const v of votes) {
    const m = memberMap.get(v.user_id) ?? { email: v.email, likes: 0, dislikes: 0 };
    if (v.vote === "like") m.likes += 1;
    else m.dislikes += 1;
    memberMap.set(v.user_id, m);
  }

  if (!hasProperties) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-5">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-3">📊</div>
        <p className="text-sm font-semibold text-gray-700">No data yet</p>
        <p className="text-xs text-gray-400 mt-1">Add properties and start voting to see insights.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-6">

      {/* ── Member Activity ── */}
      {memberMap.size > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Member Activity</h3>
          <div className="space-y-2">
            {Array.from(memberMap.entries()).map(([uid, m]) => {
              const total = m.likes + m.dislikes;
              const likePct = total > 0 ? m.likes / total : 0;
              return (
                <div key={uid} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(m.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.email ?? "Member"}</p>
                    <p className="text-xs text-gray-400">{m.likes} liked · {m.dislikes} passed</p>
                  </div>
                  <div className="shrink-0 w-16">
                    <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-100">
                      <div className="bg-emerald-400 h-full transition-all" style={{ width: `${likePct * 100}%` }} />
                      <div className="bg-red-300 h-full transition-all" style={{ width: `${(1 - likePct) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 text-right mt-0.5">{Math.round(likePct * 100)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  userId,
  onBack,
  onReload,
}: {
  blend: BlendWithDetails;
  userId: string;
  onBack: () => void;
  onReload: () => void;
}) {
  const [shareOpen,      setShareOpen]      = useState(false);
  const [removing,       setRemoving]       = useState<string | null>(null);
  const [responding,     setResponding]     = useState<string | null>(null);
  const [optimisticVotes, setOptimisticVotes] = useState<BlendPropertyVoteRow[]>(
    blend.blend_property_votes ?? []
  );

  const { user } = useAuth();
  const userEmail = user?.email ?? null;

  // Keep optimistic votes in sync after server reloads
  useEffect(() => {
    setOptimisticVotes(blend.blend_property_votes ?? []);
  }, [blend.blend_property_votes]);

  const isOwner         = blend.created_by === userId;
  const pendingRequests = blend.blend_join_requests?.filter((r) => r.status === "pending") ?? [];

  async function handleRemove(propertyId: string) {
    setRemoving(propertyId);
    await removePropertyFromBlend(blend.id, propertyId);
    setRemoving(null);
    onReload();
  }

  function handleVote(propertyId: string, vote: "like" | "dislike") {
    // Apply optimistic update immediately
    setOptimisticVotes((prev) => {
      const existing = prev.find(
        (v) => v.property_id === propertyId && v.user_id === userId
      );
      if (existing?.vote === vote) {
        // Same vote again → toggle off
        return prev.filter((v) => !(v.property_id === propertyId && v.user_id === userId));
      } else if (existing) {
        // Switch vote
        return prev.map((v) =>
          v.property_id === propertyId && v.user_id === userId ? { ...v, vote } : v
        );
      } else {
        // New vote
        return [
          ...prev,
          {
            id: `optimistic-${propertyId}-${Date.now()}`,
            blend_id: blend.id,
            property_id: propertyId,
            user_id: userId,
            email: userEmail,
            vote,
            created_at: new Date().toISOString(),
          } satisfies BlendPropertyVoteRow,
        ];
      }
    });

    // Fire-and-forget API call; reload syncs server state in background
    castBlendVote(blend.id, propertyId, vote).then(({ error }) => {
      if (error) onReload(); // revert on failure by re-syncing from server
      else onReload();
    });
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setResponding(requestId);
    await respondToJoinRequest(requestId, accept);
    setResponding(null);
    onReload();
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
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
          className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>

      {/* ── Join Requests (owner only) ── */}
      {isOwner && pendingRequests.length > 0 && (
        <div className="shrink-0 px-5 py-3 border-b border-amber-100 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {pendingRequests.length} pending {pendingRequests.length === 1 ? "request" : "requests"}
          </p>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(req.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{req.email ?? "Unknown user"}</p>
                  <p className="text-xs text-gray-400">Wants to join</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={responding === req.id}
                    onClick={() => handleRespond(req.id, false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-gray-400 transition-colors disabled:opacity-50"
                    title="Decline"
                  >
                    {responding === req.id
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                  </button>
                  <button
                    type="button"
                    disabled={responding === req.id}
                    onClick={() => handleRespond(req.id, true)}
                    className="w-8 h-8 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-600 flex items-center justify-center transition-colors disabled:opacity-50"
                    title="Accept"
                  >
                    {responding === req.id
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Two-column body: properties left, insights right ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left — property list with voting */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Properties
            {(blend.blend_members?.length ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 normal-case font-normal text-gray-400">
                {blend.blend_members?.map((m) => (
                  <span
                    key={m.id}
                    title={m.user_id}
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 inline-flex items-center justify-center text-white text-xs font-bold"
                  >
                    {m.role === "owner" ? "★" : "M"}
                  </span>
                ))}
              </span>
            )}
          </p>
          {(blend.blend_properties?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-3">🏠</div>
              <p className="text-sm font-semibold text-gray-700">No properties yet</p>
              <p className="text-xs text-gray-400 mt-1">Go to Discover and save properties here.</p>
            </div>
          ) : (
            // Sort order uses server votes only — updates on refresh, not on every click
            [...(blend.blend_properties ?? [])]
              .sort((a, b) => {
                const scoreOf = (bp: typeof a) => {
                  const v = (blend.blend_property_votes ?? []).filter((v) => v.property_id === bp.property_id);
                  return v.filter((x) => x.vote === "like").length - v.filter((x) => x.vote === "dislike").length;
                };
                return scoreOf(b) - scoreOf(a);
              })
              .map((bp, idx) => {
                const sv = (blend.blend_property_votes ?? []).filter((v) => v.property_id === bp.property_id);
                const serverScore = sv.filter((x) => x.vote === "like").length - sv.filter((x) => x.vote === "dislike").length;
                return (
                  <SavedPropertyCard
                    key={bp.id}
                    property={bp.properties}
                    votes={optimisticVotes.filter((v) => v.property_id === bp.property_id)}
                    serverScore={serverScore}
                    userId={userId}
                    rank={idx + 1}
                    onRemove={() => handleRemove(bp.property_id)}
                    onVote={(v) => handleVote(bp.property_id, v)}
                    removing={removing === bp.property_id}
                    voting={false}
                  />
                );
              })
          )}
        </div>

        {/* Divider */}
        <div className="shrink-0 w-px bg-gray-100" />

        {/* Right — insights */}
        <div className="w-72 shrink-0 overflow-y-auto">
          <BlendInsights blend={blend} votes={optimisticVotes} />
        </div>
      </div>

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
  const [joinSent,  setJoinSent]  = useState(false);

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
    const { error: err } = await requestJoinBlend(joinCode.trim());
    setJoining(false);
    if (err) { setJoinError(err); return; }
    setJoinSent(true);
  }

  // ── Detail view ──
  if (view === "detail" && activeBlend) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <NavBar />
        <div className="flex-1 overflow-hidden max-w-5xl mx-auto w-full">
          <BlendDetail blend={activeBlend} userId={user!.id} onBack={handleBack} onReload={reload} />
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
                onClick={() => { setShowJoin(true); setJoinError(null); setJoinCode(""); setJoinSent(false); }}
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
                  userId={user!.id}
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
            {joinSent ? (
              <div className="p-6 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Request sent!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    The blend owner will be notified. You'll be added once they accept.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
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
                Request to Join
              </button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
