import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
const IMG_H = 192;

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user }  = useAuth();
  const nav       = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────
  const [profile,       setProfile]      = useState(null);
  const [rooms,         setRooms]        = useState([]);
  const [roomMeta,      setRoomMeta]     = useState({});
  const [savedIds,      setSavedIds]     = useState([]);
  const [selected,      setSelected]     = useState(null);
  const [filter,        setFilter]       = useState("all");
  const [category,      setCategory]     = useState("All");
  const [maxPrice,      setMaxPrice]     = useState(5000);
  const [minBeds,       setMinBeds]      = useState(0);
  const [minBaths,      setMinBaths]     = useState(0);
  const [petOnly,       setPetOnly]      = useState(false);
  const [parkingReq,    setParkingReq]   = useState(false);
  const [laundryReq,    setLaundryReq]   = useState(false);
  const [sortBy,        setSortBy]       = useState("default");
  const [showFilters,   setShowFilters]  = useState(false);
  const [showRooms,     setShowRooms]    = useState(false);
  const [loading,       setLoading]      = useState(true);
  const [joinCode,      setJoinCode]     = useState("");
  const [joinErr,       setJoinErr]      = useState("");
  const [busy,          setBusy]         = useState(false);
  const [dragging,      setDragging]     = useState(false);
  const [draggedPropId, setDraggedPropId] = useState(null);
  const [dragOverRoom,  setDragOverRoom]  = useState(null);
  const [justAdded,     setJustAdded]    = useState({});

  // Refs for custom drag system
  const dragRef      = useRef({ active: false, propId: null, startX: 0, startY: 0, ghost: null });
  const roomCardRefs = useRef({});   // roomId → DOM node
  const ghostRef     = useRef(null);

  // ── Data fetch ───────────────────────────────────────────────────────────
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

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = PROPERTIES.filter(p => {
      if (filter === "saved" && !savedIds.includes(p.id)) return false;
      if (category !== "All" && p.category !== category) return false;
      if (p.priceNum > maxPrice) return false;
      if (minBeds  > 0 && p.beds  < minBeds)  return false;
      if (minBaths > 0 && p.baths < minBaths) return false;
      if (petOnly    && !p.petFriendly) return false;
      if (parkingReq && !p.parking)    return false;
      if (laundryReq && p.laundry !== "In-unit") return false;
      return true;
    });
    if      (sortBy === "price-asc")  list = [...list].sort((a, b) => a.priceNum - b.priceNum);
    else if (sortBy === "price-desc") list = [...list].sort((a, b) => b.priceNum - a.priceNum);
    else if (sortBy === "newest")     list = [...list].sort((a, b) => b.yearBuilt - a.yearBuilt);
    else if (sortBy === "largest")    list = [...list].sort((a, b) => b.sqft - a.sqft);
    return list;
  }, [filter, category, maxPrice, minBeds, minBaths, petOnly, parkingReq, laundryReq, sortBy, savedIds]);

  const activeFilters = [
    maxPrice < 5000, minBeds > 0, minBaths > 0,
    petOnly, parkingReq, laundryReq, sortBy !== "default",
  ].filter(Boolean).length;

  const mapSwipes = useMemo(() => {
    const s = {};
    savedIds.forEach(id => { s[id] = "like"; });
    return s;
  }, [savedIds]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
      const room  = await createRoom(code, user.id);
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

  function resetFilters() {
    setMaxPrice(5000);
    setMinBeds(0); setMinBaths(0);
    setPetOnly(false); setParkingReq(false); setLaundryReq(false);
    setSortBy("default");
  }

  // ── Custom mouse-drag system ──────────────────────────────────────────────
  const cleanupDrag = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    dragRef.current.active = false;
    dragRef.current.propId = null;
    setDragging(false);
    setDraggedPropId(null);
    setDragOverRoom(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, []); // eslint-disable-line

  const handleMouseMove = useCallback((e) => {
    const dr = dragRef.current;
    if (!dr.propId) return;

    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Initiate drag after 6px movement threshold
    if (!dr.active && dist > 6) {
      dr.active = true;
      setDragging(true);
      setDraggedPropId(dr.propId);
      setShowRooms(true); // Auto-open rooms panel

      // Create drag ghost — tall vertical card with large photo
      const ghost = document.createElement("div");
      ghost.style.cssText = `
        position: fixed; z-index: 9999; pointer-events: none;
        width: 168px; border-radius: 16px; overflow: hidden;
        background: #fff;
        border: 1.5px solid rgba(166,124,61,0.55);
        box-shadow: 0 20px 56px rgba(40,24,8,0.35), 0 4px 16px rgba(40,24,8,0.15);
        transform: rotate(3deg) scale(1.05);
        animation: pop 0.15s ease;
        opacity: 0.97;
      `;
      const prop = PROPERTIES.find(p => p.id === dr.propId);
      if (prop) {
        const perPerson = prop.priceNum ? `≈ $${Math.round(prop.priceNum / 3).toLocaleString()}/person` : "";
        ghost.innerHTML = `
          <div style="position:relative;height:120px;background:url(${prop.images[0]}) center/cover;flex-shrink:0;">
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(12,5,2,0.65) 0%,transparent 55%);"></div>
            <div style="position:absolute;top:8px;right:8px;padding:2px 7px;border-radius:4px;background:rgba(12,5,2,0.6);font-family:'DM Sans',sans-serif;font-size:7px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.92)">${prop.category}</div>
            <div style="position:absolute;bottom:8px;left:10px;">
              <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500;color:#fff;line-height:1">${prop.price}</div>
              ${perPerson ? `<div style="font-family:'DM Sans',sans-serif;font-size:8px;color:rgba(255,255,255,0.72);margin-top:1px">${perPerson}</div>` : ""}
            </div>
          </div>
          <div style="padding:9px 10px 8px;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:13.5px;font-weight:500;color:#2C1A0E;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${prop.title}</div>
            <div style="font-family:'DM Sans',sans-serif;font-size:9px;color:#8C7056;margin-top:3px;">${prop.beds}bd · ${prop.baths}ba · ${prop.sqft?.toLocaleString()}sf</div>
          </div>
          <div style="margin:0 10px 9px;padding:5px 8px;border-radius:7px;background:rgba(166,124,61,0.08);border:1px dashed rgba(166,124,61,0.4);text-align:center;">
            <span style="font-family:'DM Sans',sans-serif;font-size:8.5px;font-weight:700;color:#A67C3D;letter-spacing:1.1px;text-transform:uppercase;">Drop into a room</span>
          </div>
        `;
      }
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
    }

    if (dr.active && ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX - 84}px`;
      ghostRef.current.style.top  = `${e.clientY - 80}px`;
    }

    // Hit-test room cards
    let overRoom = null;
    for (const [roomId, el] of Object.entries(roomCardRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        overRoom = roomId;
        break;
      }
    }
    setDragOverRoom(overRoom);
  }, []);

  const handleMouseUp = useCallback(async (e) => {
    const dr = dragRef.current;
    if (!dr.active || !dr.propId) { cleanupDrag(); return; }

    // Find which room was dropped on
    let droppedRoom = null;
    for (const [roomId, el] of Object.entries(roomCardRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        droppedRoom = roomId;
        break;
      }
    }

    const propId = dr.propId;
    cleanupDrag();

    if (droppedRoom) {
      const room = rooms.find(r => r.id === droppedRoom);
      if (!room) return;
      // Optimistic update
      setRoomMeta(prev => {
        const cur = prev[room.id] || { memberCount: 0, propertyCount: 0, propIds: [] };
        if (cur.propIds.includes(propId)) return prev;
        return { ...prev, [room.id]: { ...cur, propertyCount: cur.propertyCount + 1, propIds: [...cur.propIds, propId] } };
      });
      setJustAdded(prev => ({ ...prev, [droppedRoom]: true }));
      setTimeout(() => setJustAdded(prev => { const n = { ...prev }; delete n[droppedRoom]; return n; }), 2200);
      try { await addPropertyToRoom(room.id, propId, user.id); }
      catch (err) {
        console.error("Add to room failed:", err);
        // rollback
        setRoomMeta(prev => {
          const cur = prev[room.id];
          if (!cur) return prev;
          return { ...prev, [room.id]: { ...cur, propertyCount: cur.propertyCount - 1, propIds: cur.propIds.filter(id => id !== propId) } };
        });
      }
    }
  }, [rooms, user, cleanupDrag]);

  const onCardMouseDown = useCallback((e, propId) => {
    if (e.button !== 0) return; // left button only
    dragRef.current = { active: false, propId, startX: e.clientX, startY: e.clientY, ghost: null };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: "100dvh", background: B.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid rgba(166,124,61,0.18)`, borderTopColor: B.gold, animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 12, height: 54,
        padding: "0 18px",
        background: "rgba(251,247,241,0.98)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0, zIndex: 60,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 6 }}>
          <LogoMark size={22} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, color: B.ink, letterSpacing: 0.3 }}>HomeBlend</span>
        </div>

        {/* Discover / Saved */}
        <div style={{ display: "flex", background: "rgba(166,124,61,0.07)", borderRadius: 8, padding: 3 }}>
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

        {/* Price slider — in header, matching screenshot */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, whiteSpace: "nowrap" }}>
            Up to <strong style={{ color: B.gold, fontWeight: 700 }}>${maxPrice.toLocaleString()}</strong>
          </span>
          <input type="range" min={1000} max={5000} step={100} value={maxPrice}
            onChange={e => setMaxPrice(+e.target.value)}
            style={{ accentColor: B.gold, width: 90, cursor: "pointer" }} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Rooms toggle button */}
        <button onClick={() => setShowRooms(v => !v)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 8,
          border: `1px solid ${showRooms ? B.gold : B.border}`,
          background: showRooms ? "rgba(166,124,61,0.08)" : "rgba(255,255,255,0.5)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: showRooms ? 600 : 500,
          color: showRooms ? B.gold : B.muted,
          cursor: "pointer", transition: "all 0.15s",
        }}>
          <Icon d={IC.home} size={13} color={showRooms ? B.gold : B.muted} sw={1.8} />
          Rooms
          {rooms.length > 0 && (
            <span style={{ padding: "1px 6px", borderRadius: 10, background: showRooms ? B.gold : "rgba(166,124,61,0.1)", fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: showRooms ? "#fff" : B.gold }}>{rooms.length}</span>
          )}
        </button>

        <div style={{ width: 1, height: 18, background: B.border }} />

        {/* User avatar + sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: profile?.avatar_color || B.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff",
            boxShadow: "0 2px 8px rgba(80,50,10,0.15)",
          }}>
            {(profile?.display_name || "?")[0].toUpperCase()}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.ink, fontWeight: 500 }}>
            {profile?.display_name}
          </span>
          <button onClick={async () => { await signOut(); nav("/auth", { replace: true }); }} style={{
            padding: "5px 12px", borderRadius: 7,
            border: `1px solid ${B.border}`, background: "transparent",
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted,
            cursor: "pointer",
          }}>Sign out</button>
        </div>
      </header>


      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Properties panel ──────────────────────────────────────────────── */}
        <div style={{ width: 262, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${B.border}`, overflow: "hidden" }}>

          {/* Sub-header: category chips + count */}
          <div style={{ padding: "9px 11px 8px", borderBottom: `1px solid ${B.border}`, flexShrink: 0, background: "rgba(251,247,241,0.9)" }}>
            {/* Category chips */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: "3px 9px", borderRadius: 12, border: "none",
                  background: category === cat ? B.gold : "rgba(166,124,61,0.08)",
                  color: category === cat ? "#FAF6EE" : B.muted,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
                  cursor: "pointer", transition: "all 0.15s",
                }}>{cat}</button>
              ))}
            </div>
            {/* Count + filter toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted }}>
                <strong style={{ color: B.ink }}>{filtered.length}</strong> {filtered.length === 1 ? "property" : "properties"}
                {dragging && <span style={{ marginLeft: 6, color: B.gold, fontWeight: 600, animation: "pulse 1.5s ease infinite" }}>· drop → room</span>}
              </div>
              <button onClick={() => setShowFilters(v => !v)} title="More filters" style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 7,
                border: `1px solid ${activeFilters > 0 ? B.gold : B.border}`,
                background: activeFilters > 0 ? "rgba(166,124,61,0.08)" : "transparent",
                color: activeFilters > 0 ? B.gold : B.muted,
                fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 500,
                cursor: "pointer",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
                </svg>
                {activeFilters > 0 ? `Filters · ${activeFilters}` : "Filters"}
              </button>
            </div>
          </div>

          {/* Compact filter dropdown (inside properties panel) */}
          {showFilters && (
            <div style={{ padding: "12px 11px 10px", borderBottom: `1px solid ${B.border}`, background: "rgba(251,247,241,0.95)", flexShrink: 0, animation: "fadeIn 0.18s ease" }}>
              {/* Beds */}
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Bedrooms</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[[0,"Any"],[1,"1+"],[2,"2+"],[3,"3+"]].map(([v, l]) => (
                    <button key={v} onClick={() => setMinBeds(v)} style={{ padding: "3px 9px", borderRadius: 7, border: `1px solid ${minBeds === v ? B.gold : B.border}`, background: minBeds === v ? "rgba(166,124,61,0.1)" : "transparent", color: minBeds === v ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: minBeds === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Baths */}
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Bathrooms</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[[0,"Any"],[1,"1+"],[2,"2+"],[2.5,"2.5+"]].map(([v, l]) => (
                    <button key={v} onClick={() => setMinBaths(v)} style={{ padding: "3px 9px", borderRadius: 7, border: `1px solid ${minBaths === v ? B.gold : B.border}`, background: minBaths === v ? "rgba(166,124,61,0.1)" : "transparent", color: minBaths === v ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: minBaths === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Amenities */}
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Amenities</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[[petOnly, setPetOnly, "Pets OK"],[parkingReq, setParkingReq, "Parking"],[laundryReq, setLaundryReq, "In-unit W/D"]].map(([active, setter, label]) => (
                    <button key={label} onClick={() => setter(v => !v)} style={{ padding: "3px 9px", borderRadius: 7, border: `1px solid ${active ? B.gold : B.border}`, background: active ? "rgba(166,124,61,0.1)" : "transparent", color: active ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
                  ))}
                </div>
              </div>
              {/* Sort */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Sort by</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {[["default","Best"],["price-asc","$ ↑"],["price-desc","$ ↓"],["newest","New"],["largest","Big"]].map(([v, l]) => (
                    <button key={v} onClick={() => setSortBy(v)} style={{ padding: "3px 9px", borderRadius: 7, border: `1px solid ${sortBy === v ? B.gold : B.border}`, background: sortBy === v ? "rgba(166,124,61,0.1)" : "transparent", color: sortBy === v ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: sortBy === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
              </div>
              {activeFilters > 0 && (
                <button onClick={resetFilters} style={{ padding: "3px 10px", borderRadius: 7, border: `1px solid ${B.border}`, background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, cursor: "pointer" }}>Reset all</button>
              )}
            </div>
          )}

          {/* Scrollable cards */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 11px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: "italic", color: B.muted }}>
                  {filter === "saved" ? "Nothing saved yet" : "No properties match"}
                </p>
                {activeFilters > 0 && (
                  <button onClick={resetFilters} style={{ marginTop: 12, padding: "6px 16px", borderRadius: 8, border: `1px solid ${B.border}`, background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, cursor: "pointer" }}>
                    Reset filters
                  </button>
                )}
              </div>
            ) : filtered.map(p => (
              <PropertyCard
                key={p.id}
                property={p}
                saved={savedIds.includes(p.id)}
                isDragging={draggedPropId === p.id}
                onSave={e => toggleSave(p.id, e)}
                onMouseDown={onCardMouseDown}
              />
            ))}
          </div>
        </div>

        {/* ── Map (fills remaining width) ───────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapPanel
            properties={filtered}
            swipes={mapSwipes}
            blendData={null}
            selectedProperty={selected}
            onSelect={p => setSelected(prev => prev?.id === p.id ? null : p)}
          />

          {/* Rooms toggle FAB (when panel is closed) */}
          {!showRooms && (
            <button
              onClick={() => setShowRooms(true)}
              style={{
                position: "absolute", bottom: 24, right: 24,
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 12,
                background: "rgba(251,247,241,0.96)", backdropFilter: "blur(16px)",
                border: `1px solid ${B.border}`,
                boxShadow: "0 4px 24px rgba(40,24,8,0.15)",
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink,
                cursor: "pointer", transition: "all 0.18s",
                animation: "slideUp 0.25s ease",
              }}
            >
              <Icon d={IC.home} size={14} color={B.gold} sw={1.8} />
              My Rooms
              {rooms.length > 0 && (
                <span style={{ padding: "1px 6px", borderRadius: 10, background: B.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>{rooms.length}</span>
              )}
            </button>
          )}
        </div>

        {/* ── Rooms slide-out panel (from right, overlays map) ──────────────── */}
        {showRooms && (
          <>
            {/* Backdrop click-away */}
            <div
              onClick={() => { if (!dragging) setShowRooms(false); }}
              style={{ position: "absolute", inset: 0, zIndex: 40 }}
            />
            <div style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 360,
              background: "rgba(251,247,241,0.98)", backdropFilter: "blur(20px)",
              borderLeft: `1px solid ${B.border}`,
              boxShadow: "-16px 0 60px rgba(40,24,8,0.15)",
              animation: "slideInR 0.28s cubic-bezier(.16,1,.3,1)",
              display: "flex", flexDirection: "column", zIndex: 45, overflow: "hidden",
            }}>
              {/* Rooms header */}
              <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 3 }}>Collaborative</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: B.ink }}>Your Rooms</div>
                  </div>
                  <button onClick={() => setShowRooms(false)} style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(166,124,61,0.08)", border: "none",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon d={IC.x} size={13} color={B.muted} sw={1.8} />
                  </button>
                </div>

                <button onClick={handleCreateRoom} disabled={busy} style={{
                  width: "100%", padding: "9px 0", borderRadius: 8,
                  background: busy ? "rgba(44,26,14,0.35)" : B.ink, border: "none", color: "#FAF6EE",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                  cursor: busy ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  marginBottom: 9, transition: "background 0.15s",
                }}>
                  <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2.2} />
                  Create Room
                </button>

                <form onSubmit={handleJoin} style={{ display: "flex", gap: 6 }}>
                  <input
                    value={joinCode}
                    onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(""); }}
                    placeholder="ROOM CODE"
                    maxLength={8}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 7,
                      border: `1px solid ${joinErr ? "#C0624A" : B.border}`,
                      background: "rgba(255,255,255,0.6)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink,
                      letterSpacing: 1.8, outline: "none", boxSizing: "border-box",
                    }}
                  />
                  <button type="submit" disabled={busy} style={{
                    padding: "8px 13px", borderRadius: 7,
                    border: `1px solid ${B.border}`, background: B.goldBg,
                    color: B.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}>Join</button>
                </form>
                {joinErr && <p style={{ margin: "5px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#C0624A" }}>{joinErr}</p>}
              </div>

              {/* Drag hint banner */}
              {dragging && (
                <div style={{
                  margin: "10px 14px 0", padding: "10px 14px",
                  borderRadius: 9, background: "rgba(166,124,61,0.1)", border: `1.5px dashed ${B.gold}`,
                  textAlign: "center", animation: "pulse 1.5s ease infinite",
                }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: B.gold, lineHeight: 1.5 }}>
                    Drop onto a room to add this property
                  </p>
                </div>
              )}

              {/* Room cards */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 24px", display: "flex", flexDirection: "column", gap: 9 }}>
                {rooms.length === 0 ? (
                  <div style={{ padding: "36px 16px", textAlign: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(166,124,61,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                      <Icon d={IC.home} size={18} color={B.gold} sw={1.5} />
                    </div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, lineHeight: 1.75 }}>
                      Create a room and invite roommates, then drag properties here to vote together.
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
                    setRef={el => { roomCardRefs.current[room.id] = el; }}
                    onOpen={() => nav(`/room/${room.room_code}`)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Room Drop Card ────────────────────────────────────────────────────────── */
function RoomDropCard({ room, meta = {}, isOver, isAdded, alreadyIn, draggingActive, setRef, onOpen }) {
  const thumbIds = (meta.propIds || []).slice(0, 4);
  return (
    <div
      ref={setRef}
      style={{
        borderRadius: 13,
        border: isOver
          ? `2px solid ${B.gold}`
          : isAdded
          ? `2px solid #4A7C59`
          : draggingActive
          ? `1.5px dashed rgba(166,124,61,0.45)`
          : `1px solid ${B.border}`,
        background: isOver
          ? "rgba(166,124,61,0.08)"
          : isAdded
          ? "rgba(74,124,89,0.07)"
          : draggingActive
          ? "rgba(255,255,255,0.9)"
          : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(10px)",
        padding: "14px 15px",
        cursor: draggingActive ? "copy" : "pointer",
        transition: "all 0.2s cubic-bezier(.16,1,.3,1)",
        position: "relative",
        overflow: "hidden",
        transform: isOver ? "scale(1.025)" : draggingActive ? "scale(1.005)" : "scale(1)",
        boxShadow: isOver
          ? `0 6px 28px rgba(166,124,61,0.22)`
          : isAdded
          ? `0 4px 20px rgba(74,124,89,0.14)`
          : draggingActive
          ? `0 4px 16px rgba(80,50,10,0.1)`
          : "0 1px 6px rgba(80,50,10,0.05)",
      }}
    >
      {/* Overlays */}
      {isOver && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, zIndex: 3, background: "rgba(251,247,241,0.85)", backdropFilter: "blur(6px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{alreadyIn ? "" : "+"}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: alreadyIn ? B.muted : B.gold }}>
              {alreadyIn ? "Already in room" : "Drop to add"}
            </div>
          </div>
        </div>
      )}
      {isAdded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, zIndex: 3, background: "rgba(245,252,248,0.92)", backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#4A7C59" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round" style={{ verticalAlign: "middle", marginRight: 5 }}><path d="M20 6L9 17l-5-5"/></svg>
              Added!
            </div>
          </div>
        </div>
      )}

      {/* Room info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 800, color: B.ink, letterSpacing: 2.5 }}>
          {room.room_code}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 7,
            background: B.goldBg, border: `1px solid ${B.border}`,
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: B.gold,
            cursor: "pointer",
          }}
        >
          Open <Icon d="M9 18l6-6-6-6" size={10} color={B.gold} sw={2.2} />
        </button>
      </div>

      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginBottom: thumbIds.length > 0 ? 9 : 0 }}>
        {meta.memberCount ?? 0} {meta.memberCount === 1 ? "member" : "members"}
        <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
        {meta.propertyCount ?? 0} {meta.propertyCount === 1 ? "property" : "properties"}
      </div>

      {/* Property thumbnails */}
      {thumbIds.length > 0 && (
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {thumbIds.map(pid => {
            const prop = PROPERTIES.find(p => p.id === pid);
            return prop ? (
              <div key={pid} title={prop.title} style={{
                width: 38, height: 30, borderRadius: 6, flexShrink: 0,
                background: `url(${prop.images[0]}) center/cover`,
                border: `1px solid rgba(166,124,61,0.15)`,
                boxShadow: "0 1px 5px rgba(0,0,0,0.08)",
              }} />
            ) : null;
          })}
          {(meta.propIds || []).length > 4 && (
            <div style={{ width: 38, height: 30, borderRadius: 6, background: B.goldBg, border: `1px solid ${B.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.gold, fontWeight: 700 }}>+{(meta.propIds || []).length - 4}</span>
            </div>
          )}
        </div>
      )}

      {/* Drop here indicator when dragging */}
      {draggingActive && !isOver && !isAdded && (
        <div style={{ marginTop: 10, padding: "6px 0", borderRadius: 7, border: `1.5px dashed rgba(166,124,61,0.3)`, textAlign: "center" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "rgba(166,124,61,0.55)" }}>
            Drop here
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Property Card ─────────────────────────────────────────────────────────── */
function PropertyCard({ property, saved, isDragging, onSave, onMouseDown }) {
  const [hovered,  setHovered]  = useState(false);
  const [imgIdx,   setImgIdx]   = useState(0);
  const [expanded, setExpanded] = useState(false);

  const amenities = [
    property.parking    && { icon: "🚗", label: property.parking },
    property.laundry    && { icon: "🧺", label: property.laundry },
    property.petFriendly ? { icon: "🐾", label: "Pets OK" } : null,
  ].filter(Boolean);

  const perPerson = property.priceNum
    ? `$${Math.round(property.priceNum / 3).toLocaleString()}/person`
    : null;

  return (
    <div
      onMouseDown={e => onMouseDown(e, property.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, overflow: "hidden", flexShrink: 0,
        display: "flex", flexDirection: "column",
        border: `1.5px solid ${hovered ? "rgba(166,124,61,0.4)" : "rgba(255,255,255,0.88)"}`,
        background: "#fff",
        boxShadow: isDragging
          ? "none"
          : hovered
          ? "0 10px 32px rgba(80,50,10,0.13)"
          : "0 2px 12px rgba(80,50,10,0.07)",
        opacity: isDragging ? 0.22 : 1,
        transform: hovered && !isDragging ? "translateY(-2px)" : "translateY(0)",
        transition: "border-color 0.18s, box-shadow 0.18s, opacity 0.18s, transform 0.18s",
        cursor: hovered ? "grab" : "default",
        userSelect: "none",
      }}
    >
      {/* ── Photo ── */}
      <div style={{ height: IMG_H, flexShrink: 0, position: "relative", overflow: "hidden", background: "#E8DED2" }}>
        {property.images.map((src, i) => (
          <img key={i} src={src} alt="" draggable={false} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transition: "opacity 0.35s", opacity: i === imgIdx ? 1 : 0,
          }} />
        ))}

        {/* Scrim gradients */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,5,2,0.55) 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,5,2,0.38) 0%, transparent 40%)", pointerEvents: "none" }} />

        {/* Drag grip banner */}
        {hovered && !isDragging && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            padding: "10px 13px", display: "flex", alignItems: "center", gap: 6,
            animation: "fadeIn 0.14s ease",
          }}>
            <DragDots />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.88)", letterSpacing: 1.2, textTransform: "uppercase" }}>
              Hold &amp; drag to room
            </span>
          </div>
        )}

        {/* Category badge — top right */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          padding: "3px 9px", borderRadius: 5,
          background: "rgba(12,5,2,0.58)", backdropFilter: "blur(6px)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700,
          letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.92)",
        }}>{property.category}</div>

        {/* Per-person price — bottom left */}
        <div style={{ position: "absolute", bottom: 10, left: 11 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{property.price}</div>
          {perPerson && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.72)", marginTop: 1 }}>
              ≈ {perPerson} split 3 ways
            </div>
          )}
        </div>

        {/* Photo dots */}
        {property.images.length > 1 && (
          <div style={{ position: "absolute", bottom: 13, right: 46, display: "flex", gap: 3 }}>
            {property.images.map((_, i) => (
              <div key={i}
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setImgIdx(i)}
                style={{ width: i === imgIdx ? 14 : 4, height: 4, borderRadius: 2, background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer", transition: "width 0.2s" }}
              />
            ))}
          </div>
        )}

        {/* Save heart */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onSave}
          title={saved ? "Unsave" : "Save"}
          style={{
            position: "absolute", bottom: 9, right: 9,
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: saved ? B.gold : "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
            transition: "background 0.2s, transform 0.15s",
            transform: hovered ? "scale(1.1)" : "scale(1)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={saved ? "#fff" : "none"} stroke={saved ? "#fff" : B.ink}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "13px 14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500, color: B.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {property.title}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
            {property.location}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "flex", background: "rgba(166,124,61,0.05)", borderRadius: 8, overflow: "hidden", border: `1px solid rgba(166,124,61,0.1)` }}>
          {[
            [property.beds,                 "Beds"],
            [property.baths,               "Baths"],
            [property.sqft?.toLocaleString(), "Sq Ft"],
            [property.yearBuilt,            "Built"],
          ].map(([v, l], i, arr) => (
            <div key={l} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRight: i < arr.length - 1 ? `1px solid rgba(166,124,61,0.12)` : "none" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: B.ink, lineHeight: 1 }}>{v}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: B.muted, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Amenity chips */}
        {amenities.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {amenities.map(a => (
              <span key={a.label} style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 9px", borderRadius: 6,
                background: "rgba(166,124,61,0.06)",
                border: `1px solid rgba(166,124,61,0.16)`,
                fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                <span style={{ fontSize: 11 }}>{a.icon}</span> {a.label}
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {property.tags.map(tag => (
            <span key={tag} style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 500,
              padding: "2px 8px", borderRadius: 4,
              border: `1px solid ${B.border}`, color: B.muted,
              whiteSpace: "nowrap",
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* ── AI Overview toggle ── */}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        style={{
          margin: "10px 14px 0",
          padding: "9px 13px", borderRadius: 9,
          border: `1px solid ${expanded ? B.gold : "rgba(166,124,61,0.22)"}`,
          background: expanded ? "rgba(166,124,61,0.06)" : "rgba(166,124,61,0.03)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "all 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={expanded ? B.gold : B.muted} stroke="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: expanded ? B.gold : B.muted }}>
            AI Overview
          </span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.muted, opacity: 0.7 }}>· {expanded ? "close" : "expand"}</span>
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={expanded ? B.gold : B.muted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.28s ease", flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* ── AI Overview panel ── */}
      <div style={{ maxHeight: expanded ? 700 : 0, overflow: "hidden", transition: "max-height 0.38s cubic-bezier(.16,1,.3,1)" }}>
        <div style={{ margin: "10px 14px 0" }}>

          {/* Photo strip */}
          {property.images.length > 1 && (
            <div style={{ display: "flex", gap: 5, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
              {property.images.map((src, i) => (
                <div key={i} style={{
                  height: 90, minWidth: i === 0 ? 160 : 120,
                  borderRadius: 9, flexShrink: 0,
                  background: `url(${src}) center/cover`,
                  border: `1px solid rgba(166,124,61,0.15)`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }} />
              ))}
              {property.images.length === 2 && (
                <div style={{ height: 90, minWidth: 100, borderRadius: 9, flexShrink: 0, background: "rgba(166,124,61,0.06)", border: `1px dashed rgba(166,124,61,0.25)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </div>
              )}
            </div>
          )}

          {/* AI text */}
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.8)", border: `1px solid rgba(166,124,61,0.14)`, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={B.gold} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.gold }}>AI Analysis</span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, lineHeight: 1.85, color: B.inkSoft, margin: 0 }}>
              {property.aiOverview}
            </p>
          </div>

          {/* Quick facts */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              ["🏠", property.category],
              ["📐", `${property.sqft?.toLocaleString()} sq ft`],
              ["🏗️", `Built ${property.yearBuilt}`],
              property.petFriendly && ["🐾", "Pet friendly"],
            ].filter(Boolean).map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 6, background: "rgba(166,124,61,0.06)", border: `1px solid rgba(166,124,61,0.14)` }}>
                <span style={{ fontSize: 11 }}>{icon}</span>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* External links */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[
              ["Zillow",          `https://www.zillow.com/homes/${encodeURIComponent(property.location)}_rb/`],
              ["Apartments.com",  `https://www.apartments.com/irvine-ca/`],
              ["Realtor.com",     `https://www.realtor.com/apartments/${encodeURIComponent(property.location.replace(", ", "_"))}`],
            ].map(([site, href]) => (
              <a key={site} href={href} target="_blank" rel="noopener noreferrer"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1, textAlign: "center",
                  padding: "7px 0", borderRadius: 7,
                  border: `1px solid ${B.border}`,
                  background: "rgba(255,255,255,0.7)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  color: B.muted, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = B.gold; e.currentTarget.style.color = B.gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.color = B.muted; }}
              >
                {site}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 14, flexShrink: 0 }} />
    </div>
  );
}

/* ── Drag Dots SVG ─────────────────────────────────────────────────────────── */
function DragDots() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="rgba(255,255,255,0.75)">
      <circle cx="2.5" cy="2.5"  r="1.5" />
      <circle cx="7.5" cy="2.5"  r="1.5" />
      <circle cx="2.5" cy="7"    r="1.5" />
      <circle cx="7.5" cy="7"    r="1.5" />
      <circle cx="2.5" cy="11.5" r="1.5" />
      <circle cx="7.5" cy="11.5" r="1.5" />
    </svg>
  );
}
