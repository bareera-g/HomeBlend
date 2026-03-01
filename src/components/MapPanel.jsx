import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import PropTypes from "prop-types";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import { B, blendColor } from "../Brand.jsx";
import { computeUniquePropertyImages } from "../lib/uniquePropertyImages.js";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

/* ── Green area highlight helpers ──────────────────────────────────────────── */
function convexHull(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length <= 1) return s;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const hi = [];
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

function bufferHull(hull, pad) {
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad];
  });
}

const AREA_FILL = { id: "area-fill", type: "fill", paint: { "fill-color": "#4A7C59", "fill-opacity": 0.07 } };
const AREA_LINE = { id: "area-line", type: "line", paint: { "line-color": "#4A7C59", "line-width": 2, "line-opacity": 0.3, "line-dasharray": [4, 3] } };

const mapBtnStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, border: "none", background: "#fff",
  cursor: "pointer", padding: 0,
};

/** Pin uses assigned unique image only — no fallback; algorithm guarantees every property gets one. */
function getPinImageUrl(property, imageMap) {
  return imageMap?.[property.id] ?? null;
}

const PropertyMarker = memo(function PropertyMarker({ property, myVote, blendScore, isSelected, isDraggingHighlight, pinImageUrl, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const bc = blendScore == null ? null : blendColor(blendScore);
  function pinColor() {
    if (myVote === "like") return "#5C8A6B";
    if (myVote === "pass") return "#8B3A3A";
    if (bc) return bc.fg;
    return B.gold;
  }
  function pinScale() {
    if (isDraggingHighlight) return 1.55;
    if (isSelected) return 1.3;
    return 1;
  }
  function pinBoxShadow() {
    if (isSelected) return "0 0 0 3px rgba(92,138,107,0.35), 0 2px 10px rgba(92,138,107,0.2)";
    if (isDraggingHighlight) return "0 4px 20px rgba(166,124,61,0.25)";
    return "none";
  }
  const color = pinColor();
  const scale = pinScale();
  const showImg = pinImageUrl && !imgFailed;
  return (
    <Marker longitude={property.lng} latitude={property.lat} anchor="bottom" style={{ background: "none", border: "none", padding: 0 }} onClick={e => { e.originalEvent.stopPropagation(); onClick(property); }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer",
        transform: `scale(${scale})`, transformOrigin: "50% 100%",
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        filter: isDraggingHighlight ? "drop-shadow(0 0 14px rgba(166,124,61,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.15))" : undefined,
        background: "transparent",
      }}>
        {/* Circular image — no outer shadow/box to avoid square boundary */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", overflow: "hidden",
          background: showImg ? "transparent" : "#e8e2d8",
          border: isSelected
            ? "3px solid #5C8A6B"
            : "2px solid rgba(255,255,255,0.95)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: pinBoxShadow(),
          transition: "border 0.2s ease, box-shadow 0.2s ease",
        }}>
          {showImg ? (
            <img
              src={pinImageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", verticalAlign: "bottom" }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span style={{ color: B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>$</span>
          )}
        </div>
        {/* Price tag — rounded pill style */}
        <div style={{
          background: color, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
          padding: "5px 10px", whiteSpace: "nowrap",
          borderRadius: 10,
          borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}>
          {property.price || "—"}
        </div>
        {/* Pin pointer — softer, smaller */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "8px solid transparent", borderRight: "8px solid transparent",
          borderTop: `8px solid ${color}`,
          marginTop: -1,
        }} />
      </div>
    </Marker>
  );
});

PropertyMarker.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.string,
    lng: PropTypes.number,
    lat: PropTypes.number,
    price: PropTypes.string,
  }).isRequired,
  myVote: PropTypes.string,
  blendScore: PropTypes.number,
  isSelected: PropTypes.bool,
  isDraggingHighlight: PropTypes.bool,
  pinImageUrl: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};

export default function MapPanel({ properties, swipes, blendData, selectedProperty, onSelect, dragging = false, draggedPropId = null, uniqueImageUrls, leftCollapsed }) {
  const [viewport, setViewport] = useState({ longitude: -98.5, latitude: 39.0, zoom: 4 });
  const [bounds, setBounds] = useState(null); // { west, south, east, north }
  const mapRef = useRef(null);
  const computedUrls = useMemo(() => computeUniquePropertyImages(properties), [properties]);
  const imageMap = uniqueImageUrls && Object.keys(uniqueImageUrls).length > 0 ? uniqueImageUrls : computedUrls;

  /** Update viewport bounds from the map instance */
  const updateBounds = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    // Add a small buffer (~10% of viewport) so markers at edge don't pop in/out
    const lngSpan = b.getEast() - b.getWest();
    const latSpan = b.getNorth() - b.getSouth();
    const buf = 0.1;
    setBounds({
      west:  b.getWest()  - lngSpan * buf,
      south: b.getSouth() - latSpan * buf,
      east:  b.getEast()  + lngSpan * buf,
      north: b.getNorth() + latSpan * buf,
    });
  }, []);

  /* Auto-fit bounds when properties change */
  useEffect(() => {
    if (!mapRef.current || properties.length === 0) return;
    const map = mapRef.current.getMap?.();
    if (!map) return;
    const coords = properties.filter(p => p.lng && p.lat);
    if (coords.length === 0) return;
    const lngs = coords.map(p => p.lng);
    const lats = coords.map(p => p.lat);
    const sw = [Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05];
    const ne = [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05];
    try { map.fitBounds([sw, ne], { padding: 50, duration: 600 }); } catch {}
    // Update bounds after the fly animation settles
    const timer = setTimeout(updateBounds, 700);
    return () => clearTimeout(timer);
  }, [properties, updateBounds]);

  /* Resize map when container changes (e.g. left panel collapse) */
  useEffect(() => {
    const timer = setTimeout(() => {
      const map = mapRef.current?.getMap?.();
      if (map) { map.resize(); updateBounds(); }
    }, 300); // wait for CSS transition
    return () => clearTimeout(timer);
  }, [leftCollapsed, updateBounds]);

  /* Green area highlight — convex hull, only when properties are in a local area */
  const areaGeoJson = useMemo(() => {
    const coords = properties.filter(p => p.lng && p.lat).map(p => [p.lng, p.lat]);
    if (coords.length < 3) return null;
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    if (lngSpread > 1 || latSpread > 1) return null; // skip when spanning multiple cities
    const hull = convexHull(coords);
    const padded = bufferHull(hull, 0.008);
    const ring = [...padded, padded[0]];
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] } };
  }, [properties]);
  const visibleProps = useMemo(() => {
    let filtered = properties.filter(p => !dragging || draggedPropId === p.id);
    // Viewport culling: only render markers within current map bounds
    if (bounds && !dragging) {
      filtered = filtered.filter(p =>
        p.lng >= bounds.west && p.lng <= bounds.east &&
        p.lat >= bounds.south && p.lat <= bounds.north
      );
    }
    return filtered;
  }, [properties, dragging, draggedPropId, bounds]);

  const handleMove = useCallback(evt => {
    setViewport(evt.viewState);
    updateBounds();
  }, [updateBounds]);

  // Center map on property when user lifts it
  useEffect(() => {
    if (!dragging || !draggedPropId || !mapRef.current) return;
    const prop = properties.find(p => p.id === draggedPropId);
    if (!prop?.lng || !prop?.lat) return;
    const map = mapRef.current.getMap?.();
    if (map) {
      map.flyTo({
        center: [prop.lng, prop.lat],
        zoom: 14,
        duration: 500,
        essential: true,
        offset: [-180, 0], // shift center so location stays visible (rooms panel overlays right)
      });
    }
  }, [dragging, draggedPropId, properties]);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: B.bg }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: B.ink, marginBottom: 8 }}>Map not configured</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>Add VITE_MAPBOX_TOKEN to .env</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        {...viewport}
        onMove={handleMove}
        onLoad={updateBounds}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
      >
        {areaGeoJson && (
          <Source id="area-highlight" type="geojson" data={areaGeoJson}>
            <Layer {...AREA_FILL} />
            <Layer {...AREA_LINE} />
          </Source>
        )}
        {visibleProps.map(p => (
          <PropertyMarker
            key={p.id}
            property={p}
            myVote={swipes?.[p.id]}
            blendScore={blendData?.property_scores?.[p.id]?.score ?? null}
            isSelected={selectedProperty?.id === p.id}
            isDraggingHighlight={dragging && draggedPropId === p.id}
            pinImageUrl={getPinImageUrl(p, imageMap)}
            onClick={onSelect}
          />
        ))}
      </Map>

      {/* Custom map controls — zoom +/- and fit-to-bounds */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 2,
        display: "flex", flexDirection: "column", gap: 1,
        background: "#fff", borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}>
        <button onClick={() => { const m = mapRef.current?.getMap?.(); if (m) m.zoomIn({ duration: 250 }); }}
          title="Zoom in" style={mapBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.ink} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
        <button onClick={() => { const m = mapRef.current?.getMap?.(); if (m) m.zoomOut({ duration: 250 }); }}
          title="Zoom out" style={mapBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.ink} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/></svg>
        </button>
        <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
        <button onClick={() => {
          const m = mapRef.current?.getMap?.();
          if (!m) return;
          const coords = properties.filter(p => p.lng && p.lat);
          if (coords.length === 0) return;
          const sw = [Math.min(...coords.map(p => p.lng)) - 0.05, Math.min(...coords.map(p => p.lat)) - 0.05];
          const ne = [Math.max(...coords.map(p => p.lng)) + 0.05, Math.max(...coords.map(p => p.lat)) + 0.05];
          try { m.fitBounds([sw, ne], { padding: 50, duration: 600 }); } catch {}
        }} title="Fit all properties" style={mapBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
      </div>

      {/* Subtle spotlight: center stays clear, edges softly dim — purposeful focus without full dark mode */}
      {dragging && (
        <div
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(circle at 50% 50%, transparent 0%, transparent 28%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.42) 100%)",
            transition: "opacity 0.3s ease",
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

MapPanel.propTypes = {
  properties: PropTypes.arrayOf(PropTypes.object).isRequired,
  swipes: PropTypes.object,
  blendData: PropTypes.shape({
    property_scores: PropTypes.object,
  }),
  selectedProperty: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
  dragging: PropTypes.bool,
  draggedPropId: PropTypes.string,
  uniqueImageUrls: PropTypes.object,
  leftCollapsed: PropTypes.bool,
};
