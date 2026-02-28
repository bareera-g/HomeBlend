import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { B, Icon, IC, LogoMark } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import {
  signOut, ensureProfile,
  fetchUserRooms, fetchSavedPropertyIds,
  saveProperty, unsaveProperty,
  createRoom, fetchRoom, joinRoom,
  fetchMembers, fetchRoomProperties,
  addPropertyToRoom,
} from "../lib/supabase.js";
import { PROPERTIES } from "../data/properties.js";
import MapPanel from "./MapPanel.jsx";

function genCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
const CATEGORIES = ["All", "Apartment", "Condo", "Townhome", "Single Family"];

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [profile,       setProfile]      = useState(null);
  const [rooms,         setRooms]        = useState([]);
  const [roomMeta,      setRoomMeta]     = useState({});
  const [savedIds,      setSavedIds]     = useState([]);
  const [selected,      setSelected]     = useState(null);
  const [filter,        setFilter]       = useState("all");
  const [category,      setCategory]     = useState("All");
  const [maxPrice,      setMaxPrice]     = useState(5000);
  const [loading,       setLoading]      = useState(true);
  const [joinCode,      setJoinCode]     = useState("");
  const [joinErr,       setJoinErr]      = useState("");
  const [busy,          setBusy]         = useState(false);
  const [dragging,      setDragging]     = useState(false);
  const [draggedPropId, setDraggedPropId] = useState(null);
  const [dragOverRoom,  setDragOverRoom]  = useState(null);
  const [justAdded,     setJustAdded]    = useState({});

  useEffect(() => {
    if (!user) return;
    async function init() {
      setLoading(true);
      try {
        const p = await ensureProfile(user.id, user.email?.split("@")[0]);
        setProfile(p);
        const [r, s] = await Promise.all([fetchUserRooms(user.id), fetchSavedPropertyIds(user.id)]);
        setRooms(r);
        setSavedIds(s);
        const meta = {};
        await Promise.all(r.map(async room => {
          const [m, rp] = await Promise.all([fetchMembers(room.id), fetchRoomProperties(room.id)]);
          meta[room.id] = { memberCount: m.length, propertyCount: rp.length, propIds: rp.map(x => x.property_id) };
        }));
        setRoomMeta(meta);
      } finally { setLoading(false); }
    }
    init();
  }, [user]);

  const filtered = useMemo(() => PROPERTIES.filter(p => {
    if (filter === "saved" && !savedIds.includes(p.id)) return false;
    if (category !== "All" && p.category !== category) return false;
    if (p.priceNum > maxPrice) return false;
    return true;
  }), [filter, category, maxPrice, savedIds]);

  const mapSwipes = useMemo(() => {
    const s = {};
    savedIds.forEach(id => { s[id] = "like"; });
    return s;
  }, [savedIds]);

  async function toggleSave(propertyId, e) {
    e?.stopPropagation();
    if (savedIds.includes(propertyId)) {
      await unsaveProperty(user.id, propertyId);
      setSavedIds(prev => prev.filter(id => id !== propertyId));
    } else {
      await saveProperty(user.id, propertyId);
      setSavedIds(prev => [...prev, propertyId]);
    }
  }

  async function handleCreateRoom() {
    setBusy(true);
    try {
      const code = genCode();
      const room = await createRoom(code, user.id);
      await joinRoom(room.id, user.id, profile?.display_name || "Me", profile?.avatar_color || "#A67C3D");
      const newRoom = { id: room.id, room_code: code };
      setRooms(prev => [newRoom, ...prev]);
      setRoomMeta(prev => ({ ...prev, [room.id]: { memberCount: 1, propertyCount: 0, propIds: [] } }));
    } catch (e) { alert("Could not create room: " + e.message); }
    finally { setBusy(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setJoinErr("Enter a valid code."); return; }
    setJoinErr(""); setBusy(true);
    try {
      const room = await fetchRoom(code);
      if (!room) { setJoinErr("Room not found."); setBusy(false); return; }
      nav(`/room/${code}`);
    } catch { setJoinErr("Could not join."); } finally { setBusy(false); }
  }

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onCardDragStart = useCallback((e, propId) => {
    e.dataTransfer.setData("text/plain", String(propId));
    e.dataTransfer.effectAllowed = "copy";
    // Transparent ghost so card visually stays (we handle opacity instead)
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    setDraggedPropId(propId);
    setDragging(true);
  }, []);

  const onCardDragEnd = useCallback(() => {
    setDraggedPropId(null);
    setDragging(false);
    setDragOverRoom(null);
  }, []);

  const onRoomDragOver = useCallback((e, roomId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverRoom(roomId);
  }, []);

  const onRoomDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverRoom(null);
  }, []);

  const onRoomDrop = useCallback(async (e, room) => {
    e.preventDefault();
    const propId = parseInt(e.dataTransfer.getData("text/plain"));
    setDragOverRoom(null); setDragging(false); setDraggedPropId(null);
    if (!propId || !room.id) return;
    try {
      await addPropertyToRoom(room.id, propId, user.id);
      setRoomMeta(prev => {
        const cur = prev[room.id] || { memberCount: 0, propertyCount: 0, propIds: [] };
        if (cur.propIds.includes(propId)) return prev;
        return { ...prev, [room.id]: { ...cur, propertyCount: cur.propertyCount + 1, propIds: [...cur.propIds, propId] } };
      });
      setJustAdded(prev => ({ ...prev, [room.id]: true }));
      setTimeout(() => setJustAdded(prev => { const n = { ...prev }; delete n[room.id]; return n; }), 2000);
    } catch (err) { console.error("Add to room failed:", err); }
  }, [user]);

  if (loading) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid rgba(166,124,61,0.18)`, borderTopColor: B.gold, animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 0, height: 54,
        padding: "0 20px",
        background: "rgba(251,247,241,0.98)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${B.border}`,
        flexShrink: 0, zIndex: 60,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20 }}>
          <LogoMark size={22} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, color: B.ink, letterSpacing: 0.3 }}>HomeBlend</span>
        </div>

        {/* Discover / Saved toggle */}
        <div style={{ display: "flex", background: "rgba(166,124,61,0.07)", borderRadius: 8, padding: 3, marginRight: 16 }}>
          {[["all", "Discover"], ["saved", "Saved"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none",
              background: filter === v ? "#fff" : "transparent",
              boxShadow: filter === v ? "0 1px 6px rgba(80,50,10,0.08)" : "none",
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              fontWeight: filter === v ? 600 : 400,
              color: filter === v ? B.ink : B.muted,
              cursor: "pointer", transition: "all 0.18s",
            }}>{l}</button>
          ))}
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 4 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, whiteSpace: "nowrap" }}>
            Up to <strong style={{ color: B.gold, fontWeight: 600 }}>${maxPrice.toLocaleString()}</strong>
          </span>
          <input type="range" min={1000} max={5000} step={100} value={maxPrice}
            onChange={e => setMaxPrice(+e.target.value)}
            style={{ accentColor: B.gold, width: 80, cursor: "pointer" }} />
        </div>

        <div style={{ flex: 1 }} />

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: profile?.avatar_color || B.gold,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff",
              boxShadow: "0 2px 8px rgba(80,50,10,0.18)",
            }}>
              {(profile?.display_name || "?")[0].toUpperCase()}
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.ink, fontWeight: 500 }}>
              {profile?.display_name}
            </span>
          </div>
          <button
            onClick={async () => { await signOut(); nav("/auth", { replace: true }); }}
            style={{
              padding: "5px 13px", borderRadius: 7,
              border: `1px solid ${B.border}`, background: "transparent",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted,
              cursor: "pointer", transition: "border-color 0.15s",
            }}
          >Sign out</button>
        </div>
      </header>

      {/* ── 3-panel body ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── LEFT: Rooms ──────────────────────────────────────────────────── */}
        <aside style={{
          width: 242, flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRight: `1px solid ${B.border}`,
          background: dragging
            ? "rgba(166,124,61,0.04)"
            : "rgba(251,247,241,0.7)",
          transition: "background 0.25s",
          overflow: "hidden",
        }}>
          {/* Rooms header */}
          <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700,
              letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 3,
            }}>Collaborative</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: B.ink, marginBottom: 14 }}>
              Your Rooms
            </div>

            <button
              onClick={handleCreateRoom} disabled={busy}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 8,
                background: busy ? "rgba(44,26,14,0.4)" : B.ink,
                border: "none", color: "#FAF6EE",
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                cursor: busy ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginBottom: 8, transition: "background 0.15s",
                letterSpacing: 0.2,
              }}
            >
              <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2.2} />
              Create Room
            </button>

            <form onSubmit={handleJoin} style={{ display: "flex", gap: 5 }}>
              <input
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(""); }}
                placeholder="ROOM CODE"
                maxLength={8}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 7,
                  border: `1px solid ${joinErr ? "#C0624A" : B.border}`,
                  background: "rgba(255,255,255,0.55)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink,
                  letterSpacing: 1.8, outline: "none", boxSizing: "border-box",
                }}
              />
              <button type="submit" disabled={busy} style={{
                padding: "8px 11px", borderRadius: 7,
                border: `1px solid ${B.border}`, background: B.goldBg,
                color: B.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}>Join</button>
            </form>
            {joinErr && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#C0624A" }}>{joinErr}</p>}
          </div>

          {/* Drag-active instruction */}
          {dragging && (
            <div style={{
              margin: "10px 12px 2px",
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(166,124,61,0.1)",
              border: `1.5px dashed ${B.gold}`,
              textAlign: "center", animation: "pulse 1.5s ease infinite",
            }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: B.gold, lineHeight: 1.5 }}>
                Drop onto a room to add
              </p>
            </div>
          )}

          {/* Rooms list */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 10px 20px", display: "flex", flexDirection: "column", gap: 7 }}>
            {rooms.length === 0 ? (
              <div style={{ padding: "28px 14px", textAlign: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(166,124,61,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <Icon d={IC.home} size={16} color={B.gold} sw={1.5} />
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, lineHeight: 1.7 }}>
                  Create a room, then drag properties here to add them
                </p>
              </div>
            ) : rooms.map(room => (
              <RoomDropCard
                key={room.id}
                room={room}
                meta={roomMeta[room.id]}
                isOver={dragOverRoom === room.id}
                isAdded={!!justAdded[room.id]}
                alreadyIn={draggedPropId ? (roomMeta[room.id]?.propIds || []).includes(draggedPropId) : false}
                draggingActive={dragging}
                onDragOver={e => onRoomDragOver(e, room.id)}
                onDragLeave={onRoomDragLeave}
                onDrop={e => onRoomDrop(e, room)}
                onOpen={() => nav(`/room/${room.room_code}`)}
              />
            ))}
          </div>
        </aside>

        {/* ─── MIDDLE: Properties ───────────────────────────────────────────── */}
        <div style={{ width: 348, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${B.border}`, overflow: "hidden" }}>

          {/* Sub-header: category chips + count */}
          <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${B.border}`, flexShrink: 0, background: "rgba(251,247,241,0.85)" }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: "3px 10px", borderRadius: 12, border: "none",
                  background: category === cat ? B.gold : "rgba(166,124,61,0.08)",
                  color: category === cat ? "#FAF6EE" : B.muted,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.15s",
                }}>{cat}</button>
              ))}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted }}>
              <span style={{ fontWeight: 600, color: B.ink }}>{filtered.length}</span> {filtered.length === 1 ? "property" : "properties"}
              {dragging && (
                <span style={{ marginLeft: 8, color: B.gold, fontWeight: 600 }}>
                  ← drag to a room
                </span>
              )}
            </div>
          </div>

          {/* Scrollable cards */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 11px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontStyle: "italic", color: B.muted }}>
                  {filter === "saved" ? "Nothing saved yet" : "No properties match"}
                </p>
                {filter === "saved" && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, marginTop: 6 }}>
                    Heart any property to save it
                  </p>
                )}
              </div>
            ) : filtered.map(p => (
              <PropertyCard
                key={p.id}
                property={p}
                saved={savedIds.includes(p.id)}
                isSelected={selected?.id === p.id}
                isDragging={draggedPropId === p.id}
                onSelect={() => setSelected(prev => prev?.id === p.id ? null : p)}
                onSave={e => toggleSave(p.id, e)}
                onDragStart={onCardDragStart}
                onDragEnd={onCardDragEnd}
              />
            ))}
          </div>
        </div>

        {/* ─── RIGHT: Map ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapPanel
            properties={filtered}
            swipes={mapSwipes}
            blendData={null}
            selectedProperty={selected}
            onSelect={p => setSelected(prev => prev?.id === p.id ? null : p)}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Room Drop Card ─────────────────────────────────────────────────────────── */
function RoomDropCard({ room, meta = {}, isOver, isAdded, alreadyIn, draggingActive, onDragOver, onDragLeave, onDrop, onOpen }) {
  const thumbIds = (meta.propIds || []).slice(0, 4);
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderRadius: 11,
        border: isOver
          ? `2px solid ${B.gold}`
          : isAdded
          ? `2px solid #5C8A6B`
          : draggingActive
          ? `1.5px dashed rgba(166,124,61,0.4)`
          : `1px solid ${B.border}`,
        background: isOver
          ? "rgba(166,124,61,0.07)"
          : isAdded
          ? "rgba(92,138,107,0.07)"
          : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(10px)",
        padding: isOver ? "11px 13px" : "12px 13px",
        cursor: draggingActive ? "copy" : "pointer",
        transition: "all 0.18s cubic-bezier(.16,1,.3,1)",
        position: "relative",
        overflow: "hidden",
        transform: isOver ? "scale(1.02)" : "scale(1)",
        boxShadow: isOver
          ? `0 4px 24px rgba(166,124,61,0.2)`
          : isAdded
          ? `0 4px 20px rgba(92,138,107,0.15)`
          : "0 1px 6px rgba(80,50,10,0.05)",
      }}
    >
      {/* Drop overlay */}
      {isOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, zIndex: 3, background: "rgba(251,247,241,0.8)", backdropFilter: "blur(4px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: alreadyIn ? B.muted : B.gold }}>
              {alreadyIn ? "Already added" : "Drop to add"}
            </div>
          </div>
        </div>
      )}

      {/* Added success overlay */}
      {isAdded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, zIndex: 3, background: "rgba(245,252,248,0.9)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#5C8A6B" }}>✓ Added</div>
          </div>
        </div>
      )}

      {/* Room info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: B.ink, letterSpacing: 2.5 }}>
          {room.room_code}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: B.goldBg, border: `1px solid ${B.border}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          title="Open room"
        >
          <Icon d="M9 18l6-6-6-6" size={10} color={B.gold} sw={2.2} />
        </button>
      </div>

      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginBottom: thumbIds.length > 0 ? 7 : 0 }}>
        {meta.memberCount ?? 0} {meta.memberCount === 1 ? "member" : "members"}
        <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
        {meta.propertyCount ?? 0} {meta.propertyCount === 1 ? "property" : "properties"}
      </div>

      {/* Property thumbnails */}
      {thumbIds.length > 0 && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {thumbIds.map(pid => {
            const prop = PROPERTIES.find(p => p.id === pid);
            return prop ? (
              <div key={pid} title={prop.title} style={{
                width: 32, height: 26, borderRadius: 5, flexShrink: 0,
                background: `url(${prop.images[0]}) center/cover`,
                border: `1px solid rgba(166,124,61,0.15)`,
              }} />
            ) : null;
          })}
          {(meta.propIds || []).length > 4 && (
            <div style={{ width: 32, height: 26, borderRadius: 5, background: B.goldBg, border: `1px solid ${B.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, color: B.gold, fontWeight: 700 }}>+{(meta.propIds || []).length - 4}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Property Card (strict 280px, draggable) ─────────────────────────────── */
const CARD_HEIGHT = 280;
const IMG_HEIGHT  = 168;
const INFO_HEIGHT = CARD_HEIGHT - IMG_HEIGHT;

function PropertyCard({ property, saved, isSelected, isDragging, onSelect, onSave, onDragStart, onDragEnd }) {
  const [hovered, setHovered] = useState(false);
  const [imgIdx,  setImgIdx]  = useState(0);

  const amenities = [
    property.petFriendly && "🐾",
    property.parking === "In-unit" || property.laundry === "In-unit" ? "🧺" : null,
    property.parking?.includes("garage") ? "🚗" : null,
  ].filter(Boolean).slice(0, 3);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, property.id)}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: CARD_HEIGHT,
        borderRadius: 14,
        overflow: "hidden",
        flexShrink: 0,
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        border: `1.5px solid ${isSelected ? B.gold : hovered ? "rgba(166,124,61,0.35)" : "rgba(255,255,255,0.9)"}`,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(12px)",
        boxShadow: isDragging
          ? "none"
          : isSelected
          ? `0 0 0 3px rgba(166,124,61,0.15), 0 8px 32px rgba(80,50,10,0.16)`
          : hovered
          ? "0 6px 24px rgba(80,50,10,0.12)"
          : "0 2px 10px rgba(80,50,10,0.07)",
        opacity: isDragging ? 0.3 : 1,
        transform: hovered && !isDragging ? "translateY(-1px)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s, transform 0.15s",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* ── Photo ── */}
      <div style={{ height: IMG_HEIGHT, flexShrink: 0, position: "relative", overflow: "hidden", background: "#E8DED2" }}>

        {/* Images */}
        {property.images.map((src, i) => (
          <img key={i} src={src} alt="" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            transition: "opacity 0.35s",
            opacity: i === imgIdx ? 1 : 0,
          }} />
        ))}

        {/* Bottom gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(20,10,5,0.5) 0%, transparent 50%)", pointerEvents: "none" }} />

        {/* Drag affordance — appears on hover */}
        {hovered && !isDragging && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "10px 12px",
            background: "linear-gradient(to bottom, rgba(20,10,5,0.55), transparent)",
            display: "flex", alignItems: "center", gap: 6,
            animation: "fadeIn 0.15s ease",
          }}>
            <svg width="10" height="14" viewBox="0 0 10 14" fill="rgba(255,255,255,0.75)">
              <circle cx="2.5" cy="2.5" r="1.5"/>
              <circle cx="7.5" cy="2.5" r="1.5"/>
              <circle cx="2.5" cy="7" r="1.5"/>
              <circle cx="7.5" cy="7" r="1.5"/>
              <circle cx="2.5" cy="11.5" r="1.5"/>
              <circle cx="7.5" cy="11.5" r="1.5"/>
            </svg>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: 0.5 }}>
              DRAG TO ROOM
            </span>
          </div>
        )}

        {/* Category chip — bottom left */}
        <div style={{
          position: "absolute", bottom: 10, left: 10,
          padding: "2px 8px", borderRadius: 4,
          background: "rgba(20,10,5,0.62)", backdropFilter: "blur(6px)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.92)",
        }}>
          {property.category}
        </div>

        {/* Photo nav dots — bottom right */}
        {property.images.length > 1 && (
          <div style={{ position: "absolute", bottom: 12, right: 42, display: "flex", gap: 3 }}>
            {property.images.map((_, i) => (
              <div key={i}
                onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                style={{ width: i === imgIdx ? 14 : 4, height: 4, borderRadius: 2, background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer", transition: "width 0.2s" }}
              />
            ))}
          </div>
        )}

        {/* Save button — bottom right */}
        <button
          onClick={onSave}
          title={saved ? "Remove" : "Save"}
          style={{
            position: "absolute", bottom: 8, right: 8,
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: saved ? B.gold : "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            transition: "background 0.2s, transform 0.15s",
            transform: hovered ? "scale(1.05)" : "scale(1)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24"
            fill={saved ? "#fff" : "none"} stroke={saved ? "#fff" : B.ink}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Info ── */}
      <div style={{ height: INFO_HEIGHT, flexShrink: 0, padding: "11px 13px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>

        {/* Row 1: title + price */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 500, color: B.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {property.title}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {property.location}
            </div>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 400, color: B.gold, flexShrink: 0, lineHeight: 1.2 }}>
            {property.price}
          </div>
        </div>

        {/* Row 2: stats */}
        <div style={{ display: "flex", alignItems: "center", background: "rgba(166,124,61,0.05)", borderRadius: 6, padding: "5px 0" }}>
          {[
            [property.beds, "BD"],
            [property.baths, "BA"],
            [property.sqft.toLocaleString(), "SF"],
            [property.yearBuilt, "YR"],
          ].map(([v, l], i, arr) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${B.border}` : "none" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: B.ink, lineHeight: 1 }}>{v}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: B.muted, marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Row 3: tags + amenity icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
          {property.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 500,
              padding: "2px 7px", borderRadius: 4,
              border: `1px solid ${B.border}`,
              background: "rgba(166,124,61,0.04)",
              color: B.muted, whiteSpace: "nowrap", flexShrink: 0,
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80,
            }}>{tag}</span>
          ))}
          {amenities.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 3, flexShrink: 0 }}>
              {amenities.map(a => <span key={a} style={{ fontSize: 12 }}>{a}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
