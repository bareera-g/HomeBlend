import { useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PropertyWithFloorplans } from "@homeblend/types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

interface Props {
  properties: PropertyWithFloorplans[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function truncateName(name: string, max = 14): string {
  return name.length > max ? name.slice(0, max - 1).trimEnd() + "…" : name;
}

export default function ListingMap({ properties, selectedId, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-stone-100 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-2xl">🗺</div>
        <p className="text-stone-600 font-medium">Map unavailable</p>
        <p className="text-stone-400 text-sm">
          Add your <code className="bg-stone-200 px-1 rounded">VITE_MAPBOX_TOKEN</code> to{" "}
          <code className="bg-stone-200 px-1 rounded">apps/web/.env.local</code>
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
      mapStyle="mapbox://styles/mapbox/light-v11"
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

        return (
          <Marker
            key={p.id}
            longitude={lng}
            latitude={lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(p.id);
            }}
          >
            <div
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer
                transition-all duration-150 select-none
                ${isActive
                  ? "bg-stone-900 text-white shadow-lg scale-110 z-20"
                  : "bg-[#A67C52] text-white shadow-md z-10 hover:bg-[#8B6843]"
                }
              `}
              style={{
                position: "relative",
                zIndex: isActive ? 20 : 1,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {truncateName(p.name)}
            </div>
          </Marker>
        );
      })}
    </Map>
  );
}
