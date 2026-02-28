const FEATURES = ["naturalLight", "parking", "openKitchen", "balcony", "inUnitLaundry"] as const;
const LABELS: Record<string, string> = {
  naturalLight: "Light",
  parking: "Parking",
  openKitchen: "Kitchen",
  balcony: "Balcony",
  laundry: "Laundry",
  inUnitLaundry: "Laundry",
};

interface TasteVector {
  naturalLight: number;
  parking: number;
  openKitchen: number;
  balcony: number;
  inUnitLaundry: number;
}

interface BlendRadarProps {
  tasteVectors: Record<string, TasteVector>;
  userIds: string[];
  names: Record<string, string>;
  selectedUserId?: string | null;
}

export function BlendRadar({
  tasteVectors,
  userIds,
  names,
  selectedUserId = null,
}: BlendRadarProps) {
  const uid = selectedUserId ?? userIds[0];
  const vec = uid ? tasteVectors[uid] : null;
  if (!vec) return <p className="text-slate-400 text-sm">No taste data yet.</p>;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 20;
  const points = FEATURES.map((key, i) => {
    const angle = (i * 360) / FEATURES.length - 90;
    const rad = (angle * Math.PI) / 180;
    const r = (vec[key] ?? 0) * maxR;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  });
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const axisPoints = FEATURES.map((_, i) => {
    const angle = (i * 360) / FEATURES.length - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x2: cx + maxR * Math.cos(rad),
      y2: cy + maxR * Math.sin(rad),
    };
  });

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
      <p className="text-slate-400 text-sm mb-2">{uid ? names[uid] ?? "User" : "Taste profile"}</p>
      <svg width={size} height={size} className="mx-auto">
        {axisPoints.map((p, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x2}
            y2={p.y2}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        ))}
        <polygon
          points={polyPoints}
          fill="rgba(34, 197, 94, 0.25)"
          stroke="rgba(34, 197, 94, 0.6)"
          strokeWidth="1.5"
        />
        {FEATURES.map((key, i) => {
          const angle = (i * 360) / FEATURES.length - 90;
          const rad = (angle * Math.PI) / 180;
          const labelR = maxR + 14;
          const lx = cx + labelR * Math.cos(rad);
          const ly = cy + labelR * Math.sin(rad);
          return (
            <text
              key={key}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-400 text-[10px]"
            >
              {LABELS[key] ?? key}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
