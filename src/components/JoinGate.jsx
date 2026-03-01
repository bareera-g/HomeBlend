import PropTypes from "prop-types";
import { B, LogoMark } from "../Brand.jsx";

const ROOM_BG = "linear-gradient(165deg, #E8DED0 0%, #DFD4C4 45%, #D9CDBD 100%)";

/**
 * Full-screen gate shown to non-members before they can enter a room.
 */
export default function JoinGate({ code, requestSent, onRequestJoin, onBack }) {
  return (
    <div style={{ height: "100dvh", background: ROOM_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        maxWidth: 420, width: "100%",
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderRadius: 20, border: `1px solid ${B.border}`,
        boxShadow: "0 16px 60px rgba(40,24,8,0.12)",
        padding: "40px 36px", textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <LogoMark size={44} />
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: B.ink, marginBottom: 6 }}>
          Room <strong style={{ fontWeight: 500, letterSpacing: 2 }}>{code}</strong>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: B.muted, lineHeight: 1.7, marginBottom: 28 }}>
          This room requires approval from the owner. Request access to join the group and view/vote on properties.
        </p>

        {requestSent ? (
          <div style={{
            padding: "14px 20px", borderRadius: 12,
            background: "rgba(92,138,107,0.1)", border: "1px solid rgba(92,138,107,0.25)",
          }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#5C8A6B" }}>Request sent</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, marginTop: 4 }}>
              The room owner will approve your request.
            </div>
          </div>
        ) : (
          <button onClick={onRequestJoin} style={{
            width: "100%", padding: "13px 20px", borderRadius: 11,
            background: B.ink, border: "none", color: "#FAF6EE",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(44,26,14,0.2)",
          }}>
            Request to Join
          </button>
        )}

        <button onClick={onBack} style={{
          marginTop: 14, width: "100%", padding: "10px", borderRadius: 9,
          background: "transparent", border: `1px solid ${B.border}`,
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, cursor: "pointer",
        }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

JoinGate.propTypes = {
  code:           PropTypes.string.isRequired,
  requestSent:    PropTypes.bool.isRequired,
  onRequestJoin:  PropTypes.func.isRequired,
  onBack:         PropTypes.func.isRequired,
};
