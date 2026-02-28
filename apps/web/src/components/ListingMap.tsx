import { useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PropertyWithFloorplans } from "@homeblend/types";

const SOURCE_COLORS: Record<string, string> = {
  apartments: "#0891B2",
  zillow:     "#4F46E5",
  redfin:     "#DC2626",
  other:      "#6B7280",
};

const SOURCE_LETTER: Record<string, string> = {
  apartments: "A",
  zillow:     "Z",
  redfin:     "R",
  other:      "O",
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface Props {
  properties: PropertyWithFloorplans[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ListingMap({ properties, selectedId, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-2xl">🗺</div>
        <p className="text-slate-600 font-medium">Map unavailable</p>
        <p className="text-slate-400 text-sm">
          Add your <code className="bg-slate-200 px-1 rounded">VITE_MAPBOX_TOKEN</code> to{" "}
          <code className="bg-slate-200 px-1 rounded">apps/web/.env.local</code>
        </p>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        longitude: -117.8265,
        latitude:  33.6846,
        zoom:      11,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
    >
      <NavigationControl position="top-right" showCompass={false} />

      {properties.map((p) => {
        const raw = p.raw as Record<string, unknown>;
        const lat = raw.lat as number | undefined;
        const lng = raw.lng as number | undefined;
        if (!lat || !lng) return null;

        const isSelected = p.id === selectedId;
        const isHovered  = p.id === hoveredId;
        const isActive   = isSelected || isHovered;

        const color  = SOURCE_COLORS[p.source] ?? SOURCE_COLORS.other;
        const letter = SOURCE_LETTER[p.source]  ?? "?";

        const cheapest = [...(p.floorplans ?? [])].sort((a, b) => a.rent - b.rent)[0];

        return (
          <Marker
            key={p.id}
            longitude={lng}
            latitude={lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(p.id);
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Tooltip */}
              {isActive && cheapest && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "white",
                    borderRadius: 10,
                    padding: "6px 10px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    zIndex: 20,
                    minWidth: 120,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#111827" }}>
                    ${cheapest.rent.toLocaleString()}/mo
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B7280", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </p>
                  {/* Caret */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -6,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 0,
                      height: 0,
                      borderLeft: "6px solid transparent",
                      borderRight: "6px solid transparent",
                      borderTop: "6px solid white",
                    }}
                  />
                </div>
              )}

              {/* Pin */}
              <div
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: color,
                  border: isActive ? "3px solid white" : "2px solid white",
                  boxShadow: isActive
                    ? `0 0 0 2px ${color}, 0 4px 14px rgba(0,0,0,0.3)`
                    : "0 2px 8px rgba(0,0,0,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "white",
                  fontSize: 12,
                  fontWeight: "bold",
                  transform: isActive ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  zIndex: isActive ? 10 : 1,
                  position: "relative",
                }}
              >
                {letter}
              </div>
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
