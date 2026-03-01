/**
 * Skeleton placeholder components — LinkedIn-style shimmer blocks
 * that match HomeBlend's warm ivory/gold palette.
 */
import PropTypes from "prop-types";
import { B } from "../Brand.jsx";

const SHIMMER_BG = `linear-gradient(90deg, rgba(167,146,119,0.08) 25%, rgba(167,146,119,0.18) 50%, rgba(167,146,119,0.08) 75%)`;
const SHIMMER_STYLE = {
  backgroundImage: SHIMMER_BG,
  backgroundSize: "600px 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
};

/* ── Primitive blocks ──────────────────────────────────────────────────── */

function Block({ w = "100%", h = 14, r = 6, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(167,146,119,0.10)",
      ...SHIMMER_STYLE,
      ...style,
    }} />
  );
}

Block.propTypes = {
  w: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  h: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  r: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  style: PropTypes.object,
};

function Circle({ size = 40, style = {} }) {
  return <Block w={size} h={size} r="50%" style={style} />;
}

Circle.propTypes = {
  size: PropTypes.number,
  style: PropTypes.object,
};

/* ── Animated house loader — fills skeleton map/content placeholders ── */
function HouseLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
      opacity: 0.32, animation: "houseBreath 2.4s ease-in-out infinite",
    }}>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Roof */}
        <path
          d="M60 12L14 56h12v48h68V56h12L60 12z"
          fill="rgba(167,146,119,0.12)"
          stroke="rgba(167,146,119,0.35)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Door */}
        <rect x="48" y="72" width="24" height="32" rx="3"
          fill="rgba(167,146,119,0.15)" stroke="rgba(167,146,119,0.30)" strokeWidth="1.5" />
        {/* Door knob */}
        <circle cx="66" cy="90" r="2.5" fill="rgba(167,146,119,0.35)" />
        {/* Left window */}
        <rect x="30" y="62" width="14" height="14" rx="2.5"
          fill="rgba(167,146,119,0.10)" stroke="rgba(167,146,119,0.28)" strokeWidth="1.5" />
        <line x1="37" y1="62" x2="37" y2="76" stroke="rgba(167,146,119,0.22)" strokeWidth="1" />
        <line x1="30" y1="69" x2="44" y2="69" stroke="rgba(167,146,119,0.22)" strokeWidth="1" />
        {/* Right window */}
        <rect x="76" y="62" width="14" height="14" rx="2.5"
          fill="rgba(167,146,119,0.10)" stroke="rgba(167,146,119,0.28)" strokeWidth="1.5" />
        <line x1="83" y1="62" x2="83" y2="76" stroke="rgba(167,146,119,0.22)" strokeWidth="1" />
        <line x1="76" y1="69" x2="90" y2="69" stroke="rgba(167,146,119,0.22)" strokeWidth="1" />
        {/* Chimney */}
        <rect x="78" y="22" width="12" height="24" rx="2"
          fill="rgba(167,146,119,0.12)" stroke="rgba(167,146,119,0.30)" strokeWidth="1.5" />
        {/* Chimney smoke — three puffs, animated */}
        <circle cx="84" cy="16" r="3" fill="rgba(167,146,119,0.18)">
          <animate attributeName="cy" values="16;8;2" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0.12;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="80" cy="12" r="2" fill="rgba(167,146,119,0.14)">
          <animate attributeName="cy" values="12;5;-1" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.08;0" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="88" cy="14" r="2.5" fill="rgba(167,146,119,0.16)">
          <animate attributeName="cy" values="14;6;0" dur="3.0s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.22;0.1;0" dur="3.0s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
        color: "rgba(167,146,119,0.7)", letterSpacing: 0.5,
      }}>
        Loading your homes…
      </span>
      <style>{`
        @keyframes houseBreath {
          0%, 100% { transform: scale(1); opacity: 0.32; }
          50%      { transform: scale(1.04); opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

/* ── Property card skeleton (matches PropertyCard layout) ────────────── */
export function PropertyCardSkeleton() {
  return (
    <div style={{
      borderRadius: 16, overflow: "hidden", flexShrink: 0,
      background: "#fff",
      border: `1.5px solid rgba(167,146,119,0.12)`,
      boxShadow: "0 2px 12px rgba(80,50,10,0.04)",
    }}>
      {/* Image placeholder */}
      <Block w="100%" h={200} r={0} />
      {/* Body */}
      <div style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Block w="65%" h={16} r={6} />
        <Block w="45%" h={12} r={5} />
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <Block w={60} h={12} r={5} />
          <Block w={50} h={12} r={5} />
          <Block w={70} h={12} r={5} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <Block w={56} h={22} r={6} />
          <Block w={56} h={22} r={6} />
          <Block w={56} h={22} r={6} />
        </div>
      </div>
    </div>
  );
}

/* ── Room card skeleton (matches RoomDropCard layout) ────────────────── */
export function RoomCardSkeleton() {
  return (
    <div style={{
      minHeight: 110,
      borderRadius: 13,
      borderLeft: `4px solid rgba(167,146,119,0.2)`,
      background: "rgba(255,255,255,0.55)",
      padding: "14px 15px",
    }}>
      <Block w="55%" h={16} r={6} style={{ marginBottom: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <Block w={70} h={12} r={5} />
      </div>
      <Block w="40%" h={10} r={4} style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 5 }}>
        <Block w={38} h={30} r={6} />
        <Block w={38} h={30} r={6} />
        <Block w={38} h={30} r={6} />
      </div>
    </div>
  );
}

/* ── Dashboard skeleton layout (replaces full-screen LoadingScreen) ──── */
export function DashboardSkeleton() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>
      {/* Header bar skeleton */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, height: 48,
        padding: "0 18px",
        background: "rgba(255,252,247,0.98)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0,
      }}>
        <Circle size={22} />
        <Block w={90} h={18} r={4} />
        <div style={{ flex: 1 }} />
        <Circle size={32} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left properties panel */}
        <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${B.border}` }}>
          {/* Sub-header */}
          <div style={{
            padding: "8px 11px", borderBottom: `1px solid ${B.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Block w={120} h={26} r={7} />
            <Block w={90} h={26} r={14} />
            <div style={{ flex: 1 }} />
            <Block w={60} h={26} r={7} />
          </div>
          {/* Property card skeletons */}
          <div style={{ flex: 1, overflowY: "hidden", padding: "12px 11px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
          </div>
        </div>

        {/* Map area placeholder — animated house loader */}
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, rgba(167,146,119,0.06) 0%, rgba(167,146,119,0.03) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <HouseLoader />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── RoomView skeleton (replaces LoadingScreen in room) ──────────────── */
export function RoomViewSkeleton() {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: B.bg, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, height: 48,
        padding: "0 18px",
        background: "rgba(255,252,247,0.98)",
        borderBottom: `1px solid ${B.border}`, flexShrink: 0,
      }}>
        <Block w={24} h={24} r={6} />
        <Block w={140} h={18} r={4} />
        <div style={{ flex: 1 }} />
        <Block w={80} h={28} r={8} />
      </div>

      {/* Room meta bar */}
      <div style={{
        padding: "12px 24px",
        borderBottom: `1px solid ${B.border}`,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <Block w={180} h={24} r={6} />
        <Block w={100} h={14} r={4} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Circle size={30} />
          <Circle size={30} />
          <Circle size={30} />
        </div>
      </div>

      {/* Two-panel body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "16px 16px 16px 20px", gap: 16 }}>
        {/* Left — leaderboard */}
        <div style={{
          width: 380, flexShrink: 0, borderRadius: 18,
          background: "#fff", border: `1px solid ${B.border}`,
          padding: "20px 18px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <Block w={140} h={18} r={5} />
            <Block w={60} h={28} r={8} />
          </div>
          <Block w="100%" h={6} r={3} />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <Block w={16} h={16} r={4} />
              <Block w={52} h={40} r={8} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Block w="70%" h={14} r={5} />
                <Block w="45%" h={10} r={4} />
              </div>
              <Block w={36} h={28} r={7} />
            </div>
          ))}
        </div>

        {/* Right — map/content area */}
        <div style={{
          flex: 1, borderRadius: 18,
          background: "rgba(167,146,119,0.04)",
          border: `1px solid ${B.border}`,
          display: "flex", flexDirection: "column",
        }}>
          {/* Tab bar skeleton */}
          <div style={{ display: "flex", gap: 6, padding: "14px 18px", borderBottom: `1px solid ${B.border}` }}>
            <Block w={60} h={30} r={20} />
            <Block w={60} h={30} r={20} />
            <Block w={80} h={30} r={20} />
            <Block w={70} h={30} r={20} />
          </div>
          {/* Content placeholder — animated house loader */}
          <div style={{
            flex: 1,
            background: "linear-gradient(135deg, rgba(167,146,119,0.06) 0%, rgba(167,146,119,0.02) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <HouseLoader />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Blend panel skeleton ─────────────────────────────────────────────── */
export function BlendSkeleton() {
  return (
    <div style={{ padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Block w={100} h={18} r={5} style={{ marginBottom: 12 }} />
        <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}` }}>
          <Block w="100%" h={32} r={8} style={{ marginBottom: 14 }} />
          <Block w={160} h={160} r="50%" style={{ margin: "0 auto" }} />
        </div>
      </div>
      <div>
        <Block w={80} h={18} r={5} style={{ marginBottom: 12 }} />
        {[1, 2].map(i => (
          <div key={i} style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}`, marginBottom: 10 }}>
            <Block w="40%" h={14} r={5} style={{ marginBottom: 10 }} />
            <Block w="90%" h={12} r={4} style={{ marginBottom: 6 }} />
            <Block w="75%" h={12} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Group picks skeleton ─────────────────────────────────────────────── */
export function GroupPicksSkeleton() {
  return (
    <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
      <Block w={130} h={20} r={6} />
      <div style={{ padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}` }}>
        <Block w="60%" h={14} r={5} style={{ marginBottom: 10 }} />
        <Block w="95%" h={12} r={4} style={{ marginBottom: 6 }} />
        <Block w="80%" h={12} r={4} />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: "flex", gap: 12, padding: "14px", borderRadius: 14,
          background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}`,
        }}>
          <Block w={100} h={72} r={10} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Block w="70%" h={16} r={5} />
            <Block w="50%" h={12} r={4} />
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <Block w={48} h={20} r={6} />
              <Block w={48} h={20} r={6} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
