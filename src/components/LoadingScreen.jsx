/**
 * Full-screen loading state: HomeBlend logo + progress bar at bottom.
 * Bar has safe-area padding so it's not cut off on notched devices.
 */
import { B, LogoMark } from "../Brand.jsx";
import LoadingBar from "./LoadingBar.jsx";

export default function LoadingScreen({ loading }) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: B.bg,
      }}
    >
      {/* Logo centered */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, animation: "fadeIn 0.4s ease" }}>
          <LogoMark size={48} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: B.ink, letterSpacing: 0.5, lineHeight: 1 }}>HomeBlend</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: B.muted, marginTop: 4 }}>Find your blend together</div>
          </div>
        </div>
      </div>

      {/* LoadingBar renders fixed at bottom with safe-area padding */}
      <LoadingBar loading={loading} />
    </div>
  );
}
