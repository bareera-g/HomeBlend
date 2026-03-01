import { useState, useCallback } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl";
import { B, blendColor } from "../Brand.jsx";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

function PropertyMarker({ property, myVote, blendScore, isSelected, onClick }) {
  const bc = blendScore != null ? blendColor(blendScore) : null;
  const color = myVote === "like" ? "#5C8A6B" : myVote === "pass" ? "#8B3A3A" : bc ? bc.fg : B.gold;
  const scale = isSelected ? 1.3 : 1;
  return (
    <Marker longitude={property.lng} latitude={property.lat} anchor="bottom" onClick={e => { e.originalEvent.stopPropagation(); onClick(property); }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", transform: `scale(${scale})`, transformOrigin: "50% 100%", transition: "transform 0.2s ease" }}>
        <div style={{ background: color, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 8, boxShadow: `0 2px 8px ${color}55`, border: "1.5px solid rgba(255,255,255,0.5)", whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
          {property.title.split(" ").slice(0, 2).join(" ")}
        </div>
        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid ${color}` }} />
      </div>
    </Marker>
  );
}

export default function MapPanel({ properties, swipes, blendData, selectedProperty, onSelect }) {
  const [viewport, setViewport] = useState({ longitude: -117.783, latitude: 33.680, zoom: 12 });

  const handleMove = useCallback(evt => setViewport(evt.viewState), []);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: B.bg }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: B.ink, marginBottom: 8 }}>Map not configured</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>Add VITE_MAPBOX_TOKEN to .env</div>
      </div>
    );
  }

  return (
    <Map
      {...viewport}
      onMove={handleMove}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-right" />
      {properties.map(p => (
        <PropertyMarker
          key={p.id}
          property={p}
          myVote={swipes?.[p.id]}
          blendScore={blendData?.property_scores?.[p.id]?.score ?? null}
          isSelected={selectedProperty?.id === p.id}
          onClick={onSelect}
        />
      ))}
    </Map>
  );
}
