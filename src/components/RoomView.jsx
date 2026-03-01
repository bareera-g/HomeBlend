import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PROPERTIES } from "../data/properties.js";
import { B, Icon, IC, LogoMark } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import {
  fetchRoom,
  ensureProfile,
  fetchMembers, joinRoom, leaveRoom,
  fetchRoomProperties, addPropertyToRoom, removePropertyFromRoom,
  fetchVotes, recordVote,
  fetchSavedPropertyIds,
  fetchJoinRequests, requestToJoin, respondToJoinRequest,
  subscribeToRoom, unsubscribeFromRoom,
  renameRoom, removeMember, deleteRoom,
} from "../lib/firebase.js";
import MapPanel           from "./MapPanel.jsx";
import PropertyModal      from "./PropertyModal.jsx";
import BlendPanel         from "./BlendPanel.jsx";
import GroupPicksPanel    from "./GroupPicksPanel.jsx";
import AddPropertiesDrawer from "./AddPropertiesDrawer.jsx";
import { RoomViewSkeleton } from "./Skeleton.jsx";
import MemberAvatars      from "./MemberAvatars.jsx";

import JoinGate           from "./JoinGate.jsx";
import JoinRequestsPanel  from "./JoinRequestsPanel.jsx";
import LeaderboardList    from "./LeaderboardList.jsx";

function pluralize(n, one, many) { return n === 1 ? one : many; }

const ROOM_BG = "linear-gradient(165deg, #E8DED0 0%, #DFD4C4 45%, #D9CDBD 100%)";

/* ── Init helpers (extracted to keep component cognitive-complexity low) ── */

async function loadFullAccess(roomData, user, profile) {
  await joinRoom(
    roomData.id, user.id,
    profile?.display_name || user.display_name || "Me",
    profile?.avatar_color || user.avatar_color || "#A67C3D",
  );
  const [members, rp, votes, savedIds, joinRequests] = await Promise.all([
    fetchMembers(roomData.id),
    fetchRoomProperties(roomData.id),
    fetchVotes(roomData.id),
    fetchSavedPropertyIds(user.id),
    fetchJoinRequests(roomData.id).catch(() => []),
  ]);
  return { members, rp, votes, savedIds, joinRequests };
}

async function loadGuestView(roomData, userId) {
  const jr = await fetchJoinRequests(roomData.id).catch(() => []);
  const myReq = jr.find(r => r.user_id === userId);
  return { joinRequests: jr, requestSent: myReq?.status === "pending" };
}

async function initRoom(code, user, s) {
  s.setLoading(true);
  try {
    const p = await ensureProfile(user.id, user.display_name);
    s.setProfile(p);

    const roomData = await fetchRoom(code);
    if (!roomData) {
      s.setError("Room not found. Check the room code and try again.");
      s.setLoading(false);
      return;
    }
    s.setRoom(roomData);

    const m = await fetchMembers(roomData.id);
    const alreadyMember = m.some(mem => mem.auth_user_id === user.id);
    s.setMembers(m);
    s.setIsMember(alreadyMember);

    if (alreadyMember || roomData.created_by === user.id) {
      const full = await loadFullAccess(roomData, user, p);
      s.setMembers(full.members);
      s.setIsMember(true);
      s.setRoomPropMeta(full.rp);
      s.setRoomPropIds(full.rp.map(r => r.property_id));
      s.setVotes(full.votes);
      s.setSavedIds(full.savedIds);
      s.setJoinRequests(full.joinRequests);
    } else {
      const guest = await loadGuestView(roomData, user.id);
      s.setJoinRequests(guest.joinRequests);
      s.setRequestSent(!!guest.requestSent);
    }
  } catch (e) { s.setError(e.message); }
  finally { s.setLoading(false); }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function RoomView() {
  const { roomCode } = useParams();
  const nav = useNavigate();
  const { user, signOut } = useAuth();
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
  // Room rename
  const [editingName,    setEditingName]    = useState(false);
  const [editNameValue,  setEditNameValue]  = useState("");
  // Member management
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const memberMenuRef = useRef(null);
  // Settings gear
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  // Profile menu
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  /* ── Memoized derived data ──────────────────────────────────────────────── */
  const roomPropIdSet = useMemo(() => new Set(roomPropIds), [roomPropIds]);
  const roomProperties = useMemo(() => PROPERTIES.filter(p => roomPropIdSet.has(p.id)), [roomPropIdSet]);

  const votesByProperty = useMemo(() => {
    const map = {};
    for (const v of votes) {
      map[v.property_id] ??= [];
      map[v.property_id].push(v);
    }
    return map;
  }, [votes]);

  const myVotes = useMemo(() => {
    const map = {};
    for (const v of votes) {
      if (v.user_id === user?.id) map[v.property_id] = v.vote;
    }
    return map;
  }, [votes, user?.id]);

  const pendingRequests = useMemo(() => joinRequests.filter(r => r.status === "pending"), [joinRequests]);
  const totalVotes      = votes.length;
  const isOwner         = room?.created_by === user?.id;

  // ── Load room ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    initRoom(code, user, {
      setProfile, setRoom, setMembers, setIsMember,
      setRoomPropMeta, setRoomPropIds, setVotes,
      setSavedIds, setJoinRequests, setRequestSent,
      setError, setLoading,
    });
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

  // ── Close member menu on outside click ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) setShowMemberMenu(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddProperty = useCallback(async (propertyId) => {
    if (!room) return;
    const pid = Number(propertyId);
    // Optimistic update first — instant UI
    setRoomPropIds(prev => prev.includes(pid) ? prev : [...prev, pid]);
    setRoomPropMeta(prev => prev.some(r => r.property_id === pid)
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
      await requestToJoin(room.id, user.id, profile?.display_name || user.display_name);
    } catch { setRequestSent(false); }
  }

  async function handleRespondToRequest(requestId, accept) {
    try {
      await respondToJoinRequest(room.id, requestId, accept);
      const jr = await fetchJoinRequests(room.id).catch(() => []);
      setJoinRequests(jr);
      if (accept) {
        const m = await fetchMembers(room.id);
        setMembers(m);
      }
    } catch (e) { console.error(e); }
  }

  const toggleSelect = useCallback((p) => {
    setSelected(prev => prev?.id === p.id ? null : p);
  }, []);

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ height: "100dvh", background: ROOM_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: B.ink, marginBottom: 10 }}>Something went wrong</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.muted, marginBottom: 22 }}>{error}</div>
        <button onClick={() => nav("/dashboard")} style={{ padding: "10px 24px", borderRadius: 9, background: B.ink, border: "none", color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) return <RoomViewSkeleton />;

  // ── Join-request gate ────────────────────────────────────────────────────
  if (!isMember && !isOwner) {
    return (
      <JoinGate
        code={code}
        requestSent={requestSent}
        onRequestJoin={handleRequestJoin}
        onBack={() => nav("/dashboard")}
      />
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: ROOM_BG, overflow: "hidden", animation: "pageFadeIn 0.35s ease both" }}>
      {/* ── Room header (distinct from Dashboard) ───────────────────────────── */}
      <header style={{
        display: "flex", flexDirection: "column", flexShrink: 0, zIndex: 50,
        background: "linear-gradient(180deg, rgba(255,252,247,0.95) 0%, rgba(249,244,236,0.9) 100%)",
        borderRadius: "0 0 20px 20px", boxShadow: "0 4px 20px rgba(44,26,14,0.08)",
        borderBottom: "none",
      }}>
        {/* Top row: Back + Logo + Room code + Profile avatar */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 20px 10px", gap: 14 }}>
          <button onClick={() => nav("/dashboard")} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(166,124,61,0.06)", border: `1px solid ${B.border}`,
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            <Icon d="M15 18l-6-6 6-6" size={14} color={B.muted} sw={2} />
            Dashboard
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <LogoMark size={20} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, fontWeight: 500 }}>HomeBlend</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Profile avatar with dropdown */}
          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfileMenu(v => !v)}
              onMouseEnter={e => { if (!showProfileMenu) e.currentTarget.style.boxShadow = "0 2px 12px rgba(44,26,14,0.18)"; }}
              onMouseLeave={e => { if (!showProfileMenu) e.currentTarget.style.boxShadow = "0 2px 8px rgba(44,26,14,0.1)"; }}
              style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: profile?.avatar_color || user?.avatar_color || B.gold,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif",
                border: showProfileMenu ? `2px solid ${B.gold}` : "2px solid transparent",
                boxShadow: "0 2px 8px rgba(44,26,14,0.1)",
                cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              title={profile?.display_name || user?.display_name}
            >
              {(profile?.display_name || user?.display_name || "?")[0].toUpperCase()}
            </button>
            {showProfileMenu && (
              <div style={{
                position: "absolute", top: 40, right: 0, width: 200, zIndex: 100,
                background: "#fff", borderRadius: 14,
                boxShadow: "0 12px 40px rgba(20,12,5,0.18)",
                border: `1px solid ${B.border}`,
                padding: "6px 0", animation: "fadeIn 0.14s ease",
              }}>
                <div style={{ padding: "8px 16px 8px", borderBottom: `1px solid ${B.border}` }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>{profile?.display_name || user?.display_name}</div>
                </div>
                <button
                  onClick={async () => { setShowProfileMenu(false); await signOut(); nav("/auth", { replace: true }); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    width: "100%", padding: "9px 16px", border: "none",
                    background: "transparent", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C0624A",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(192,98,74,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Room name hero + gear + meta row */}
        <div style={{ padding: "6px 20px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {editingName ? (
              <form onSubmit={async (e) => { e.preventDefault(); if (editNameValue.trim()) { await renameRoom(room.id, editNameValue.trim()); setRoom(r => ({ ...r, name: editNameValue.trim() })); } setEditingName(false); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)}
                  onBlur={async () => { if (editNameValue.trim() && editNameValue.trim() !== room?.name) { await renameRoom(room.id, editNameValue.trim()); setRoom(r => ({ ...r, name: editNameValue.trim() })); } setEditingName(false); }}
                  style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: B.ink, letterSpacing: 0.3, margin: 0, lineHeight: 1.2, border: "none", borderBottom: `2px solid ${B.gold}`, outline: "none", background: "transparent", padding: "0 2px", width: Math.max(120, editNameValue.length * 14) }}
                />
              </form>
            ) : (
              <h1 onClick={() => { if (isOwner) { setEditNameValue(room?.name || ""); setEditingName(true); } }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && isOwner) { e.preventDefault(); setEditNameValue(room?.name || ""); setEditingName(true); } }}
                role={isOwner ? "button" : undefined}
                tabIndex={isOwner ? 0 : undefined}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: B.ink, letterSpacing: 0.3, margin: 0, lineHeight: 1.2, cursor: isOwner ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6 }}>
                {room?.name || "Room"}
                {isOwner && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.5 }}><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>}
              </h1>
            )}
            {/* Settings gear — right of room name */}
            <div ref={settingsRef} style={{ position: "relative" }}>
              <button onClick={() => setShowSettings(v => !v)} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 8, border: "none",
                background: showSettings ? "rgba(166,124,61,0.12)" : "transparent",
                cursor: "pointer", transition: "background 0.15s",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
              {showSettings && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
                  width: 200, background: "#fff", borderRadius: 10,
                  border: `1px solid ${B.border}`, boxShadow: "0 8px 24px rgba(44,26,14,0.12)",
                  padding: "6px 0", animation: "fadeIn 0.12s ease",
                }}>
                  <div style={{ padding: "4px 12px 6px", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Room Settings</div>
                  {/* Leave room (non-owner) */}
                  {!isOwner && (
                    <button onClick={async () => {
                      if (!confirm("Leave this room? You can rejoin later with the room code.")) return;
                      setShowSettings(false);
                      await leaveRoom(room.id, user.id);
                      nav("/dashboard");
                    }} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                      border: "none", background: "transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0624A", textAlign: "left",
                      transition: "background 0.1s",
                    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(192,98,74,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C0624A" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                      Leave Room
                    </button>
                  )}
                  {/* Delete room (owner only) */}
                  {isOwner && (
                    <>
                      <div style={{ height: 1, background: B.border, margin: "4px 0" }} />
                      <button onClick={async () => {
                        if (!confirm("Delete this room? This cannot be undone. All members, properties, and votes will be removed.")) return;
                        setShowSettings(false);
                        await deleteRoom(room.id);
                        nav("/dashboard");
                      }} style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                        border: "none", background: "transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#C0624A", fontWeight: 600, textAlign: "left",
                        transition: "background 0.1s",
                      }} onMouseEnter={e => e.currentTarget.style.background = "rgba(192,98,74,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C0624A" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Delete Room
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 4 }}>
              {members.length} {pluralize(members.length, "member", "members")} · {roomProperties.length} {pluralize(roomProperties.length, "property", "properties")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isOwner && pendingRequests.length > 0 && (
              <button onClick={() => setRightTab("requests")} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10,
                background: "rgba(192,98,74,0.1)", border: "1px solid rgba(192,98,74,0.25)",
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#C0624A", cursor: "pointer",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {pendingRequests.length} {pluralize(pendingRequests.length, "request", "requests")}
              </button>
            )}

            {/* Room code */}
            <button onClick={copyCode}
              onMouseEnter={e => { e.currentTarget.style.background = copied ? "rgba(74,124,89,0.18)" : "rgba(166,124,61,0.14)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(44,26,14,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = copied ? "rgba(74,124,89,0.12)" : B.goldBg; e.currentTarget.style.boxShadow = "none"; }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: copied ? "rgba(74,124,89,0.12)" : B.goldBg,
                border: `1.5px solid ${copied ? "rgba(74,124,89,0.35)" : B.border}`,
                borderRadius: 10, padding: "7px 14px", cursor: "pointer",
                transition: "all 0.2s",
              }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 800, color: copied ? "#4A7C59" : B.ink, letterSpacing: 2 }}>{copied ? "Copied!" : code}</span>
              {copied
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                : <Icon d={IC.copy} size={12} color={B.muted} sw={1.8} />
              }
            </button>

            {/* Member avatars with owner management dropdown */}
            <div ref={memberMenuRef} style={{ position: "relative" }}>
              <div role={isOwner ? "button" : undefined}
                tabIndex={isOwner ? 0 : undefined}
                onClick={() => { if (isOwner) setShowMemberMenu(v => !v); }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && isOwner) { e.preventDefault(); setShowMemberMenu(v => !v); } }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                style={{ cursor: isOwner ? "pointer" : "default", transition: "opacity 0.15s" }}>
                <MemberAvatars members={members} />
              </div>
              {showMemberMenu && isOwner && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                  width: 220, background: "#fff", borderRadius: 10,
                  border: `1px solid ${B.border}`, boxShadow: "0 8px 24px rgba(44,26,14,0.12)",
                  padding: "8px 0", animation: "fadeIn 0.12s ease",
                }}>
                  <div style={{ padding: "4px 12px 8px", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Members</div>
                  {members.map(m => (
                    <div key={m.auth_user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: m.avatar_color || B.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                        {(m.display_name || "?")[0].toUpperCase()}
                      </div>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink, flex: 1 }}>
                        {m.display_name || "Member"}
                        {m.role === "owner" && <span style={{ marginLeft: 4, fontSize: 9, color: B.gold, fontWeight: 600 }}>Owner</span>}
                      </span>
                      {m.role !== "owner" && m.auth_user_id !== user?.id && (
                        <button onClick={async () => {
                          if (!confirm(`Remove ${m.display_name || "this member"} from the room?`)) return;
                          await removeMember(room.id, m.auth_user_id);
                          setMembers(prev => prev.filter(x => x.auth_user_id !== m.auth_user_id));
                          setShowMemberMenu(false);
                        }} title="Remove member" style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, borderRadius: 6, border: "none",
                          background: "rgba(192,98,74,0.08)", cursor: "pointer", flexShrink: 0,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C0624A" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowAddDrawer(true)}
              onMouseEnter={e => { e.currentTarget.style.background = "#3D3228"; e.currentTarget.style.boxShadow = "0 3px 10px rgba(44,26,14,0.22)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = B.ink; e.currentTarget.style.boxShadow = "none"; }}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10,
                border: "none", background: B.ink, color: "#FAF6EE",
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer",
                transition: "background 0.15s, box-shadow 0.15s",
              }}>
              <Icon d={IC.plus} size={12} color="#FAF6EE" sw={2} />
              Add
            </button>
          </div>
        </div>
      </header>

      {/* ── Body (card-style panels, different from Dashboard) ────────────── */}
      <div style={{ flex: 1, display: "flex", gap: 12, padding: "12px 16px 16px", overflow: "hidden", minHeight: 0 }}>

        {/* ─── LEFT: Leaderboard card ─────────────────────────────────────── */}
        <div style={{
          width: 380, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "rgba(255,252,247,0.97)", borderRadius: 16, overflow: "hidden",
          boxShadow: "0 2px 16px rgba(44,26,14,0.06)", border: `1px solid ${B.border}`,
        }}>

          {/* Sub-header */}
          <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${B.border}`, background: "rgba(251,247,241,0.6)", flexShrink: 0, borderRadius: "16px 16px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 500, color: B.ink }}>Live Leaderboard</div>
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
                  {roomProperties.length} {pluralize(roomProperties.length, "property", "properties")} · {totalVotes} {pluralize(totalVotes, "vote", "votes")}
                </div>
              </div>
              <button onClick={() => setShowAddDrawer(true)}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(166,124,61,0.18)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(166,124,61,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = B.goldBg; e.currentTarget.style.boxShadow = "none"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 8,
                  border: `1px solid ${B.border}`, background: B.goldBg, color: B.gold,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}>
                <Icon d={IC.plus} size={12} color={B.gold} sw={2.2} />
                Add
              </button>
            </div>

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
            ) : (
              <LeaderboardList
                properties={roomProperties}
                votesByProperty={votesByProperty}
                myVotes={myVotes}
                roomPropMeta={roomPropMeta}
                members={members}
                selected={selected}
                userId={user?.id}
                roomOwnerId={room?.created_by}
                onToggleSelect={toggleSelect}
                onVote={handleVote}
                onRemove={handleRemoveProperty}
              />
            )}
          </div>
        </div>

        {/* ─── RIGHT: Tabbed content card ─────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
          background: "rgba(255,252,247,0.97)", borderRadius: 16,
          boxShadow: "0 2px 16px rgba(44,26,14,0.06)", border: `1px solid ${B.border}`,
        }}>

          {/* Pill-style tab bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 14px", flexShrink: 0,
            background: "rgba(251,247,241,0.5)", borderRadius: "16px 16px 0 0",
            borderBottom: `1px solid ${B.border}`,
          }}>
            {[
              ["map",   IC.map,   "Map"],
              ["blend", IC.spark, "Blend"],
              ["picks", "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", "Group Picks"],
              ...(isOwner ? [["requests", "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0", pendingRequests.length > 0 ? "Requests (" + pendingRequests.length + ")" : "Requests"]] : []),
            ].map(([tab, icon, label]) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                onMouseEnter={e => { if (rightTab !== tab) e.currentTarget.style.background = "rgba(166,124,61,0.1)"; }}
                onMouseLeave={e => { if (rightTab !== tab) e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", border: "none",
                  background: rightTab === tab ? B.gold : "transparent",
                  color: rightTab === tab ? "#FAF6EE" : B.muted,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                  fontWeight: rightTab === tab ? 600 : 500,
                  cursor: "pointer", borderRadius: 10,
                  transition: "all 0.18s",
                }}
              >
                <Icon d={icon} size={13} color={rightTab === tab ? "#FAF6EE" : B.muted} sw={1.8} />
                {label}
                {tab === "requests" && pendingRequests.length > 0 && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: rightTab === tab ? "rgba(255,255,255,0.9)" : "#C0624A", marginLeft: 1, animation: "pulse 1.5s ease infinite" }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: "0 0 16px 16px" }}>

            {/* Map */}
            <div style={{ position: "absolute", inset: 0, opacity: rightTab === "map" ? 1 : 0, pointerEvents: rightTab === "map" ? "auto" : "none", transition: "opacity 0.2s" }}>
              <MapPanel
                properties={roomProperties.length > 0 ? roomProperties : PROPERTIES}
                swipes={myVotes}
                selectedProperty={selected}
                onSelect={toggleSelect}
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
                allProperties={PROPERTIES}
              />
            </div>

            {/* Join Requests tab (owner only) */}
            {isOwner && (
              <div style={{
                position: "absolute", inset: 0,
                opacity: rightTab === "requests" ? 1 : 0,
                pointerEvents: rightTab === "requests" ? "auto" : "none",
                transition: "opacity 0.2s",
              }}>
                <JoinRequestsPanel
                  joinRequests={joinRequests}
                  members={members}
                  votes={votes}
                  roomOwnerId={room?.created_by}
                  onRespond={handleRespondToRequest}
                />
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
