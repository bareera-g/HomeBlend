// ── Brand tokens ──────────────────────────────────────────────────────────────
export const B = {
  bg:       "#F3EDE3",
  bgCard:   "rgba(249,244,236,0.95)",
  bgPanel:  "rgba(251,247,241,0.98)",
  ink:      "#2C1A0E",
  inkSoft:  "#4A2E18",
  muted:    "#8C7056",
  gold:     "#A67C3D",
  goldBg:   "rgba(166,124,61,0.08)",
  border:   "rgba(166,124,61,0.22)",
  like:     "#4A7C59",
  likeBg:   "rgba(74,124,89,0.09)",
  pass:     "#8B3A3A",
  passBg:   "rgba(139,58,58,0.09)",
  overlay:  "rgba(20,12,5,0.38)",
};

export const AVATAR_COLORS = [
  "#A67C3D", "#4A7C59", "#7C4A59", "#4A5E7C", "#7C6A4A", "#4A7C7C", "#7C4A4A", "#5E7C4A",
];

// ── SVG icon paths ─────────────────────────────────────────────────────────────
export const IC = {
  home:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  heart:   "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  x:       "M18 6L6 18M6 6l12 12",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  users:   "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  copy:    "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-4-4H8z M14 2v4a2 2 0 0 0 2 2h4 M12 11v6 M9 14h6",
  check:   "M20 6L9 17l-5-5",
  map:     "M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16",
  pin:     "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  rotate:  "M1 4v6h6 M23 20v-6h-6 M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15",
  star:    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  sliders: "M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-4m0-4V3M1 14h6M9 8h6M17 17h6",
  chevL:   "M15 18l-6-6 6-6",
  chevR:   "M9 18l6-6-6-6",
  close:   "M18 6L6 18M6 6l12 12",
  blend:   "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M8 12h8 M12 8v8",
  spark:   "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  plus:    "M12 5v14M5 12h14",
};

// ── Icon component ─────────────────────────────────────────────────────────────
export function Icon({ d, size = 18, color = B.gold, sw = 1.5, fill = "none" }) {
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
    >
      {d.split(" M").map((segment, i) => (
        <path key={i} d={i === 0 ? segment : "M" + segment} />
      ))}
    </svg>
  );
}

// ── Blend score → color ────────────────────────────────────────────────────────
export function blendColor(score) {
  if (score >= 70) return { fg: "#4A7C59", bg: "rgba(74,124,89,0.1)" };
  if (score >= 45) return { fg: "#A67C3D", bg: "rgba(166,124,61,0.1)" };
  return { fg: "#8C7056", bg: "rgba(140,112,86,0.08)" };
}

// ── Spinner ────────────────────────────────────────────────────────────────────
export function Spinner({ size = 18, color = B.gold }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid rgba(166,124,61,0.2)`,
      borderTopColor: color,
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ── LogoMark ───────────────────────────────────────────────────────────────────
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect x="2" y="2" width="24" height="24" rx="6" fill={B.goldBg} stroke={B.border} strokeWidth="1"/>
      <path d="M14 7L7 13v8h5v-5h4v5h5v-8L14 7z" fill="none" stroke={B.gold} strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="14" cy="13" r="2.2" fill={B.gold} opacity="0.6"/>
    </svg>
  );
}
