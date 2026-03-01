import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PROPERTIES } from "../data/properties.js";
import { B, Icon, IC, LogoMark, blendColor } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import {
  supabase,
  fetchRoom, createRoom,
  ensureProfile,
  fetchMembers, joinRoom,
  fetchRoomProperties, addPropertyToRoom, removePropertyFromRoom,
  fetchVotes, recordVote,
  fetchSavedPropertyIds,
  callBlend,
  subscribeToRoom, unsubscribeFromRoom,
} from "../lib/supabase.js";
import MapPanel           from "./MapPanel.jsx";
import PropertyModal      from "./PropertyModal.jsx";
import BlendPanel         from "./BlendPanel.jsx";
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
  const [blendData,     setBlendData]    = useState(null);
  const [blending,      setBlending]     = useState(false);
  const [rightTab,      setRightTab]     = useState("map"); // "map" | "blend"
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [copied,        setCopied]       = useState(false);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState(null);

  const roomProperties = PROPERTIES.filter(p => roomPropIds.includes(p.id));
  const myVotes = {};
  votes.filter(v => v.user_id === user?.id).forEach(v => { myVotes[v.property_id] = v.vote; });
  const votesFor = propId => votes.filter(v => v.property_id === propId);

  // ── Load & join room ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function init() {
      setLoading(true);
      try {
        const p = await ensureProfile(user.id, user.email?.split("@")[0]);
        setProfile(p);
        let roomData = await fetchRoom(code);
        if (!roomData) roomData = await createRoom(code, user.id);
        setRoom(roomData);
        await joinRoom(roomData.id, user.id, p?.display_name || "Me", p?.avatar_color || "#A67C3D");
        const [m, rp, v, s] = await Promise.all([
          fetchMembers(roomData.id), fetchRoomProperties(roomData.id),
          fetchVotes(roomData.id), fetchSavedPropertyIds(user.id),
        ]);
        setMembers(m);
        setRoomPropMeta(rp);
        setRoomPropIds(rp.map(r => r.property_id));
        setVotes(v);
        setSavedIds(s);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    init();
  }, [user, code]);

  // ── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!room?.id) return;
    const channel = subscribeToRoom(room.id, {
      onVotes:      async () => setVotes(await fetchVotes(room.id)),
      onProperties: async () => {
        const rp = await fetchRoomProperties(room.id);
        setRoomPropMeta(rp);
        setRoomPropIds(rp.map(r => r.property_id));
      },
      onMembers: async () => setMembers(await fetchMembers(room.id)),
    });
    return () => unsubscribeFromRoom(channel);
  }, [room?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddProperty = useCallback(async (propertyId) => {
    if (!room) return;
    await addPropertyToRoom(room.id, propertyId, user.id);
    setRoomPropIds(prev => prev.includes(propertyId) ? prev : [...prev, propertyId]);
    setRoomPropMeta(prev => prev.find(r => r.property_id === propertyId)
      ? prev : [...prev, { property_id: propertyId, added_by: user.id }]);
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

  async function handleBlend() {
    if (blending || !room) return;
    setBlending(true);
    try {
      const result = await callBlend(room.id);
      setBlendData(result);
    } catch {
      // Fallback local blend
      const propScores = {};
      roomProperties.forEach(p => {
        const pv = votesFor(p.id);
        const ups   = pv.filter(v => v.vote ===  1).length;
        const downs = pv.filter(v => v.vote === -1).length;
        const score = Math.round(50 + ((ups - downs) / Math.max(members.length, 1)) * 40);
        propScores[p.id] = { score, reason: `${ups} upvote${ups !== 1 ? "s" : ""}, ${downs} downvote${downs !== 1 ? "s" : ""}` };
      });
      const sorted = [...roomProperties].sort((a, b) => (propScores[b.id]?.score ?? 50) - (propScores[a.id]?.score ?? 50));
      setBlendData({
        group_summary: "Based on votes, your group values well-located, spacious rentals in Irvine.",
        top_matches: sorted.slice(0, 3).map(p => p.id),
        compromise_notes: "Connect the Anthropic API for full AI-powered insights.",
        property_scores: propScores,
        member_profiles: members.map(m => ({
          user_id: m.user_id || m.auth_user_id,
          lifestyle_summary: `${m.display_name} has voted on ${votes.filter(v => v.user_id === (m.auth_user_id || m.user_id)).length} properties.`,
          key_values: ["Location", "Space", "Value"],
          price_preference: "mid",
        })),
      });
    } finally {
      setBlending(false);
      setRightTab("blend"); // Auto-switch to blend tab
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const totalVotes = votes.length;
  const voteProgress = members.length > 0 && roomProperties.length > 0
    ? Math.round((new Set(votes.map(v => v.user_id)).size / members.length) * 100)
    : 0;

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

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", height: 54,
        padding: "0 18px", gap: 10,
        background: "rgba(251,247,241,0.98)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0, zIndex: 50,
      }}>
        {/* Back */}
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
          borderRadius: 8, padding: "5px 12px", cursor: "pointer",
          transition: "all 0.2s",
        }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 800, color: copied ? "#4A7C59" : B.ink, letterSpacing: 2.5 }}>{code}</span>
          {copied
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            : <Icon d={IC.copy} size={12} color={B.muted} sw={1.8} />
          }
        </button>

        {copied && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#4A7C59", fontWeight: 600, animation: "fadeIn 0.15s ease" }}>Copied!</span>}

        <div style={{ flex: 1 }} />

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

        {/* Add properties */}
        <button onClick={() => setShowAddDrawer(true)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 12px", borderRadius: 8,
          border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.6)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: B.muted,
          cursor: "pointer", transition: "all 0.15s",
        }}>
          <Icon d={IC.plus} size={13} color={B.muted} sw={2} />
          Add
        </button>

        {/* Blend button */}
        <button
          onClick={handleBlend}
          disabled={blending || roomProperties.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 16px", borderRadius: 9,
            background: roomProperties.length === 0 ? "rgba(44,26,14,0.15)" : blendData ? B.goldBg : B.ink,
            border: blendData ? `1.5px solid ${B.gold}` : "none",
            color: blendData ? B.gold : "#FAF6EE",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
            cursor: roomProperties.length === 0 || blending ? "not-allowed" : "pointer",
            opacity: blending ? 0.7 : 1, transition: "all 0.2s",
          }}
        >
          {blending
            ? <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.6s linear infinite" }} />
            : <svg width="13" height="13" viewBox="0 0 24 24" fill={blendData ? B.gold : "#FAF6EE"} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          }
          {blending ? "Blending…" : blendData ? "Re-Blend" : "Blend"}
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── LEFT: Room property list ────────────────────────────────── */}
        <div style={{ width: 390, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${B.border}`, overflow: "hidden" }}>

          {/* Sub-header */}
          <div style={{
            padding: "13px 16px 12px", borderBottom: `1px solid ${B.border}`,
            background: "rgba(251,247,241,0.92)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, color: B.ink }}>Room Properties</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
                  {roomProperties.length} {roomProperties.length === 1 ? "property" : "properties"} · {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => setShowAddDrawer(true)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 13px", borderRadius: 8,
                border: `1px solid ${B.border}`, background: B.goldBg, color: B.gold,
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                <Icon d={IC.plus} size={12} color={B.gold} sw={2.2} />
                Add Property
              </button>
            </div>

            {/* Quick vote summary bar */}
            {roomProperties.length > 0 && members.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${voteProgress}%`, height: "100%", background: B.gold, borderRadius: 2, transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, whiteSpace: "nowrap" }}>
                  {new Set(votes.map(v => v.user_id)).size}/{members.length} members voted
                </span>
              </div>
            )}
          </div>

          {/* Property list */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 13px 28px", display: "flex", flexDirection: "column", gap: 11 }}>
            {roomProperties.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 24px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(166,124,61,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon d={IC.home} size={24} color={B.gold} sw={1.2} />
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: B.ink, marginBottom: 8 }}>No properties yet</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, lineHeight: 1.7, maxWidth: 220, marginBottom: 20 }}>
                  Add properties for your group to vote on, then blend your preferences together.
                </div>
                <button onClick={() => setShowAddDrawer(true)} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "10px 20px", borderRadius: 9, background: B.ink, border: "none",
                  color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}>
                  <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2} />
                  Browse Properties
                </button>
              </div>
            ) : (
              roomProperties.map(p => {
                const meta = roomPropMeta.find(r => r.property_id === p.id);
                return (
                  <RoomPropertyCard
                    key={p.id}
                    property={p}
                    votes={votesFor(p.id)}
                    myVote={myVotes[p.id] ?? null}
                    addedBy={meta?.added_by}
                    members={members}
                    isSelected={selected?.id === p.id}
                    blendScore={blendData?.property_scores?.[p.id]?.score ?? null}
                    blendReason={blendData?.property_scores?.[p.id]?.reason ?? null}
                    onSelect={() => setSelected(prev => prev?.id === p.id ? null : p)}
                    onVote={vote => handleVote(p.id, vote)}
                    onRemove={() => handleRemoveProperty(p.id)}
                    canRemove={meta?.added_by === user?.id || room?.created_by === user?.id}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT: Map / Blend tab ──────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            borderBottom: `1px solid ${B.border}`,
            background: "rgba(251,247,241,0.92)",
            flexShrink: 0, padding: "0 18px",
          }}>
            {[
              ["map",   IC.map,   "Map"],
              ["blend", IC.spark, blendData ? "Blend · done" : "Blend"],
            ].map(([tab, icon, label]) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "13px 16px", border: "none", background: "transparent",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: rightTab === tab ? 600 : 400,
                  color: rightTab === tab ? B.ink : B.muted,
                  cursor: "pointer",
                  borderBottom: `2px solid ${rightTab === tab ? B.gold : "transparent"}`,
                  marginBottom: -1,
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                <Icon d={icon} size={13} color={rightTab === tab ? B.gold : B.muted} sw={1.8} />
                {label}
                {tab === "blend" && !blendData && roomProperties.length > 0 && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: B.gold, animation: "pulse 1.5s ease infinite" }} />
                )}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* Blend CTA inside tab bar */}
            {rightTab === "blend" && !blendData && (
              <button
                onClick={handleBlend}
                disabled={blending || roomProperties.length === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 8,
                  background: B.ink, border: "none",
                  color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                  cursor: roomProperties.length === 0 || blending ? "not-allowed" : "pointer",
                  opacity: blending ? 0.7 : 1,
                }}
              >
                {blending
                  ? <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.6s linear infinite" }} />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="#FAF6EE" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                }
                {blending ? "Analyzing…" : "Analyze Group"}
              </button>
            )}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

            {/* Map */}
            <div style={{ position: "absolute", inset: 0, opacity: rightTab === "map" ? 1 : 0, pointerEvents: rightTab === "map" ? "auto" : "none", transition: "opacity 0.2s" }}>
              <MapPanel
                properties={roomProperties.length > 0 ? roomProperties : PROPERTIES}
                swipes={myVotes}
                blendData={blendData}
                selectedProperty={selected}
                onSelect={p => setSelected(prev => prev?.id === p.id ? null : p)}
              />
              {selected && (
                <PropertyModal
                  property={selected}
                  myVote={myVotes[selected.id] ?? null}
                  blendScore={blendData?.property_scores?.[selected.id]?.score ?? null}
                  blendReason={blendData?.property_scores?.[selected.id]?.reason ?? null}
                  onLike={() => handleVote(selected.id, myVotes[selected.id] === 1 ? null : 1)}
                  onPass={() => handleVote(selected.id, myVotes[selected.id] === -1 ? null : -1)}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>

            {/* Blend tab */}
            <div style={{
              position: "absolute", inset: 0,
              opacity: rightTab === "blend" ? 1 : 0,
              pointerEvents: rightTab === "blend" ? "auto" : "none",
              transition: "opacity 0.2s",
              background: `linear-gradient(160deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)`,
              overflowY: "auto",
            }}>
              {blendData ? (
                <BlendPanel blendData={blendData} members={members} embedded={true} />
              ) : (
                /* Blend empty state */
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: B.goldBg, border: `1px solid ${B.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={B.gold} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: B.ink, marginBottom: 10 }}>Group Blend</div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.muted, lineHeight: 1.75, maxWidth: 320, marginBottom: 28 }}>
                    Once your group votes on properties, the AI will analyze everyone's preferences and find the best match for your whole group.
                  </p>
                  <button
                    onClick={handleBlend}
                    disabled={blending || roomProperties.length === 0}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "12px 28px", borderRadius: 10, background: B.ink, border: "none",
                      color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                      cursor: roomProperties.length === 0 || blending ? "not-allowed" : "pointer",
                      opacity: blending || roomProperties.length === 0 ? 0.5 : 1,
                      boxShadow: "0 4px 20px rgba(44,26,14,0.2)",
                    }}
                  >
                    {blending
                      ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.6s linear infinite" }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="#FAF6EE" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    }
                    {blending ? "Analyzing group…" : roomProperties.length === 0 ? "Add properties first" : "Analyze My Group"}
                  </button>
                  {roomProperties.length > 0 && (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 12 }}>
                      {roomProperties.length} {roomProperties.length === 1 ? "property" : "properties"} ready · {totalVotes} vote{totalVotes !== 1 ? "s" : ""} collected
                    </p>
                  )}
                </div>
              )}
            </div>
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
