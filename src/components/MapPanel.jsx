import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import { B, blendColor } from "../Brand.jsx";
import { computeUniquePropertyImages } from "../lib/uniquePropertyImages.js";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

/** Pin uses assigned unique image only — no fallback; algorithm guarantees every property gets one. */
function getPinImageUrl(property, imageMap) {
  return imageMap?.[property.id] ?? null;
}

function PropertyMarker({ property, myVote, blendScore, isSelected, isDraggingHighlight, pinImageUrl, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  const bc = blendScore != null ? blendColor(blendScore) : null;
  const color = myVote === "like" ? "#5C8A6B" : myVote === "pass" ? "#8B3A3A" : bc ? bc.fg : B.gold;
  const scale = isDraggingHighlight ? 1.55 : isSelected ? 1.3 : 1;
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
          background: showImg ? "transparent" : "#e8e2d8", border: "2px solid rgba(255,255,255,0.95)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: isDraggingHighlight ? "0 4px 20px rgba(166,124,61,0.25)" : "none",
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
        {/* Price underneath */}
        <div style={{
          background: color, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
          padding: "4px 8px", whiteSpace: "nowrap",
        }}>
          {property.price || "—"}
        </div>
        {/* Pin pointer */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
          borderTop: `10px solid ${color}`,
          marginTop: -1,
        }} />
      </div>
    </Marker>
  );
}

export default function MapPanel({ properties, swipes, blendData, selectedProperty, onSelect, dragging = false, draggedPropId = null, uniqueImageUrls }) {
  const [viewport, setViewport] = useState({ longitude: -117.783, latitude: 33.680, zoom: 12 });
  const mapRef = useRef(null);
  const computedUrls = useMemo(() => computeUniquePropertyImages(properties), [properties]);
  const imageMap = uniqueImageUrls && Object.keys(uniqueImageUrls).length > 0 ? uniqueImageUrls : computedUrls;
  const visibleProps = useMemo(() =>
    properties.filter(p => !dragging || draggedPropId === p.id),
    [properties, dragging, draggedPropId]
  );

  const handleMove = useCallback(evt => setViewport(evt.viewState), []);

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
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
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
