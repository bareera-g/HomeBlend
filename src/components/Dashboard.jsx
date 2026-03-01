import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { B, Icon, IC, LogoMark } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";
import {
  ensureProfile,
  fetchUserRooms, fetchSavedPropertyIds,
  saveProperty, unsaveProperty,
  createRoom, fetchRoom, joinRoom,
  fetchMembers, fetchRoomProperties,
  addPropertyToRoom,
} from "../lib/firebase.js";
import { PROPERTIES } from "../data/properties.js";
import { computeUniquePropertyImages } from "../lib/uniquePropertyImages.js";
import MapPanel from "./MapPanel.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import { DashboardSkeleton } from "./Skeleton.jsx";
import AddPropertiesDrawer from "./AddPropertiesDrawer.jsx";
import PropertyExpandModal from "./PropertyExpandModal.jsx";

function genCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
const CATEGORIES = ["All", "Apartment", "Condo", "Townhome", "Single Family"];
const IMG_H = 260;

/** Price steps: $100 at low end → $250 mid → $500 at high end; extends to $7k for luxury listings */
const PRICE_STEPS = [
  1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
  2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000,
];
function priceToIndex(p) {
  const idx = PRICE_STEPS.findIndex(s => s >= p);
  return idx >= 0 ? idx : PRICE_STEPS.length - 1;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, signOut }  = useAuth();
  const nav       = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────
  const [profile,       setProfile]      = useState(null);
  const [rooms,         setRooms]        = useState([]);
  const [roomMeta,      setRoomMeta]     = useState({});
  const [savedIds,      setSavedIds]     = useState([]);
  const [selected,      setSelected]     = useState(null);
  const [filter,        setFilter]       = useState("all");
  const [category,      setCategory]     = useState("All");
  const [maxPrice,      setMaxPrice]     = useState(7000);
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
  const [dbError,         setDbError]        = useState(null);
  const [showDbBanner,    setShowDbBanner]   = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName,     setNewRoomName]    = useState("");
  const [createdRoom,     setCreatedRoom]    = useState(null);   // { id, name, room_code } after creation
  const [showAddDrawerForRoomId, setShowAddDrawerForRoomId] = useState(null); // room id when opening Add Properties drawer
  const [codeCopied,      setCodeCopied]     = useState(false);
  const [pendingCreatePropertyId, setPendingCreatePropertyId] = useState(null); // when set, modal is for creating room with this property
  const [highlightedPropertyId, setHighlightedPropertyId] = useState(null);     // map-click → scroll to card & pulse highlight
  const [showLoader, setShowLoader] = useState(true);   // stays until bar completes after loading done
  const [expandedProperty, setExpandedProperty] = useState(null); // full-screen detail modal
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);  // header avatar popover
  const [leftCollapsed, setLeftCollapsed] = useState(false);    // left panel minimized
  const [selectedCity, setSelectedCity] = useState("All");       // city filter
  const [citySearch, setCitySearch] = useState("");             // city autocomplete query
  const [showCityPicker, setShowCityPicker] = useState(false);  // city dropdown open

  const avatarMenuRef = useRef(null);
  const cityPickerRef = useRef(null);

  const CREATE_NEW_ROOM_ID = "__create_new__";

  // Refs for custom drag system
  const dragRef         = useRef({ active: false, propId: null, startX: 0, startY: 0, ghost: null });
  const listenersRef    = useRef({ move: null, up: null });  // track exact handler refs for cleanup
  const roomCardRefs    = useRef({});   // roomId → DOM node
  const createNewRoomRef = useRef(null);
  const ghostRef        = useRef(null);
  const roomsListRef    = useRef(null);   // scrollable rooms list
  const scrollIntervalRef = useRef(null); // hover-to-scroll interval
  const roomMetaRef      = useRef(roomMeta); // keep fresh ref for drop handler
  roomMetaRef.current = roomMeta;
  const [roomScrollState, setRoomScrollState] = useState({ canScrollUp: false, canScrollDown: false });

  // Detect when room list overflows and update scroll position state (for conditional up/down arrows)
  useEffect(() => {
    const el = roomsListRef.current;
    if (!el) return;
    const check = () => {
      const overflow = el.scrollHeight > el.clientHeight;
      const canScrollUp = overflow && el.scrollTop > 4;
      const canScrollDown = overflow && el.scrollTop + el.clientHeight < el.scrollHeight - 4;
      setRoomScrollState(s => (s.canScrollUp !== canScrollUp || s.canScrollDown !== canScrollDown) ? { canScrollUp, canScrollDown } : s);
    };
    check();
    el.addEventListener("scroll", check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [dragging, rooms]);

  // Hover-to-scroll when dragging a property (find your room in a long list)
  const startRoomListScroll = useCallback((dir) => {
    if (scrollIntervalRef.current) return;
    scrollIntervalRef.current = setInterval(() => {
      const el = roomsListRef.current;
      if (el) el.scrollTop += dir * 4;
    }, 16);
  }, []);
  const stopRoomListScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (!dragging) stopRoomListScroll();
    return () => stopRoomListScroll();
  }, [dragging, stopRoomListScroll]);

  // ── Close avatar menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!showAvatarMenu) return;
    function handleClick(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setShowAvatarMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAvatarMenu]);

  // ── Data fetch (with minimum display time for fake progress bar) ──────────
  const MIN_LOADING_MS = 1000;
  useEffect(() => {
    if (!user) return;
    const start = Date.now();
    async function buildRoomMeta(roomList) {
      const meta = {};
      await Promise.all(roomList.map(async room => {
        const [m, rp] = await Promise.all([fetchMembers(room.id), fetchRoomProperties(room.id)]);
        meta[room.id] = { memberCount: m.length, propertyCount: rp.length, propIds: rp.map(x => x.property_id) };
      }));
      return meta;
    }
    async function init() {
      setLoading(true);
      try {
        const p = await ensureProfile(user.id, user.email?.split("@")[0]);
        setProfile(p || { display_name: user.email?.split("@")[0] || "You", avatar_color: "#A67C3D" });
        const [r, s] = await Promise.all([
          fetchUserRooms(user.id),
          fetchSavedPropertyIds(user.id),
        ]);
        setRooms(r);
        setSavedIds(s);
        if (r.length > 0) {
          setRoomMeta(await buildRoomMeta(r));
        }
      } catch (e) {
        console.error("[HomeBlend] Init error:", e);
        setDbError(e.message);
        setShowDbBanner(true);
        setProfile({ display_name: user.email?.split("@")[0] || "You", avatar_color: "#A67C3D" });
      } finally {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => setLoading(false), remaining);
      }
    }
    init();
  }, [user]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setShowLoader(false), 350); // let bar complete to 100%
      return () => clearTimeout(t);
    }
    setShowLoader(true);
  }, [loading]);



  // ── City list derived from all properties ──────────────────────────────────
  const allCities = useMemo(() => {
    const set = new Set(PROPERTIES.map(p => p.location));
    return ["All", ...Array.from(set).sort()];
  }, []);

  // Close city picker on outside click
  useEffect(() => {
    if (!showCityPicker) return;
    const handler = (e) => {
      if (cityPickerRef.current && !cityPickerRef.current.contains(e.target)) setShowCityPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCityPicker]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = PROPERTIES.filter(p => {
      if (selectedCity !== "All" && p.location !== selectedCity) return false;
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
  }, [filter, category, maxPrice, minBeds, minBaths, petOnly, parkingReq, laundryReq, sortBy, savedIds, selectedCity]);

  const uniqueImageUrls = useMemo(() => computeUniquePropertyImages(filtered), [filtered]);

  const activeFilters = [
    maxPrice < PRICE_STEPS.at(-1), minBeds > 0, minBaths > 0,
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

  async function handleCreateRoom(roomName) {
    const name = (roomName || "").trim() || `Room ${rooms.length + 1}`;
    setBusy(true);
    try {
      let room;
      try {
        room = await createRoom(name, user.id, profile?.display_name || user.email?.split("@")[0] || "Me", profile?.avatar_color || "#A67C3D");
        await joinRoom(room.id, user.id, profile?.display_name || user.email?.split("@")[0] || "Me", profile?.avatar_color || "#A67C3D");
      } catch (error_) {
        const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.warn("[HomeBlend] DB error creating room:", error_.message);
        room = { id: `local-${fallbackCode}`, name, room_code: fallbackCode, created_by: user.id, local: true };
        setShowDbBanner(true);
        setDbError(error_.message);
      }
      setRooms(prev => [{ id: room.id, name: room.name || name, room_code: room.room_code, created_by: user.id, local: room.local }, ...prev]);
      setRoomMeta(prev => ({ ...prev, [room.id]: { memberCount: 1, propertyCount: 0, propIds: [] } }));
      setCreatedRoom({ id: room.id, name: room.name || name, room_code: room.room_code });
      setNewRoomName("");
    } catch (error_) {
      console.error("[HomeBlend] createRoom unexpected error:", error_);
    } finally { setBusy(false); }
  }

  async function handleCreateRoomWithProperty(roomName, propertyId) {
    const name = (roomName || "").trim() || `Room ${rooms.length + 1}`;
    setBusy(true);
    try {
      let room;
      try {
        room = await createRoom(name, user.id, profile?.display_name || user.email?.split("@")[0] || "Me", profile?.avatar_color || "#A67C3D");
        await joinRoom(room.id, user.id, profile?.display_name || user.email?.split("@")[0] || "Me", profile?.avatar_color || "#A67C3D");
        try {
          await addPropertyToRoom(room.id, propertyId, user.id);
        } catch (error_) {
          console.warn("[HomeBlend] addPropertyToRoom failed:", error_.message);
        }
      } catch (error_) {
        const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        console.warn("[HomeBlend] DB error creating room:", error_.message);
        room = { id: `local-${fallbackCode}`, name, room_code: fallbackCode, created_by: user.id, local: true };
        setShowDbBanner(true);
        setDbError(error_.message);
      }
      setRooms(prev => [{ id: room.id, name: room.name || name, room_code: room.room_code, created_by: user.id, local: room.local }, ...prev]);
      setRoomMeta(prev => ({ ...prev, [room.id]: { memberCount: 1, propertyCount: 1, propIds: [Number(propertyId)] } }));
      setCreatedRoom({ id: room.id, name: room.name || name, room_code: room.room_code });
      setNewRoomName("");
      setPendingCreatePropertyId(null);
    } catch (e) {
      console.error("[HomeBlend] createRoomWithProperty unexpected error:", e);
    } finally { setBusy(false); }
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
    setCategory("All");
    setMaxPrice(7000);
    setMinBeds(0); setMinBaths(0);
    setPetOnly(false); setParkingReq(false); setLaundryReq(false);
    setSortBy("default");
  }

  // ── Custom mouse-drag system ──────────────────────────────────────────────

  /** Hit-test: check if (x,y) is over the create-new zone or any room card */
  function hitTestRoomCards(x, y) {
    const createEl = createNewRoomRef.current;
    if (createEl) {
      const rect = createEl.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return CREATE_NEW_ROOM_ID;
      }
    }
    for (const [roomId, el] of Object.entries(roomCardRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return roomId;
      }
    }
    return null;
  }

  /** Build drag ghost DOM element for a property */
  function buildDragGhost(propId) {
    const ghost = document.createElement("div");
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      width: 168px; border-radius: 16px; overflow: hidden;
      background: #fff;
      border: 1.5px solid rgba(167,146,119,0.55);
      box-shadow: 0 20px 56px rgba(40,24,8,0.35), 0 0 0 2px rgba(167,146,119,0.4);
      transform: rotate(3deg) scale(1.05);
      animation: pop 0.15s ease;
      opacity: 0.97;
    `;
    const prop = PROPERTIES.find(p => p.id === propId);
    if (prop) {
      ghost.innerHTML = `
        <div style="position:relative;height:120px;background:url(${prop.images[0]}) center/cover;flex-shrink:0;">
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(12,5,2,0.65) 0%,transparent 55%);"></div>
          <div style="position:absolute;top:8px;right:8px;padding:2px 7px;border-radius:4px;background:rgba(12,5,2,0.6);font-family:'DM Sans',sans-serif;font-size:7px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.92)">${prop.category}</div>
          <div style="position:absolute;bottom:8px;left:10px;">
            <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:400;color:#fff;line-height:1">${prop.price}</div>
          </div>
        </div>
        <div style="padding:9px 10px 8px;">
          <div style="font-family:'Cormorant Garamond',serif;font-size:13.5px;font-weight:400;color:#2C1A0E;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${prop.title}</div>
          <div style="font-family:'DM Sans',sans-serif;font-size:9px;color:#8C7056;margin-top:3px;">${prop.beds}bd · ${prop.baths}ba · ${prop.sqft?.toLocaleString()}sf</div>
        </div>
        <div style="margin:0 10px 9px;padding:5px 8px;border-radius:7px;background:rgba(166,124,61,0.08);border:1px dashed rgba(166,124,61,0.4);text-align:center;">
          <span style="font-family:'DM Sans',sans-serif;font-size:8.5px;font-weight:700;color:#A67C3D;letter-spacing:1.1px;text-transform:uppercase;">Drop into a room</span>
        </div>
      `;
    }
    return ghost;
  }

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
    // Remove the exact handler refs that were added (avoids stale-closure leak)
    if (listenersRef.current.move) globalThis.removeEventListener("mousemove", listenersRef.current.move);
    if (listenersRef.current.up)   globalThis.removeEventListener("mouseup",   listenersRef.current.up);
    listenersRef.current = { move: null, up: null };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const dr = dragRef.current;
    if (!dr.propId) return;

    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    const dist = Math.hypot(dx, dy);

    // Initiate drag after 6px movement threshold
    if (!dr.active && dist > 6) {
      dr.active = true;
      setDragging(true);
      setDraggedPropId(dr.propId);
      setShowRooms(true); // Auto-open rooms panel

      const ghost = buildDragGhost(dr.propId);
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
    }

    if (dr.active && ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX - 84}px`;
      ghostRef.current.style.top  = `${e.clientY - 80}px`;
    }

    setDragOverRoom(hitTestRoomCards(e.clientX, e.clientY));
  }, []);

  const handleMouseUp = useCallback(async (e) => {
    const dr = dragRef.current;
    if (!dr.active || !dr.propId) {
      // No drag occurred → treat as click to expand property
      if (dr.propId) {
        const clicked = PROPERTIES.find(p => p.id === dr.propId);
        if (clicked) setExpandedProperty(clicked);
      }
      cleanupDrag();
      return;
    }

    const droppedRoom = hitTestRoomCards(e.clientX, e.clientY);
    const propId = dr.propId;
    cleanupDrag();

    // Drop on "Create new room" zone → open modal to name room, then create with property
    if (droppedRoom === CREATE_NEW_ROOM_ID) {
      setPendingCreatePropertyId(propId);
      setNewRoomName("");
      setShowCreateModal(true);
      return;
    }

    if (!droppedRoom) return;
    const room = rooms.find(r => r.id === droppedRoom);
    if (!room) return;

    // If property is already in this room, silently do nothing
    const existing = roomMetaRef.current[room.id]?.propIds || [];
    if (existing.includes(propId)) return;

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
      setRoomMeta(prev => {
        const cur = prev[room.id];
        if (!cur) return prev;
        return { ...prev, [room.id]: { ...cur, propertyCount: cur.propertyCount - 1, propIds: cur.propIds.filter(id => id !== propId) } };
      });
    }
  }, [rooms, user, cleanupDrag]);

  const onCardMouseDown = useCallback((e, propId) => {
    if (e.button !== 0) return; // left button only
    // Clean up any leaked listeners from a previous interaction
    if (listenersRef.current.move) globalThis.removeEventListener("mousemove", listenersRef.current.move);
    if (listenersRef.current.up)   globalThis.removeEventListener("mouseup",   listenersRef.current.up);
    dragRef.current = { active: false, propId, startX: e.clientX, startY: e.clientY, ghost: null };
    listenersRef.current = { move: handleMouseMove, up: handleMouseUp };
    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  const handleAddPropertyFromDrawer = useCallback(async (roomId, propertyId) => {
    if (!roomId || !user) return;
    const propId = Number(propertyId);
    setRoomMeta(prev => {
      const cur = prev[roomId] || { memberCount: 0, propertyCount: 0, propIds: [] };
      if (cur.propIds.includes(propId)) return prev;
      return { ...prev, [roomId]: { ...cur, propertyCount: cur.propertyCount + 1, propIds: [...cur.propIds, propId] } };
    });
    try {
      await addPropertyToRoom(roomId, propId, user.id);
    } catch (err) {
      console.error("[HomeBlend] Add property to room failed:", err);
      setRoomMeta(prev => {
        const cur = prev[roomId];
        if (!cur) return prev;
        return { ...prev, [roomId]: { ...cur, propertyCount: cur.propertyCount - 1, propIds: cur.propIds.filter(id => id !== propId) } };
      });
    }
  }, [user]);

  // When a property is selected from the map: switch to Discover, scroll to it, highlight ~2s
  const handleMapPropertySelect = useCallback((p) => {
    if (!p) return;
    setSelected(prev => (prev?.id === p.id ? null : p));
    if (selected?.id === p.id) return; // deselecting, nothing more to do
    setFilter("all");
    setCategory("All");
    setHighlightedPropertyId(p.id);
    setTimeout(() => {
      const el = document.getElementById(`property-card-${p.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

  useEffect(() => {
    if (!highlightedPropertyId) return;
    const t = setTimeout(() => setHighlightedPropertyId(null), 2200);
    return () => clearTimeout(t);
  }, [highlightedPropertyId]);

  // ── Loading (fake progress bar: fast start, slows near end; min 1s display) ─
  if (showLoader) return <DashboardSkeleton />;

  function modalTitle() {
    if (createdRoom) return "Room Created";
    if (pendingCreatePropertyId) return "Name Your New Room";
    return "Create a Room";
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>

      {/* ── Header (48px — logo left, avatar popover right) ─────────────── */}
      <header style={{
        display: "flex", alignItems: "center", gap: 12, height: 48,
        padding: "0 18px",
        background: "rgba(255,252,247,0.98)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0, zIndex: 60,
      }}>
        {/* Left — Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LogoMark size={22} />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, color: B.ink, letterSpacing: 0.3 }}>HomeBlend</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Right — Avatar (clicks toggle popover) */}
        <div style={{ position: "relative" }} ref={avatarMenuRef}>
          <button
            onClick={() => setShowAvatarMenu(v => !v)}
            style={{
              width: 32, height: 32, borderRadius: "50%",
              background: profile?.avatar_color || B.gold,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff",
              boxShadow: "0 2px 8px rgba(80,50,10,0.15)",
              border: showAvatarMenu ? `2px solid ${B.gold}` : "2px solid transparent",
              cursor: "pointer", transition: "border-color 0.15s",
            }}
            title={profile?.display_name}
          >
            {(profile?.display_name || "?")[0].toUpperCase()}
          </button>
          {showAvatarMenu && (
            <div style={{
              position: "absolute", top: 40, right: 0, width: 200,
              background: "#fff", borderRadius: 14,
              boxShadow: "0 12px 40px rgba(20,12,5,0.18)",
              border: `1px solid ${B.border}`,
              padding: "6px 0", zIndex: 100,
              animation: "fadeIn 0.14s ease",
            }}>
              <div style={{ padding: "8px 16px 8px", borderBottom: `1px solid ${B.border}` }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>{profile?.display_name}</div>
              </div>
              <button
                onClick={async () => { setShowAvatarMenu(false); await signOut(); nav("/auth", { replace: true }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  width: "100%", padding: "9px 16px", border: "none",
                  background: "transparent", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C0624A",
                  textAlign: "left",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>


      {/* ── DB Setup Banner ──────────────────────────────────────────────────── */}
      {showDbBanner && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 20px",
          background: "rgba(192,98,74,0.08)", borderBottom: "1px solid rgba(192,98,74,0.2)",
          flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C0624A" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="#C0624A"/>
          </svg>
          <div style={{ flex: 1 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 600, color: "#C0624A" }}>
              Database not set up.{" "}
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#8C5540" }}>
              Firestore database not reachable. Check your Firebase project settings and ensure Firestore is enabled.
              {dbError && <span style={{ display: "block", marginTop: 2, fontSize: 10, opacity: 0.8 }}>Error: {dbError}</span>}
            </span>
          </div>
          <button
            onClick={() => setShowDbBanner(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#C0624A", padding: 4, opacity: 0.6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Properties panel ──────────────────────────────────────────────── */}
        <div style={{ width: leftCollapsed ? 0 : 400, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: leftCollapsed ? "none" : `1px solid ${B.border}`, overflow: "hidden", transition: "width 0.25s ease" }}>

          {/* Sub-header: Discover/Saved toggle + location pill + count + filter (single row) */}
          <div style={{ padding: "8px 11px", borderBottom: `1px solid ${B.border}`, flexShrink: 0, background: "rgba(255,252,247,0.9)", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Discover / Saved segmented control (moved from header) */}
            <div style={{ display: "flex", background: "rgba(166,124,61,0.07)", borderRadius: 7, padding: 2, flexShrink: 0 }}>
              {[["all", "Discover"], ["saved", "Saved"]].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)} style={{
                  padding: "4px 10px", borderRadius: 5, border: "none",
                  background: filter === v ? "#fff" : "transparent",
                  boxShadow: filter === v ? "0 1px 4px rgba(80,50,10,0.08)" : "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  fontWeight: filter === v ? 600 : 400,
                  color: filter === v ? B.ink : B.muted,
                  cursor: "pointer", transition: "all 0.18s",
                }}>{l}</button>
              ))}
            </div>
            {/* Location pill — city picker */}
            <div ref={cityPickerRef} style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => { setShowCityPicker(v => !v); setCitySearch(""); }} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 10px 4px 7px", borderRadius: 14,
                background: selectedCity !== "All" ? "rgba(166,124,61,0.12)" : "rgba(167,146,119,0.1)",
                border: `1px solid ${selectedCity !== "All" ? B.gold : B.border}`, flexShrink: 0,
                cursor: "pointer", transition: "all 0.15s",
              }}>
                <Icon d={IC.pin} size={12} color={selectedCity !== "All" ? B.gold : B.muted} sw={1.6} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.ink, fontWeight: 500, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedCity === "All" ? "All Cities" : selectedCity}
                </span>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke={B.muted} strokeWidth="1.5" strokeLinecap="round"><polyline points="1,3 4,6 7,3" /></svg>
              </button>
              {showCityPicker && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                  width: 220, maxHeight: 280, background: "#fff", borderRadius: 10,
                  border: `1px solid ${B.border}`, boxShadow: "0 8px 24px rgba(44,26,14,0.12)",
                  display: "flex", flexDirection: "column", overflow: "hidden",
                  animation: "fadeIn 0.12s ease",
                }}>
                  <div style={{ padding: "8px 8px 4px" }}>
                    <input
                      autoFocus
                      value={citySearch}
                      onChange={e => setCitySearch(e.target.value)}
                      placeholder="Search city…"
                      style={{
                        width: "100%", padding: "6px 10px", borderRadius: 7,
                        border: `1px solid ${B.border}`, outline: "none",
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink,
                        background: "rgba(255,252,247,0.8)", boxSizing: "border-box",
                      }}
                      onFocus={e => e.target.style.borderColor = B.gold}
                      onBlur={e => e.target.style.borderColor = B.border}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                    {allCities
                      .filter(c => !citySearch || c.toLowerCase().includes(citySearch.toLowerCase()))
                      .map(city => (
                        <button key={city} onClick={() => { setSelectedCity(city); setShowCityPicker(false); setCitySearch(""); }} style={{
                          display: "block", width: "100%", padding: "7px 14px", border: "none", textAlign: "left",
                          background: city === selectedCity ? "rgba(166,124,61,0.08)" : "transparent",
                          fontFamily: "'DM Sans', sans-serif", fontSize: 11, cursor: "pointer",
                          color: city === selectedCity ? B.gold : B.ink,
                          fontWeight: city === selectedCity ? 600 : 400,
                          transition: "background 0.1s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(166,124,61,0.06)"}
                          onMouseLeave={e => e.currentTarget.style.background = city === selectedCity ? "rgba(166,124,61,0.08)" : "transparent"}
                        >
                          {city}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            {/* Count */}
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, whiteSpace: "nowrap" }}>
              <strong style={{ color: B.ink }}>{filtered.length}</strong> {filtered.length === 1 ? "property" : "properties"}
              {dragging && <span style={{ marginLeft: 4, color: B.gold, fontWeight: 600, animation: "pulse 1.5s ease infinite" }}>· drop → room</span>}
            </span>
            <div style={{ flex: 1 }} />
            {/* Filter button */}
            <button onClick={() => setShowFilters(v => !v)} title="More filters" style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 9px", borderRadius: 7, flexShrink: 0,
              border: `1px solid ${activeFilters > 0 ? B.gold : B.border}`,
              background: activeFilters > 0 ? "rgba(166,124,61,0.08)" : "transparent",
              color: activeFilters > 0 ? B.gold : B.muted,
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
              cursor: "pointer",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>
              </svg>
              {activeFilters > 0 ? `Filters · ${activeFilters}` : "Filters"}
            </button>
          </div>

          {/* Floating filter card (positioned over scroll list, not inline) */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {showFilters && (
            <div style={{
              position: "absolute", top: 4, right: 8, width: 340, zIndex: 50,
              padding: "16px 16px 14px", borderRadius: 16,
              background: "#fff", border: `1px solid ${B.border}`,
              boxShadow: "0 12px 40px rgba(20,12,5,0.16)",
              animation: "fadeIn 0.15s ease",
            }}>
              {/* 2-col: Type | Sort */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted, marginBottom: 6 }}>Type</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)} style={{
                        padding: "5px 10px", borderRadius: 7, border: `1px solid ${category === cat ? B.gold : B.border}`,
                        background: category === cat ? "rgba(166,124,61,0.1)" : "transparent",
                        color: category === cat ? B.gold : B.muted,
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: category === cat ? 700 : 400,
                        cursor: "pointer",
                      }}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted, marginBottom: 6 }}>Sort</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[["default","Best"],["price-asc","$ ↑"],["price-desc","$ ↓"],["newest","New"],["largest","Big"]].map(([v, l]) => (
                      <button key={v} onClick={() => setSortBy(v)} style={{
                        padding: "5px 10px", borderRadius: 7, border: `1px solid ${sortBy === v ? B.gold : B.border}`,
                        background: sortBy === v ? "rgba(166,124,61,0.1)" : "transparent",
                        color: sortBy === v ? B.gold : B.muted,
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: sortBy === v ? 700 : 400,
                        cursor: "pointer",
                      }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Max rent slider */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted }}>Max Rent</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: B.gold }}>${maxPrice.toLocaleString()}</span>
                </div>
                <input type="range" min={1000} max={7000} step={100} value={Math.min(maxPrice, 7000)}
                  onChange={e => setMaxPrice(+e.target.value)}
                  style={{ accentColor: B.gold, width: "100%", cursor: "pointer" }} />
              </div>
              {/* 2-col: Beds | Baths */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Beds</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[[0,"Any"],[1,"1+"],[2,"2+"],[3,"3+"]].map(([v, l]) => (
                      <button key={v} onClick={() => setMinBeds(v)} style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${minBeds === v ? B.gold : B.border}`, background: minBeds === v ? "rgba(166,124,61,0.1)" : "transparent", color: minBeds === v ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: minBeds === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted, marginBottom: 5 }}>Baths</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[[0,"Any"],[1,"1+"],[2,"2+"],[2.5,"2.5+"]].map(([v, l]) => (
                      <button key={v} onClick={() => setMinBaths(v)} style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${minBaths === v ? B.gold : B.border}`, background: minBaths === v ? "rgba(166,124,61,0.1)" : "transparent", color: minBaths === v ? B.gold : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: minBaths === v ? 700 : 400, cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Amenity icon toggles — 3 col */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {[[petOnly, setPetOnly, "🐾", "Pets"],[parkingReq, setParkingReq, "🚗", "Parking"],[laundryReq, setLaundryReq, "🧺", "W/D"]].map(([active, setter, emoji, label]) => (
                  <button key={label} onClick={() => setter(v => !v)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 0", borderRadius: 7,
                    border: `1px solid ${active ? B.gold : B.border}`,
                    background: active ? "rgba(166,124,61,0.1)" : "transparent",
                    color: active ? B.gold : B.muted,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                  }}>{emoji} {label}</button>
                ))}
              </div>
              {/* Reset */}
              {activeFilters > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={resetFilters} style={{ padding: "5px 14px", borderRadius: 7, border: `1px solid ${B.border}`, background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, cursor: "pointer" }}>Reset all</button>
                </div>
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
              <div key={p.id} id={`property-card-${p.id}`} style={{ scrollMargin: 12 }}>
                <PropertyCard
                  property={p}
                  saved={savedIds.includes(p.id)}
                  isDragging={draggedPropId === p.id}
                  isHighlighted={highlightedPropertyId === p.id}
                  onSave={e => toggleSave(p.id, e)}
                  onMouseDown={onCardMouseDown}
                  primaryImageUrl={uniqueImageUrls[p.id]}
                />
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Left panel collapse/expand nudge tab */}
        <button
          onClick={() => setLeftCollapsed(v => !v)}
          title={leftCollapsed ? "Show listings" : "Hide listings"}
          style={{
            position: "absolute", left: leftCollapsed ? 0 : 400, top: "50%", transform: "translateY(-50%)",
            zIndex: 20, width: 16, height: 48, border: "none", borderRadius: "0 6px 6px 0",
            background: "rgba(255,252,247,0.95)", cursor: "pointer",
            boxShadow: "2px 0 8px rgba(80,50,10,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "left 0.25s ease",
          }}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round">
            {leftCollapsed
              ? <polyline points="2,2 6,7 2,12" />
              : <polyline points="6,2 2,7 6,12" />}
          </svg>
        </button>

        {/* ── Map (fills remaining width) ───────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapPanel
            properties={filtered}
            swipes={mapSwipes}
            blendData={null}
            selectedProperty={selected}
            onSelect={handleMapPropertySelect}
            dragging={dragging}
            draggedPropId={draggedPropId}
            uniqueImageUrls={uniqueImageUrls}
            leftCollapsed={leftCollapsed}
          />
        </div>

        {/* ── Rooms panel + Donkey Brown pull tab (right side, single sliding unit) ───── */}
        <div
          style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width: 420,
            display: "flex", flexDirection: "row",
            transform: showRooms ? "translateX(0)" : "translateX(376px)",
            transition: "transform 0.32s cubic-bezier(.16,1,.3,1)",
            zIndex: 45, pointerEvents: "auto",
          }}
        >
          {/* Pull tab — Donkey Brown, large, attached to panel */}
          <button
            onClick={() => setShowRooms(v => !v)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              width: 44, flexShrink: 0,
              borderRadius: "14px 0 0 14px",
              background: "linear-gradient(180deg, #6B5344 0%, #5C4033 50%, #523829 100%)",
              border: "1px solid rgba(92,64,51,0.5)", borderRight: "none",
              boxShadow: "-6px 0 24px rgba(44,26,14,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              cursor: "pointer", padding: "12px 0",
              alignSelf: "center",
            }}
            title={showRooms ? "Close rooms" : "Open My Rooms"}
          >
            <Icon d={IC.home} size={18} color="#F5EDE4" sw={1.8} />
            <span style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11, fontWeight: 700,
              letterSpacing: 2.2, textTransform: "uppercase",
              color: "#F5EDE4", userSelect: "none",
            }}>My Rooms</span>

          </button>

          {/* Panel content */}
          <div style={{
            width: 376, flexShrink: 0,
            background: "rgba(251,247,241,0.98)", backdropFilter: "blur(20px)",
            borderLeft: `1px solid ${B.border}`,
            boxShadow: "-16px 0 60px rgba(40,24,8,0.15)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
              {/* Rooms header */}
              <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 2.2, textTransform: "uppercase", color: B.gold, marginBottom: 3 }}>Collaborative</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: B.ink }}>Your Rooms</div>
                  </div>
                  <button onClick={() => setShowRooms(false)} style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "rgba(166,124,61,0.08)", border: "none",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon d={IC.x} size={13} color={B.muted} sw={1.8} />
                  </button>
                </div>

                {/* Side-by-side Create + Join */}
                <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
                  <button onClick={() => { setCreatedRoom(null); setNewRoomName(""); setPendingCreatePropertyId(null); setShowCreateModal(true); }} disabled={busy} style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    background: busy ? "rgba(44,26,14,0.35)" : B.ink, border: "none", color: "#FAF6EE",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                    cursor: busy ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "background 0.15s",
                  }}>
                    <Icon d={IC.plus} size={13} color="#FAF6EE" sw={2.2} />
                    Create
                  </button>
                  <form onSubmit={handleJoin} style={{ flex: 1, display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${joinErr ? "#C0624A" : B.border}` }}>
                    <input
                      value={joinCode}
                      onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(""); }}
                      placeholder="CODE"
                      maxLength={8}
                      style={{
                        flex: 1, padding: "8px 8px", border: "none",
                        background: "rgba(255,255,255,0.6)",
                        fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink,
                        letterSpacing: 1.8, outline: "none", boxSizing: "border-box",
                        minWidth: 0,
                      }}
                    />
                    <button type="submit" disabled={busy} style={{
                      padding: "8px 12px", border: "none", borderLeft: `1px solid ${B.border}`,
                      background: B.goldBg,
                      color: B.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>Join</button>
                  </form>
                </div>
                {joinErr && <p style={{ margin: "0 0 4px", fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#C0624A" }}>{joinErr}</p>}
              </div>

              {/* Drag hint banner */}
              {dragging && (
                <p style={{
                  margin: "10px 14px 0", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted,
                  textAlign: "center", lineHeight: 1.5,
                }}>
                  Drop onto a room to add this property
                </p>
              )}

              {/* Room cards — list with hover-to-scroll when dragging */}
              <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {dragging && rooms.length > 0 && roomScrollState.canScrollUp && (
                  <button
                    onMouseEnter={() => startRoomListScroll(-1)}
                    onMouseLeave={stopRoomListScroll}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startRoomListScroll(-1); }}
                    onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') stopRoomListScroll(); }}
                    style={{
                      position: "absolute", left: 0, right: 0, top: 0, height: 32, zIndex: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "linear-gradient(180deg, rgba(251,247,241,0.95) 0%, transparent 100%)",
                      cursor: "n-resize", border: "none", padding: 0,
                    }}
                    title="Hover to scroll up"
                  >
                    <Icon d="M12 19V5M5 12l7-7 7 7" size={14} color={B.gold} sw={2} />
                  </button>
                )}
                <div
                  ref={roomsListRef}
                  style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px 24px", display: "flex", flexDirection: "column", gap: 9 }}
                >
                {/* Create new room drop zone — narrower + centered */}
                {dragging && (
                  <div
                    ref={createNewRoomRef}
                    style={{
                      flexShrink: 0, padding: "14px 15px", borderRadius: 13,
                      maxWidth: "90%", margin: "0 auto",
                      border: dragOverRoom === CREATE_NEW_ROOM_ID
                        ? `2px solid ${B.gold}`
                        : "1.5px dashed rgba(166,124,61,0.4)",
                      background: dragOverRoom === CREATE_NEW_ROOM_ID ? "rgba(166,124,61,0.12)" : "rgba(166,124,61,0.06)",
                      textAlign: "center", cursor: "copy",
                      transition: "all 0.2s ease",
                      boxShadow: "0 4px 16px rgba(80,50,10,0.1)",
                    }}
                  >
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: dragOverRoom === CREATE_NEW_ROOM_ID ? B.gold : "rgba(166,124,61,0.7)", marginBottom: 4 }}>
                      Create new room with this property
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.muted }}>
                      Drop here → name your room → we&apos;ll add the property
                    </div>
                  </div>
                )}
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
                    onOpen={() => {
                      if (room.local) {
                        setShowDbBanner(true);
                        alert("Firebase Firestore is not configured. Check your Firebase project settings.");
                      } else {
                        nav(`/room/${room.room_code}`);
                      }
                    }}
                  />
                ))}
                </div>
                {dragging && rooms.length > 0 && roomScrollState.canScrollDown && (
                  <button
                    onMouseEnter={() => startRoomListScroll(1)}
                    onMouseLeave={stopRoomListScroll}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startRoomListScroll(1); }}
                    onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') stopRoomListScroll(); }}
                    style={{
                      position: "absolute", left: 0, right: 0, bottom: 0, height: 48, zIndex: 2,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "linear-gradient(0deg, rgba(251,247,241,0.95) 0%, transparent 100%)",
                      cursor: "s-resize", border: "none", padding: 0,
                    }}
                    title="Hover to scroll down and find your room"
                  >
                    <Icon d="M12 5v14M5 12l7 7 7-7" size={16} color={B.gold} sw={2} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* ── Create Room Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) { setShowCreateModal(false); setCreatedRoom(null); setPendingCreatePropertyId(null); } }}
          onKeyDown={e => { if (e.key === 'Escape') { setShowCreateModal(false); setCreatedRoom(null); setPendingCreatePropertyId(null); } }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(16,10,4,0.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeInFast 0.18s ease",
          }}
        >
          <div style={{
            width: 420, borderRadius: 22,
            background: "linear-gradient(160deg,#FFFBF5 0%,#F8F1E6 100%)",
            boxShadow: "0 24px 80px rgba(16,10,4,0.28)",
            overflow: "hidden",
            animation: "slideUp 0.22s cubic-bezier(.16,1,.3,1)",
          }}>

            {/* Modal header */}
            <div style={{ padding: "22px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
                  Collaborative
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: B.ink }}>
                  {modalTitle()}
                </div>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setCreatedRoom(null); setPendingCreatePropertyId(null); }}
                style={{ marginTop: 4, width: 30, height: 30, borderRadius: "50%", background: "rgba(166,124,61,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Icon d={IC.x} size={13} color={B.muted} sw={1.8} />
              </button>
            </div>

            <div style={{ padding: "18px 24px 24px" }}>
              {createdRoom ? (
                /* ── Step 2: Show code + share ── */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "rgba(92,138,107,0.08)", border: "1.5px solid rgba(92,138,107,0.2)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#5C8A6B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF6EE" strokeWidth="2.2">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#5C8A6B" }}>{createdRoom.name} is ready</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 1 }}>Share the code below to invite roommates</div>
                    </div>
                  </div>

                  {/* Invite code display */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 6 }}>
                      Room Code
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        flex: 1, padding: "13px 16px", borderRadius: 10,
                        background: "rgba(255,255,255,0.8)", border: `1.5px solid ${B.border}`,
                        fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 800,
                        color: B.ink, letterSpacing: 5, textAlign: "center",
                      }}>
                        {createdRoom.room_code}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdRoom.room_code);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        }}
                        style={{
                          width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                          background: codeCopied ? "rgba(92,138,107,0.12)" : B.goldBg,
                          border: `1.5px solid ${codeCopied ? "rgba(92,138,107,0.3)" : B.gold + "44"}`,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.2s, border-color 0.2s",
                        }}
                        title="Copy code"
                      >
                        {codeCopied
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C8A6B" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        }
                      </button>
                    </div>
                    <p style={{ margin: "6px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, textAlign: "center" }}>
                      {codeCopied ? "Copied to clipboard!" : "Tap the copy icon or share the code manually"}
                    </p>
                  </div>

                  {/* Share via message */}
                  <button
                    onClick={() => {
                      const msg = `Join my HomeBlend room "${createdRoom.name}"! Use code: ${createdRoom.room_code}`;
                      if (navigator.share) {
                        navigator.share({ title: "HomeBlend Room Invite", text: msg }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(msg);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }
                    }}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 10,
                      background: "rgba(166,124,61,0.08)", border: `1.5px solid ${B.gold}33`,
                      color: B.gold, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Share Invite
                  </button>

                  <button
                    onClick={() => {
                      const roomId = createdRoom?.id;
                      setShowCreateModal(false);
                      setCreatedRoom(null);
                      setPendingCreatePropertyId(null);
                      if (roomId) setShowAddDrawerForRoomId(roomId);
                      setShowRooms(true);
                    }}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 10,
                      background: "rgba(166,124,61,0.12)", border: `1.5px solid ${B.gold}55`,
                      color: B.ink, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      marginBottom: 8,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add a property
                  </button>

                  <button
                    onClick={() => { setShowCreateModal(false); setCreatedRoom(null); setPendingCreatePropertyId(null); }}
                    style={{
                      width: "100%", padding: "10px 0", borderRadius: 10,
                      background: B.ink, border: "none", color: "#FAF6EE",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </>
              ) : (
                /* ── Step 1: Name the room ── */
                <>
                  <p style={{ margin: "0 0 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, lineHeight: 1.6 }}>
                    {pendingCreatePropertyId
                      ? `Create a new room with ${PROPERTIES.find(p => p.id === pendingCreatePropertyId)?.title || "this property"}. Give it a name and we'll add the property automatically.`
                      : "Give your room a name. You can invite roommates with the code once it's created."}
                  </p>
                  <input
                    autoFocus
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newRoomName.trim()) {
                        pendingCreatePropertyId ? handleCreateRoomWithProperty(newRoomName, pendingCreatePropertyId) : handleCreateRoom(newRoomName);
                      }
                    }}
                    placeholder="e.g. Irvine Summer Hunt"
                    maxLength={48}
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: 10,
                      border: `1.5px solid ${B.border}`,
                      background: "rgba(255,255,255,0.75)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.ink,
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => { e.target.style.borderColor = B.gold; }}
                    onBlur={e => { e.target.style.borderColor = B.border; }}
                  />
                  <button
                    onClick={() => pendingCreatePropertyId ? handleCreateRoomWithProperty(newRoomName, pendingCreatePropertyId) : handleCreateRoom(newRoomName)}
                    disabled={busy || !newRoomName.trim()}
                    style={{
                      marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 10,
                      background: (busy || !newRoomName.trim()) ? "rgba(44,26,14,0.25)" : B.ink,
                      border: "none", color: "#FAF6EE",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                      cursor: (busy || !newRoomName.trim()) ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      transition: "background 0.15s",
                    }}
                  >
                    {busy
                      ? <><ModalSpinner />Creating…</>
                      : <><Icon d={IC.plus} size={13} color="#FAF6EE" sw={2.2} />Create Room</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddDrawerForRoomId && (
        <AddPropertiesDrawer
          roomPropertyIds={roomMeta[showAddDrawerForRoomId]?.propIds || []}
          savedIds={savedIds}
          onAdd={(propertyId) => handleAddPropertyFromDrawer(showAddDrawerForRoomId, propertyId)}
          onClose={() => setShowAddDrawerForRoomId(null)}
        />
      )}

      {/* ── Full-screen expanded property modal ── */}
      {expandedProperty && (
        <PropertyExpandModal
          property={expandedProperty}
          saved={savedIds.includes(expandedProperty.id)}
          onSave={e => toggleSave(expandedProperty.id, e)}
          onClose={() => setExpandedProperty(null)}
        />
      )}
    </div>
  );
}

/* ── Room card style helpers (avoid nested ternaries) ─────────────────────── */
function roomCardBorder(isOver, isAdded, draggingActive) {
  if (isOver) return `2px solid ${B.gold}`;
  if (isAdded) return `2px solid #4A7C59`;
  if (draggingActive) return `2px dashed rgba(166,124,61,0.45)`;
  return `1px solid ${B.border}`;
}
function roomCardBg(isOver, isAdded, draggingActive) {
  if (isOver) return "rgba(166,124,61,0.08)";
  if (isAdded) return "rgba(74,124,89,0.07)";
  if (draggingActive) return "rgba(255,255,255,0.9)";
  return "rgba(255,255,255,0.72)";
}
function roomCardShadow(isOver, isAdded, draggingActive) {
  if (isOver) return `0 6px 28px rgba(166,124,61,0.22)`;
  if (isAdded) return `0 4px 20px rgba(74,124,89,0.14)`;
  if (draggingActive) return `0 4px 16px rgba(80,50,10,0.1)`;
  return "0 1px 6px rgba(80,50,10,0.05)";
}

/* ── Room Drop Card ────────────────────────────────────────────────────────── */
function RoomDropCard({ room, meta = {}, isOver, isAdded, alreadyIn, draggingActive, setRef, onOpen }) {
  const thumbIds = (meta.propIds || []).slice(0, 4);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      ref={setRef}
      onClick={() => { if (!draggingActive) onOpen(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        minHeight: (draggingActive || isOver) ? 130 : 120,
        borderRadius: 13,
        border: "none",
        borderLeft: isOver ? `4px solid ${B.gold}` : isAdded ? "4px solid #4A7C59" : `4px solid ${B.muted}`,
        background: roomCardBg(isOver, isAdded, draggingActive),
        backdropFilter: "blur(10px)",
        padding: (draggingActive || isOver) ? "14px 15px 22px" : "14px 15px",
        cursor: draggingActive ? "copy" : "pointer",
        transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.18s cubic-bezier(.34,1.56,.64,1)",
        position: "relative",
        overflow: "hidden",
        transform: hovered && !draggingActive ? "scale(1.025)" : "scale(1)",
        boxShadow: hovered && !draggingActive
          ? "0 6px 24px rgba(80,50,10,0.13)"
          : roomCardShadow(isOver, isAdded, draggingActive),
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

      {/* Room name (user-named) */}
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: B.ink, marginBottom: 4 }}>
        {room.name || `Room ${room.room_code}`}
      </div>

      {/* Room info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: B.muted, letterSpacing: 2 }}>
          {room.room_code}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2.2" strokeLinecap="round" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
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
        <div style={{ marginTop: 10, marginBottom: 12, padding: "6px 0", borderRadius: 7, border: `1.5px dashed rgba(166,124,61,0.3)`, textAlign: "center" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "rgba(166,124,61,0.55)" }}>
            Drop here
          </span>
        </div>
      )}
    </div>
  );
}

RoomDropCard.propTypes = {
  room: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    room_code: PropTypes.string,
  }).isRequired,
  meta: PropTypes.shape({
    memberCount: PropTypes.number,
    propertyCount: PropTypes.number,
    propIds: PropTypes.arrayOf(PropTypes.number),
  }),

  isOver: PropTypes.bool,
  isAdded: PropTypes.bool,
  alreadyIn: PropTypes.bool,
  draggingActive: PropTypes.bool,
  setRef: PropTypes.func,
  onOpen: PropTypes.func,
};

/* ── Property Card ─────────────────────────────────────────────────────────── */
function PropertyCard({ property, saved, isDragging, isHighlighted, onSave, onMouseDown, primaryImageUrl }) {
  const [hovered,   setHovered]   = useState(false);
  const [imgIdx,    setImgIdx]    = useState(0);
  const [expanded,  setExpanded]  = useState(false);
  const [arrowHov,  setArrowHov]  = useState(null); // "prev" | "next"
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  // Unique lead image + cap to 5 for perf
  const images = useMemo(() => {
    const base = primaryImageUrl
      ? [primaryImageUrl, ...property.images.filter(u => u !== primaryImageUrl)]
      : property.images;
    return base.slice(0, 5);
  }, [property.images, primaryImageUrl]);
  const totalImgs = images.length;

  // Track card visibility via IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setIsVisible(e.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-advance gallery — pauses while hovered or offscreen
  useEffect(() => {
    if (totalImgs <= 1 || hovered || !isVisible) return;
    const t = setInterval(() => setImgIdx(i => (i + 1) % totalImgs), 7000);
    return () => clearInterval(t);
  }, [hovered, totalImgs, isVisible]);

  function goTo(dir, e) {
    e.stopPropagation();
    setImgIdx(i => (i + dir + totalImgs) % totalImgs);
  }

  const amenities = [
    property.parking     && { icon: "parking", label: property.parking },
    property.laundry     && { icon: "laundry", label: property.laundry },
    property.petFriendly && { icon: "pet",     label: "Pets OK" },
  ].filter(Boolean);

  function cardBorderColor() {
    if (isHighlighted) return B.gold;
    if (hovered) return "rgba(166,124,61,0.4)";
    return "rgba(255,255,255,0.88)";
  }
  function cardBoxShadow() {
    if (isDragging) return "none";
    if (isHighlighted) return "0 0 0 2px rgba(166,124,61,0.35), 0 8px 28px rgba(166,124,61,0.2)";
    if (hovered) return "0 10px 32px rgba(80,50,10,0.13)";
    return "0 2px 12px rgba(80,50,10,0.07)";
  }

  return (
    <div
      ref={cardRef}
      onMouseDown={e => onMouseDown(e, property.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, overflow: "hidden", flexShrink: 0,
        display: "flex", flexDirection: "column",
        border: `1.5px solid ${cardBorderColor()}`,
        background: "#fff",
        boxShadow: cardBoxShadow(),
        opacity: isDragging ? 0.22 : 1,
        transform: hovered && !isDragging ? "translateY(-2px)" : "translateY(0)",
        transition: "border-color 0.18s, box-shadow 0.18s, opacity 0.18s, transform 0.18s",
        cursor: hovered ? "grab" : "default",
        userSelect: "none",
      }}
    >
      {/* ── Photo Gallery ── */}
      <div style={{ height: IMG_H, flexShrink: 0, position: "relative", overflow: "hidden", background: "#E8DED2" }}>

        {/* Slides — only render current + neighbors for perf */}
        {images.map((src, i) => {
          const show = i === imgIdx || i === (imgIdx + 1) % totalImgs || i === (imgIdx - 1 + totalImgs) % totalImgs;
          if (!show) return null;
          return (
            <img key={src} src={src} alt="" draggable={false} style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover",
              transition: "opacity 0.5s ease",
              opacity: i === imgIdx ? 1 : 0,
            }}
            onError={e => { e.target.style.display = "none"; }}
            />
          );
        })}

        {/* Gradient scrims */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,5,2,0.6) 0%, transparent 52%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,5,2,0.4) 0%, transparent 42%)", pointerEvents: "none" }} />

        {/* Drag grip top-left */}
        {hovered && !isDragging && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "10px 13px", display: "flex", alignItems: "center", gap: 6, animation: "fadeIn 0.14s ease" }}>
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
          fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600,
          letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.92)",
        }}>{property.category}</div>

        {/* ← Prev arrow */}
        {totalImgs > 1 && hovered && images.length > 0 && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => goTo(-1, e)}
            onMouseEnter={() => setArrowHov("prev")}
            onMouseLeave={() => setArrowHov(null)}
            style={{
              position: "absolute", left: 9, top: "50%",
              width: 30, height: 30, borderRadius: "50%", border: "none",
              background: arrowHov === "prev" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.78)",
              backdropFilter: "blur(8px)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
              transition: "background 0.15s, transform 0.15s",
              transform: `translateY(-50%) scale(${arrowHov === "prev" ? 1.12 : 1})`,
              animation: "fadeIn 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2C1A0E" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}

        {/* → Next arrow */}
        {totalImgs > 1 && hovered && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => goTo(1, e)}
            onMouseEnter={() => setArrowHov("next")}
            onMouseLeave={() => setArrowHov(null)}
            style={{
              position: "absolute", right: 9, top: "50%",
              width: 30, height: 30, borderRadius: "50%", border: "none",
              background: arrowHov === "next" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.78)",
              backdropFilter: "blur(8px)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
              transition: "background 0.15s, transform 0.15s",
              transform: `translateY(-50%) scale(${arrowHov === "next" ? 1.12 : 1})`,
              animation: "fadeIn 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2C1A0E" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Price badge — top left */}
        <div style={{
          position: "absolute", top: 10, left: 10,
          padding: "4px 10px", borderRadius: 7,
          background: "rgba(12,5,2,0.6)", backdropFilter: "blur(6px)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff",
        }}>{property.price}</div>

        {/* Dot indicators — bottom center-right */}
        {totalImgs > 1 && (
          <div role="tablist" style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, alignItems: "center" }}>
            {images.map((src, i) => (
              <button
                key={`dot-${src}`}
                aria-label={`Image ${i + 1}`}
                aria-selected={i === imgIdx}
                role="tab"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                style={{
                  width: i === imgIdx ? 18 : 5, height: 5, borderRadius: 3,
                  background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.48)",
                  cursor: "pointer",
                  transition: "width 0.25s ease, background 0.2s",
                  boxShadow: i === imgIdx ? "0 0 6px rgba(255,255,255,0.5)" : "none",
                  border: "none", padding: 0,
                }}
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
            width: 34, height: 34, borderRadius: "50%", border: "none",
            background: saved ? B.gold : "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
            transition: "background 0.2s, transform 0.15s",
            transform: hovered ? "scale(1.12)" : "scale(1)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={saved ? "#fff" : "none"} stroke={saved ? "#fff" : B.ink}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "13px 14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, color: B.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {property.title}
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, marginTop: 3 }}>
            {property.location}
          </div>
        </div>

        {/* Stats — inline separator text */}
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, fontWeight: 500 }}>
          {property.beds} bd<span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>{property.baths} ba<span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>{property.sqft ? property.sqft.toLocaleString() : "—"} sqft
        </div>

        {/* Amenity chips */}
        {amenities.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {amenities.map(a => (
              <span key={a.label} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 9px", borderRadius: 6,
                background: "rgba(166,124,61,0.06)",
                border: `1px solid rgba(166,124,61,0.16)`,
                fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                <AmenityIcon type={a.icon} size={11} /> {a.label}
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
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 5, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
              {images.map((src, i) => (
                <div key={src} style={{
                  height: 90, minWidth: i === 0 ? 160 : 120,
                  borderRadius: 9, flexShrink: 0,
                  background: `url(${src}) center/cover`,
                  border: `1px solid rgba(166,124,61,0.15)`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }} />
              ))}
              {images.length === 2 && (
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
              ["home",    property.category],
              ["sqft",    property.sqft ? `${property.sqft.toLocaleString()} sq ft` : null],
              ["built",   property.yearBuilt ? `Built ${property.yearBuilt}` : null],
              property.petFriendly && ["pet", "Pet friendly"],
            ].filter(Boolean).map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 6, background: "rgba(166,124,61,0.06)", border: `1px solid rgba(166,124,61,0.14)` }}>
                <QuickFactIcon type={icon} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* View Listing link */}
          {property.listingUrl && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <a href={property.listingUrl} target="_blank" rel="noopener noreferrer"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1, textAlign: "center",
                  padding: "7px 0", borderRadius: 7,
                  border: `1px solid ${B.gold}`,
                  background: "rgba(166,124,61,0.08)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  color: B.gold, textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  transition: "border-color 0.15s, color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(166,124,61,0.14)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(166,124,61,0.08)"; }}
              >
                View Listing
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 14, flexShrink: 0 }} />
    </div>
  );
}

PropertyCard.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.number,
    title: PropTypes.string,
    price: PropTypes.string,
    location: PropTypes.string,
    category: PropTypes.string,
    beds: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    baths: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    sqft: PropTypes.number,
    yearBuilt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    images: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
    aiOverview: PropTypes.string,
    petFriendly: PropTypes.bool,
    parking: PropTypes.string,
    laundry: PropTypes.string,
    listingUrl: PropTypes.string,
  }).isRequired,
  saved: PropTypes.bool,
  isDragging: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  onSave: PropTypes.func,
  onMouseDown: PropTypes.func,
  primaryImageUrl: PropTypes.string,
};

/* ── Amenity Icon (SVG, no emoji) ──────────────────────────────────────────── */
function AmenityIcon({ type, size = 12 }) {
  const w = size, h = size;
  if (type === "pet") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="4.5" cy="9.5" r="2"/><circle cx="9" cy="5" r="2"/>
        <circle cx="15" cy="5" r="2"/><circle cx="19.5" cy="9.5" r="2"/>
        <path d="M12 17.5c-3.5 0-7-2-7-5s3-4 7-4 7 1 7 4-3.5 5-7 5z"/>
      </svg>
    </span>
  );
  if (type === "parking") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
      </svg>
    </span>
  );
  if (type === "laundry") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2"/>
        <circle cx="12" cy="13" r="4"/>
        <line x1="6" y1="7" x2="6.01" y2="7"/>
        <line x1="9" y1="7" x2="9.01" y2="7"/>
      </svg>
    </span>
  );
  return null;
}
AmenityIcon.propTypes = {
  type: PropTypes.string.isRequired,
  size: PropTypes.number,
};

/* ── Quick Fact Icon (SVG, no emoji) ───────────────────────────────────────── */
function QuickFactIcon({ type }) {
  const w = 11, h = 11;
  if (type === "home") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </span>
  );
  if (type === "sqft") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
    </span>
  );
  if (type === "built") return (
    <span style={{ display: "inline-flex", flexShrink: 0 }}>
      <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    </span>
  );
  if (type === "pet") return <AmenityIcon type="pet" size={11} />;
  return null;
}
QuickFactIcon.propTypes = {
  type: PropTypes.string.isRequired,
};

/* ── Modal Spinner ──────────────────────────────────────────────────────────── */
function ModalSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite", marginRight: 5 }}>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
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
