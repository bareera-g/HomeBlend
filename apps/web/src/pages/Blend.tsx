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
import { supabase } from "../lib/supabase";

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

// ─── Recommended property card ────────────────────────────────────────────────

function RecommendedPropertyCard({
  property,
  reasons,
}: {
  property: PropertyWithFloorplans;
  reasons: string[];
}) {
  const imageUrl  = (property.raw as Record<string, unknown>)?.image_url as string | undefined;
  const address   = (property.raw as Record<string, unknown>)?.address as string | undefined;
  const minRent   = property.floorplans.length > 0
    ? Math.min(...property.floorplans.map((f) => f.rent))
    : null;
  const maxRent   = property.floorplans.length > 0
    ? Math.max(...property.floorplans.map((f) => f.rent))
    : null;
  const bedSet    = [...new Set(property.floorplans.map((f) => f.beds))].sort((a, b) => a - b);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Image strip */}
      <div className="h-28 bg-gray-100 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>
        )}
        {/* "Recommended" badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold shadow">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          For you
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {/* Name + location */}
        <div>
          <p className="text-sm font-bold text-gray-900 truncate">{property.name}</p>
          <p className="text-xs text-gray-400 truncate">{address ?? `${property.city}, ${property.state}`}</p>
        </div>

        {/* Rent + beds */}
        <div className="flex items-center gap-2 flex-wrap">
          {minRent !== null && (
            <span className="text-xs font-semibold text-gray-700">
              ${minRent.toLocaleString()}{maxRent !== minRent ? `–$${maxRent!.toLocaleString()}` : ""}/mo
            </span>
          )}
          {bedSet.length > 0 && (
            <span className="text-xs text-gray-400">{bedSet.join(", ")} bd</span>
          )}
        </div>

        {/* Match reasons */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {reasons.map((r, i) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-xs font-medium">
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
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

  // Build a quick property-id → name lookup from blend data
  const propertyNameMap = new Map<string, string>();
  for (const bp of blend.blend_properties ?? []) {
    propertyNameMap.set(bp.property_id, bp.properties.name);
  }

  // Per-member stats derived from votes, including which properties they liked/disliked
  const memberMap = new Map<string, {
    email: string | null;
    likes: number;
    dislikes: number;
    likedProps: string[];    // property names
    dislikedProps: string[]; // property names
  }>();
  for (const v of votes) {
    const m = memberMap.get(v.user_id) ?? {
      email: v.email,
      likes: 0,
      dislikes: 0,
      likedProps: [],
      dislikedProps: [],
    };
    const propName = propertyNameMap.get(v.property_id) ?? "Unknown property";
    if (v.vote === "like") {
      m.likes += 1;
      m.likedProps.push(propName);
    } else {
      m.dislikes += 1;
      m.dislikedProps.push(propName);
    }
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
              const total   = m.likes + m.dislikes;
              const likePct = total > 0 ? m.likes / total : 0;
              return (
                <div key={uid} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2.5">
                  {/* ── Top row: avatar + name + bar ── */}
                  <div className="flex items-center gap-3">
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

                  {/* ── Liked properties ── */}
                  {m.likedProps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Liked
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {m.likedProps.map((name, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium truncate max-w-[160px]"
                            title={name}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Disliked properties ── */}
                  {m.dislikedProps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                        Passed
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {m.dislikedProps.map((name, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full text-xs font-medium truncate max-w-[160px]"
                            title={name}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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

// ─── AI Analysis Banner ────────────────────────────────────────────────────────

function AIAnalysisBanner({
  blend,
  votes,
}: {
  blend: BlendWithDetails;
  votes: BlendPropertyVoteRow[];
}) {
  const [open,     setOpen]     = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const props   = blend.blend_properties ?? [];
  const members = blend.blend_members ?? [];

  function generateAnalysis() {
    setLoading(true);
    setAnalysis(null);

    const totalVotes = votes.length;
    const scored = props.map((bp) => {
      const v = votes.filter((v) => v.property_id === bp.property_id);
      return { name: bp.properties.name, score: v.filter((x) => x.vote === "like").length - v.filter((x) => x.vote === "dislike").length };
    }).sort((a, b) => b.score - a.score);
    const top       = scored[0];
    const likes     = votes.filter((v) => v.vote === "like").length;
    const consensus = totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : null;
    const rents     = props.flatMap((bp) => bp.properties.floorplans.map((f) => f.rent));
    const avgRent   = rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;

    setTimeout(() => {
      let text = "";
      if (props.length === 0) {
        text = "No properties have been added yet. Start by saving listings from the Discover page.";
      } else if (totalVotes === 0) {
        text = `This blend has ${props.length} propert${props.length === 1 ? "y" : "ies"} and ${members.length} member${members.length === 1 ? "" : "s"}, but no votes have been cast yet. Encourage members to like or pass on listings to generate a recommendation.`;
      } else {
        const parts: string[] = [];
        if (top && top.score > 0) parts.push(`The group is leaning towards **${top.name}** with a score of +${top.score}.`);
        else if (top && top.score < 0) parts.push(`No clear favourite yet — the top-ranked property has a score of ${top.score}.`);
        else parts.push(`The group is split — votes are tied across properties.`);
        if (consensus !== null) parts.push(`${consensus}% of all votes are positive, indicating ${consensus >= 60 ? "strong" : consensus >= 40 ? "moderate" : "low"} group enthusiasm.`);
        if (avgRent !== null) parts.push(`The average rent across all floor plans is $${avgRent.toLocaleString()}/mo.`);
        if (members.length > 1) parts.push(`With ${members.length} members voting, this blend has good coverage for a group decision.`);
        text = parts.join(" ");
      }
      setAnalysis(text);
      setLoading(false);
    }, 900);
  }

  if (!open) return null;

  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-violet-100">
        <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-violet-800">AI Analysis</p>
          <p className="text-xs text-violet-400">Temporary placeholder</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={generateAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {loading
              ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
            {analysis ? "Regenerate" : "Analyse"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-6 h-6 rounded-full hover:bg-violet-100 flex items-center justify-center text-violet-400 transition-colors text-sm leading-none"
          >
            ×
          </button>
        </div>
      </div>
      <div className="px-4 py-3 flex-1 flex items-start">
        {loading ? (
          <div className="flex items-center gap-2 text-violet-400 text-xs">
            <span className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin shrink-0" />
            Analysing blend data…
          </div>
        ) : analysis ? (
          <p className="text-xs text-violet-900 leading-relaxed">
            {analysis.split("**").map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </p>
        ) : (
          <p className="text-xs text-violet-400 italic">
            Click "Analyse" to generate an AI summary of this blend.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Conflict Analysis Banner ──────────────────────────────────────────────────

function ConflictAnalysisBanner({
  blend,
  votes,
}: {
  blend: BlendWithDetails;
  votes: BlendPropertyVoteRow[];
}) {
  const [open, setOpen] = useState(true);

  const props = blend.blend_properties ?? [];

  const conflictData = props
    .map((bp) => {
      const propVotes = votes.filter((v) => v.property_id === bp.property_id);
      const likers    = propVotes.filter((v) => v.vote === "like");
      const dislikers = propVotes.filter((v) => v.vote === "dislike");
      const conflict  = Math.min(likers.length, dislikers.length);
      return { bp, likers, dislikers, conflict };
    })
    .filter((d) => d.conflict > 0)
    .sort((a, b) => b.conflict - a.conflict);

  if (!open) return null;

  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-rose-100">
        <div className="w-6 h-6 rounded-lg bg-rose-500 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
            Conflict Analysis
            {conflictData.length > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full text-xs font-bold leading-none">
                {conflictData.length}
              </span>
            )}
          </p>
          <p className="text-xs text-rose-400">Properties with opposing votes</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-6 h-6 rounded-full hover:bg-rose-100 flex items-center justify-center text-rose-400 transition-colors text-sm leading-none shrink-0"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 flex-1">
        {votes.length === 0 ? (
          <p className="text-xs text-rose-300 italic">No votes yet — cast some votes to detect conflicts.</p>
        ) : conflictData.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No conflicts — the group is aligned on all properties.
          </div>
        ) : (
          <div className="space-y-3">
            {conflictData.map(({ bp, likers, dislikers, conflict }) => (
              <div key={bp.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-800 truncate flex-1 mr-2">{bp.properties.name}</p>
                  <span className="text-xs font-bold text-rose-500 shrink-0">
                    {conflict} conflict{conflict > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {likers.map((v) => (
                      <VoterAvatar key={v.id} label={(v.email?.[0] ?? "?").toUpperCase()} title={v.email ?? v.user_id} color="green" />
                    ))}
                  </div>
                  <span className="text-gray-300 text-xs">vs</span>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    {dislikers.map((v) => (
                      <VoterAvatar key={v.id} label={(v.email?.[0] ?? "?").toUpperCase()} title={v.email ?? v.user_id} color="red" />
                    ))}
                  </div>
                  <div className="flex-1 h-1 rounded-full overflow-hidden bg-gray-100 flex ml-1">
                    <div className="bg-emerald-400 h-full" style={{ width: `${(likers.length / (likers.length + dislikers.length)) * 100}%` }} />
                    <div className="bg-red-300 h-full" style={{ width: `${(dislikers.length / (likers.length + dislikers.length)) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [shareOpen,        setShareOpen]        = useState(false);
  const [removing,         setRemoving]         = useState<string | null>(null);
  const [responding,       setResponding]       = useState<string | null>(null);
  const [leaderboardTab,   setLeaderboardTab]   = useState<"blend" | "recommended">("blend");
  const [recommended,      setRecommended]      = useState<{ property: PropertyWithFloorplans; reasons: string[] }[]>([]);
  const [recsLoading,      setRecsLoading]      = useState(false);
  const [recsFetched,      setRecsFetched]      = useState(false);
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

  // Properties this user has not yet voted on
  const votedPropertyIds = new Set(
    (blend.blend_property_votes ?? [])
      .filter((v) => v.user_id === userId)
      .map((v) => v.property_id)
  );
  const unvotedCount = (blend.blend_properties ?? []).filter(
    (bp) => !votedPropertyIds.has(bp.property_id)
  ).length;

  // Fetch and score recommendations when that tab is first opened
  useEffect(() => {
    if (leaderboardTab !== "recommended" || recsFetched) return;

    const blendProps = blend.blend_properties ?? [];
    if (blendProps.length === 0) {
      setRecsFetched(true);
      return;
    }

    setRecsLoading(true);

    // Build a profile from the existing blend properties
    const allFloorplans  = blendProps.flatMap((bp) => bp.properties.floorplans);
    const avgRent        = allFloorplans.length > 0
      ? allFloorplans.reduce((s, f) => s + f.rent, 0) / allFloorplans.length
      : 0;
    const cityFreq       = new Map<string, number>();
    blendProps.forEach((bp) => cityFreq.set(bp.properties.city, (cityFreq.get(bp.properties.city) ?? 0) + 1));
    const topCity        = [...cityFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    const bedFreq        = new Map<number, number>();
    allFloorplans.forEach((f) => bedFreq.set(f.beds, (bedFreq.get(f.beds) ?? 0) + 1));
    const topBeds        = [...bedFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
    const existingIds    = new Set(blendProps.map((bp) => bp.property_id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("properties")
      .select("*, floorplans(*)")
      .eq("status", "active")
      .then(({ data }: { data: PropertyWithFloorplans[] | null }) => {
        const candidates = (data ?? []).filter((p) => !existingIds.has(p.id));

        const scored = candidates.map((p) => {
          const reasons: string[] = [];
          let score = 0;

          if (p.city === topCity) { score += 3; reasons.push("Same city"); }

          const pAvgRent = p.floorplans.length > 0
            ? p.floorplans.reduce((s, f) => s + f.rent, 0) / p.floorplans.length
            : 0;
          if (avgRent > 0 && pAvgRent > 0 && Math.abs(pAvgRent - avgRent) / avgRent <= 0.20) {
            score += 2; reasons.push("Similar rent");
          }

          if (p.floorplans.some((f) => f.beds === topBeds)) {
            score += 2; reasons.push(`${topBeds} bd match`);
          }

          return { property: p, reasons, score };
        });

        const top = scored
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map(({ property, reasons }) => ({ property, reasons }));

        setRecommended(top);
        setRecsLoading(false);
        setRecsFetched(true);
      });
  }, [leaderboardTab, recsFetched, blend.blend_properties]);

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

      {/* ── Unvoted prompt ── */}
      {unvotedCount > 0 && (
        <div className="shrink-0 mx-5 mt-3">
          <button
            type="button"
            disabled
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-default select-none shadow-sm"
          >
            {/* Swipe icon */}
            <div className="shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-bold leading-tight">
                {unvotedCount} propert{unvotedCount === 1 ? "y" : "ies"} waiting for your vote
              </p>
              <p className="text-xs text-blue-200 mt-0.5">Swipe through listings to share your opinion</p>
            </div>
            {/* Animated chevrons suggesting swipe */}
            <div className="shrink-0 flex items-center gap-0.5 opacity-70">
              {[0, 1, 2].map((i) => (
                <svg
                  key={i}
                  className="w-4 h-4 text-white"
                  style={{ opacity: 0.4 + i * 0.3 }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              ))}
            </div>
          </button>
        </div>
      )}

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

      {/* ── Analysis banners ── */}
      <div className="shrink-0 mx-5 mt-3 mb-1 flex gap-3">
        <AIAnalysisBanner blend={blend} votes={optimisticVotes} />
        <ConflictAnalysisBanner blend={blend} votes={optimisticVotes} />
      </div>

      {/* ── Two-column body: properties left, insights right ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left — leaderboard / recommendations */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Tab bar */}
          <div className="shrink-0 px-5 pt-4 pb-0 flex items-center gap-1 border-b border-gray-100">
            {([
              { id: "blend",       label: "In Blend",       count: blend.blend_properties?.length ?? 0 },
              { id: "recommended", label: "Recommended",    count: null },
            ] as const).map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeaderboardTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  leaderboardTab === id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {label}
                {count !== null && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${leaderboardTab === id ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                    {count}
                  </span>
                )}
                {id === "recommended" && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-600">
                    ✦
                  </span>
                )}
              </button>
            ))}
            {/* Member avatars pushed to the right */}
            {(blend.blend_members?.length ?? 0) > 0 && leaderboardTab === "blend" && (
              <span className="ml-auto mb-1 flex items-center gap-1">
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
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

            {/* ── In Blend tab ── */}
            {leaderboardTab === "blend" && (
              (blend.blend_properties?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-3">🏠</div>
                  <p className="text-sm font-semibold text-gray-700">No properties yet</p>
                  <p className="text-xs text-gray-400 mt-1">Go to Discover and save properties here.</p>
                </div>
              ) : (
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
              )
            )}

            {/* ── Recommended tab ── */}
            {leaderboardTab === "recommended" && (
              recsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Finding similar properties…</p>
                </div>
              ) : recommended.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-3">🔍</div>
                  <p className="text-sm font-semibold text-gray-700">No recommendations yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add more properties to the blend to unlock suggestions.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400">
                    Based on properties already in this blend — same city, similar rent & bed count.
                  </p>
                  {recommended.map(({ property, reasons }) => (
                    <RecommendedPropertyCard
                      key={property.id}
                      property={property}
                      reasons={reasons}
                    />
                  ))}
                </>
              )
            )}
          </div>
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
