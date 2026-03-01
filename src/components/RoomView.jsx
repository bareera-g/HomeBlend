import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PROPERTIES } from "../data/properties.js";
import { B, Icon, IC, LogoMark } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import {
  fetchRoom,
  ensureProfile,
  fetchMembers, joinRoom,
  fetchRoomProperties, addPropertyToRoom, removePropertyFromRoom,
  fetchVotes, recordVote,
  fetchSavedPropertyIds,
  fetchJoinRequests, requestToJoin, respondToJoinRequest,
  subscribeToRoom, unsubscribeFromRoom,
} from "../lib/supabase.js";
import MapPanel           from "./MapPanel.jsx";
import PropertyModal      from "./PropertyModal.jsx";
import BlendPanel         from "./BlendPanel.jsx";
import GroupPicksPanel    from "./GroupPicksPanel.jsx";
import RoomPropertyCard   from "./RoomPropertyCard.jsx";
import AddPropertiesDrawer from "./AddPropertiesDrawer.jsx";

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function RoomView() {
  const { roomCode } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const code = roomCode?.toUpperCase() ?? "";

  const [room,          setRoom]         = useState(null);
  const [profile,       setProfile]      = useState(null);
  const [members,       setMembers]      = useState([]);
  const [roomPropIds,   setRoomPropIds]  = useState([]);
  const [roomPropMeta,  setRoomPropMeta] = useState([]);
  const [votes,         setVotes]        = useState([]);
  const [savedIds,      setSavedIds]     = useState([]);
  const [selected,      setSelected]     = useState(null);
  const [rightTab,      setRightTab]     = useState("map");
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [copied,        setCopied]       = useState(false);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState(null);
  // Join-request flow
  const [joinRequests,  setJoinRequests]  = useState([]);
  const [isMember,      setIsMember]      = useState(false);
  const [requestSent,   setRequestSent]   = useState(false);

  const roomProperties = PROPERTIES.filter(p => roomPropIds.includes(p.id));
  const myVotes = {};
  votes.filter(v => v.user_id === user?.id).forEach(v => { myVotes[v.property_id] = v.vote; });
  const votesFor = propId => votes.filter(v => v.property_id === propId);
  const totalVotes = votes.length;
  const voterCount = new Set(votes.map(v => v.user_id)).size;
  const voteProgress = members.length > 0 ? Math.round((voterCount / members.length) * 100) : 0;
  const isOwner = room?.created_by === user?.id;

  // ── Load room ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function init() {
      setLoading(true);
      try {
        const p = await ensureProfile(user.id, user.email?.split("@")[0]);
        setProfile(p);

        const roomData = await fetchRoom(code);
        if (!roomData) {
          setError("Room not found. Check the room code and try again.");
          setLoading(false);
          return;
        }
        setRoom(roomData);

        // Check if user is already a member
        const m = await fetchMembers(roomData.id);
        const alreadyMember = m.some(mem => mem.auth_user_id === user.id);
        setMembers(m);
        setIsMember(alreadyMember);

        if (alreadyMember || roomData.created_by === user.id) {
          // Full access
          await joinRoom(roomData.id, user.id, p?.display_name || "Me", p?.avatar_color || "#A67C3D");
          const [updatedMembers, rp, v, s, jr] = await Promise.all([
            fetchMembers(roomData.id),
            fetchRoomProperties(roomData.id),
            fetchVotes(roomData.id),
            fetchSavedPropertyIds(user.id),
            fetchJoinRequests(roomData.id).catch(() => []),
          ]);
          setMembers(updatedMembers);
          setIsMember(true);
          setRoomPropMeta(rp);
          setRoomPropIds(rp.map(r => r.property_id));
          setVotes(v);
          setSavedIds(s);
          setJoinRequests(jr);
        } else {
          // Not a member — show join request flow
          const jr = await fetchJoinRequests(roomData.id).catch(() => []);
          const myReq = jr.find(r => r.user_id === user.id);
          setJoinRequests(jr);
          setRequestSent(myReq?.status === "pending");
        }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    init();
  }, [user, code]);

  // ── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!room?.id || !isMember) return;
    const channel = subscribeToRoom(room.id, {
      onVotes:      async () => setVotes(await fetchVotes(room.id)),
      onProperties: async () => {
        const rp = await fetchRoomProperties(room.id);
        setRoomPropMeta(rp);
        setRoomPropIds(rp.map(r => r.property_id));
      },
      onMembers:    async () => setMembers(await fetchMembers(room.id)),
    });
    return () => unsubscribeFromRoom(channel);
  }, [room?.id, isMember]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddProperty = useCallback(async (propertyId) => {
    if (!room) return;
    const pid = Number(propertyId);
    // Optimistic update first — instant UI
    setRoomPropIds(prev => prev.includes(pid) ? prev : [...prev, pid]);
    setRoomPropMeta(prev => prev.find(r => r.property_id === pid)
      ? prev : [...prev, { property_id: pid, added_by: user.id }]);
    try {
      await addPropertyToRoom(room.id, pid, user.id);
    } catch (err) {
      console.error("[HomeBlend] Failed to save property to room:", err);
      // Rollback optimistic update
      setRoomPropIds(prev => prev.filter(id => id !== pid));
      setRoomPropMeta(prev => prev.filter(r => r.property_id !== pid));
    }
  }, [room, user]);

  const handleRemoveProperty = useCallback(async (propertyId) => {
    if (!room) return;
    await removePropertyFromRoom(room.id, propertyId);
    setRoomPropIds(prev => prev.filter(id => id !== propertyId));
    setRoomPropMeta(prev => prev.filter(r => r.property_id !== propertyId));
    if (selected?.id === propertyId) setSelected(null);
  }, [room, selected]);

  const handleVote = useCallback(async (propertyId, vote) => {
    if (!room || !user) return;
    await recordVote(room.id, user.id, propertyId, vote);
    setVotes(prev => {
      const filtered = prev.filter(v => !(v.user_id === user.id && v.property_id === propertyId));
      if (vote === null) return filtered;
      return [...filtered, { user_id: user.id, property_id: propertyId, vote, room_id: room.id }];
    });
  }, [room, user]);

  async function handleRequestJoin() {
    if (!room || !user) return;
    setRequestSent(true);
    try {
      await requestToJoin(room.id, user.id, profile?.display_name || user.email?.split("@")[0]);
    } catch { setRequestSent(false); }
  }

  async function handleRespondToRequest(requestId, accept) {
    try {
      await respondToJoinRequest(requestId, accept, room.id);
      const jr = await fetchJoinRequests(room.id).catch(() => []);
      setJoinRequests(jr);
      if (accept) {
        const m = await fetchMembers(room.id);
        setMembers(m);
      }
    } catch (e) { console.error(e); }
  }

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid rgba(166,124,61,0.2)`, borderTopColor: B.gold, animation: "spin 0.7s linear infinite" }} />
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>Joining room {code}…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: B.ink, marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.muted, marginBottom: 22 }}>{error}</div>
        <button onClick={() => nav("/dashboard")} style={{ padding: "10px 24px", borderRadius: 9, background: B.ink, border: "none", color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Join-request gate ────────────────────────────────────────────────────
  if (!isMember && !isOwner) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        maxWidth: 420, width: "100%",
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderRadius: 20, border: `1px solid ${B.border}`,
        boxShadow: "0 16px 60px rgba(40,24,8,0.12)",
        padding: "40px 36px", textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <LogoMark size={44} />
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: B.ink, marginBottom: 6 }}>
          Room <strong style={{ fontWeight: 500, letterSpacing: 2 }}>{code}</strong>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: B.muted, lineHeight: 1.7, marginBottom: 28 }}>
          This room requires approval from the owner. Request access to join the group and view/vote on properties.
        </p>
        {requestSent ? (
          <div style={{
            padding: "14px 20px", borderRadius: 12,
            background: "rgba(92,138,107,0.1)", border: "1px solid rgba(92,138,107,0.25)",
          }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#5C8A6B" }}>Request sent</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, marginTop: 4 }}>
              The room owner will approve your request.
            </div>
          </div>
        ) : (
          <button onClick={handleRequestJoin} style={{
            width: "100%", padding: "13px 20px", borderRadius: 11,
            background: B.ink, border: "none", color: "#FAF6EE",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(44,26,14,0.2)",
          }}>
            Request to Join
          </button>
        )}
        <button onClick={() => nav("/dashboard")} style={{
          marginTop: 14, width: "100%", padding: "10px", borderRadius: 9,
          background: "transparent", border: `1px solid ${B.border}`,
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, cursor: "pointer",
        }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", height: 54,
        padding: "0 18px", gap: 10,
        background: "rgba(251,247,241,0.98)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0, zIndex: 50,
      }}>
        <button onClick={() => nav("/dashboard")} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", cursor: "pointer", padding: "6px 4px 6px 0",
        }}>
          <Icon d="M15 18l-6-6 6-6" size={16} color={B.muted} sw={2} />
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted }}>Dashboard</span>
        </button>

        <div style={{ width: 1, height: 18, background: B.border }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogoMark size={22} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: B.ink, fontWeight: 400 }}>HomeBlend</span>
        </div>

        {/* Room code chip */}
        <button onClick={copyCode} style={{
          display: "flex", alignItems: "center", gap: 7,
          background: copied ? "rgba(74,124,89,0.1)" : B.goldBg,
          border: `1px solid ${copied ? "rgba(74,124,89,0.3)" : B.border}`,
          borderRadius: 8, padding: "5px 12px", cursor: "pointer", transition: "all 0.2s",
        }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: copied ? "#4A7C59" : B.ink, letterSpacing: 2.5 }}>{code}</span>
          {copied
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            : <Icon d={IC.copy} size={12} color={B.muted} sw={1.8} />
          }
        </button>
        {copied && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#4A7C59", fontWeight: 600, animation: "fadeIn 0.15s ease" }}>Copied!</span>}

        <div style={{ flex: 1 }} />

        {/* Join request notification (owner only) */}
        {isOwner && joinRequests.filter(r => r.status === "pending").length > 0 && (
          <button
            onClick={() => setRightTab("requests")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 8,
              background: "rgba(192,98,74,0.1)", border: "1px solid rgba(192,98,74,0.25)",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#C0624A",
              cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {joinRequests.filter(r => r.status === "pending").length} request{joinRequests.filter(r => r.status === "pending").length > 1 ? "s" : ""}
          </button>
        )}

        {/* Voting progress */}
        {roomProperties.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted }}>Group votes</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: B.ink }}>{totalVotes} cast</div>
            </div>
            <div style={{ width: 52, height: 6, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ width: `${voteProgress}%`, height: "100%", background: B.gold, borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        <div style={{ width: 1, height: 18, background: B.border }} />

        {/* Member avatars */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {members.slice(0, 6).map((m, i) => (
            <div key={m.id || i} title={m.display_name} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: m.avatar_color || B.gold,
              border: "2px solid rgba(251,247,241,0.9)",
              marginLeft: i > 0 ? -8 : 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: "#fff",
              zIndex: 6 - i, position: "relative",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}>
              {m.display_name?.[0]?.toUpperCase()}
            </div>
          ))}
          {members.length > 6 && (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: B.goldBg, border: `2px solid rgba(251,247,241,0.9)`, marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.gold, fontWeight: 700 }}>+{members.length - 6}</span>
            </div>
          )}
        </div>

        <button onClick={() => setShowAddDrawer(true)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 12px", borderRadius: 8,
          border: `1px solid ${B.border}`, background: B.ink, color: "#FAF6EE",
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
          cursor: "pointer",
        }}>
          <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2} />
          Add
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── LEFT: Live Leaderboard ───────────────────────────────────── */}
        <div style={{ width: 390, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${B.border}`, overflow: "hidden" }}>

          {/* Sub-header */}
          <div style={{ padding: "13px 16px 12px", borderBottom: `1px solid ${B.border}`, background: "rgba(251,247,241,0.95)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, color: B.ink }}>Live Leaderboard</div>
                  {/* Live pulse dot */}
                  {totalVotes > 0 && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5C8A6B", boxShadow: "0 0 0 0 rgba(92,138,107,0.4)", animation: "pulse 2s infinite" }} />
                  )}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
                  {roomProperties.length} {roomProperties.length === 1 ? "property" : "properties"} · {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setShowAddDrawer(true)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8,
                border: `1px solid ${B.border}`, background: B.goldBg, color: B.gold,
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                <Icon d={IC.plus} size={12} color={B.gold} sw={2.2} />
                Add
              </button>
            </div>
            {/* Voting progress bar */}
            {roomProperties.length > 0 && members.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${voteProgress}%`, height: "100%", background: B.gold, borderRadius: 2, transition: "width 0.6s ease" }} />
                </div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, whiteSpace: "nowrap" }}>
                  {voterCount}/{members.length} voted
                </span>
              </div>
            )}
          </div>

          {/* Leaderboard list — sorted by net vote score */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 28px", display: "flex", flexDirection: "column", gap: 9 }}>
            {roomProperties.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 24px" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(166,124,61,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon d={IC.home} size={22} color={B.gold} sw={1.2} />
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: B.ink, marginBottom: 7 }}>No properties yet</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, lineHeight: 1.7, maxWidth: 200, marginBottom: 18 }}>
                  Add properties and vote — the leaderboard updates live.
                </div>
                <button onClick={() => setShowAddDrawer(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 9, background: B.ink, border: "none", color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2} />
                  Browse Properties
                </button>
              </div>
            ) : (() => {
              // Sort by net score descending, then by title as tiebreaker
              const scored = roomProperties.map(p => {
                const pvotes = votesFor(p.id);
                const score  = pvotes.reduce((s, v) => s + (v.vote === 1 ? 1 : -1), 0);
                const likes  = pvotes.filter(v => v.vote === 1).length;
                const dislikes = pvotes.filter(v => v.vote === -1).length;
                return { p, score, likes, dislikes };
              }).sort((a, b) => b.score - a.score || b.likes - a.likes || a.p.title.localeCompare(b.p.title));

              return scored.map(({ p, score, likes, dislikes }, rank) => {
                const meta = roomPropMeta.find(r => r.property_id === p.id);
                const rankColor = rank === 0 ? "#A67C3D" : rank === 1 ? "#8C9BAB" : rank === 2 ? "#9B7553" : B.muted;
                const rankBg    = rank === 0 ? "rgba(166,124,61,0.12)" : rank === 1 ? "rgba(140,155,171,0.1)" : rank === 2 ? "rgba(155,117,83,0.1)" : "transparent";
                return (
                  <div key={p.id} style={{ position: "relative" }}>
                    {/* Rank badge */}
                    <div style={{
                      position: "absolute", top: 9, left: 9, zIndex: 2,
                      width: 22, height: 22, borderRadius: "50%",
                      background: rankBg, border: `1.5px solid ${rankColor}55`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: rankColor,
                    }}>
                      {rank + 1}
                    </div>
                    <RoomPropertyCard
                      property={p}
                      votes={votesFor(p.id)}
                      myVote={myVotes[p.id] ?? null}
                      addedBy={meta?.added_by}
                      members={members}
                      isSelected={selected?.id === p.id}
                      onSelect={() => setSelected(prev => prev?.id === p.id ? null : p)}
                      onVote={vote => handleVote(p.id, vote)}
                      onRemove={() => handleRemoveProperty(p.id)}
                      canRemove={meta?.added_by === user?.id || room?.created_by === user?.id}
                      score={score}
                      rank={rank}
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ─── RIGHT: Map / Blend / Requests tabs ─────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{
            display: "flex", alignItems: "center",
            borderBottom: `1px solid ${B.border}`,
            background: "rgba(251,247,241,0.92)",
            flexShrink: 0, padding: "0 18px",
          }}>
            {[
              ["map",   IC.map,   "Map"],
              ["blend", IC.spark, "Blend"],
              ["picks", "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", "Group Picks"],
              ...(isOwner ? [["requests", "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0", `Requests${joinRequests.filter(r=>r.status==="pending").length > 0 ? ` (${joinRequests.filter(r=>r.status==="pending").length})` : ""}`]] : []),
            ].map(([tab, icon, label]) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "13px 16px", border: "none", background: "transparent",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  fontWeight: rightTab === tab ? 600 : 400,
                  color: rightTab === tab ? B.ink : B.muted,
                  cursor: "pointer",
                  borderBottom: `2px solid ${rightTab === tab ? B.gold : "transparent"}`,
                  marginBottom: -1, transition: "color 0.15s, border-color 0.15s",
                }}
              >
                <Icon d={icon} size={13} color={rightTab === tab ? B.gold : B.muted} sw={1.8} />
                {label}
                {tab === "blend" && votes.length > 0 && (
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", background: "#5C8A6B",
                    marginLeft: 1,
                  }} />
                )}
                {tab === "picks" && roomProperties.length > 0 && (
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", background: B.gold,
                    marginLeft: 1,
                  }} />
                )}
                {tab === "requests" && joinRequests.filter(r=>r.status==="pending").length > 0 && (
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", background: "#C0624A",
                    marginLeft: 1, animation: "pulse 1.5s ease infinite",
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

            {/* Map */}
            <div style={{ position: "absolute", inset: 0, opacity: rightTab === "map" ? 1 : 0, pointerEvents: rightTab === "map" ? "auto" : "none", transition: "opacity 0.2s" }}>
              <MapPanel
                properties={roomProperties.length > 0 ? roomProperties : PROPERTIES}
                swipes={myVotes}
                selectedProperty={selected}
                onSelect={p => setSelected(prev => prev?.id === p.id ? null : p)}
              />
              {selected && (
                <PropertyModal
                  property={selected}
                  myVote={myVotes[selected.id] ?? null}
                  onLike={() => handleVote(selected.id, myVotes[selected.id] === 1 ? null : 1)}
                  onPass={() => handleVote(selected.id, myVotes[selected.id] === -1 ? null : -1)}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>

            {/* Blend tab — live, always computed */}
            <div style={{
              position: "absolute", inset: 0,
              opacity: rightTab === "blend" ? 1 : 0,
              pointerEvents: rightTab === "blend" ? "auto" : "none",
              transition: "opacity 0.2s",
              background: `linear-gradient(160deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)`,
            }}>
              <BlendPanel
                members={members}
                votes={votes}
                properties={roomProperties}
                embedded={true}
              />
            </div>

            {/* Group Picks tab */}
            <div style={{
              position: "absolute", inset: 0,
              opacity: rightTab === "picks" ? 1 : 0,
              pointerEvents: rightTab === "picks" ? "auto" : "none",
              transition: "opacity 0.2s",
            }}>
              <GroupPicksPanel
                members={members}
                votes={votes}
                properties={roomProperties}
              />
            </div>

            {/* Join Requests tab (owner only) */}
            {isOwner && (
              <div style={{
                position: "absolute", inset: 0,
                opacity: rightTab === "requests" ? 1 : 0,
                pointerEvents: rightTab === "requests" ? "auto" : "none",
                transition: "opacity 0.2s",
                background: `linear-gradient(160deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)`,
                overflowY: "auto", padding: "24px 28px",
              }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 8 }}>
                  Join Requests
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: B.ink, marginBottom: 20 }}>
                  Room Members
                </div>

                {/* Pending requests */}
                {joinRequests.filter(r => r.status === "pending").length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                    {joinRequests.filter(r => r.status === "pending").map(req => (
                      <div key={req.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 16px", borderRadius: 12,
                        background: "rgba(255,255,255,0.8)", border: `1px solid ${B.border}`,
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: B.gold, display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#FAF6EE", flexShrink: 0,
                        }}>
                          {(req.display_name || "?")[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>
                            {req.display_name || "Unknown User"}
                          </div>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
                            Wants to join · {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleRespondToRequest(req.id, false)}
                            style={{
                              padding: "6px 12px", borderRadius: 7,
                              background: "rgba(192,98,74,0.08)", border: "1px solid rgba(192,98,74,0.2)",
                              color: "#C0624A", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >Decline</button>
                          <button
                            onClick={() => handleRespondToRequest(req.id, true)}
                            style={{
                              padding: "6px 12px", borderRadius: 7,
                              background: "rgba(92,138,107,0.12)", border: "1px solid rgba(92,138,107,0.3)",
                              color: "#5C8A6B", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: "20px", borderRadius: 12, textAlign: "center",
                    background: "rgba(166,124,61,0.05)", border: `1px dashed rgba(166,124,61,0.2)`,
                    marginBottom: 24,
                  }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>
                      No pending requests
                    </div>
                  </div>
                )}

                {/* Current members */}
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 10 }}>
                  Current Members ({members.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {members.map((m, i) => (
                    <div key={m.id || i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 10,
                      background: "rgba(255,255,255,0.65)", border: `1px solid ${B.border}`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: m.avatar_color || B.gold,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#FAF6EE", flexShrink: 0,
                      }}>
                        {m.display_name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink }}>
                          {m.display_name}
                          {m.auth_user_id === room?.created_by && (
                            <span style={{ marginLeft: 7, padding: "1px 6px", borderRadius: 4, background: B.goldBg, color: B.gold, fontSize: 9, fontWeight: 700 }}>Owner</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 1 }}>
                          {votes.filter(v => v.user_id === m.auth_user_id).length} vote{votes.filter(v => v.user_id === m.auth_user_id).length !== 1 ? "s" : ""} cast
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {showAddDrawer && (
        <AddPropertiesDrawer
          roomPropertyIds={roomPropIds}
          savedIds={savedIds}
          onAdd={handleAddProperty}
          onClose={() => setShowAddDrawer(false)}
        />
      )}
    </div>
  );
}
