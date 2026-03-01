import PropTypes from "prop-types";
import { B } from "../Brand.jsx";

function pluralize(n, one, many) { return n === 1 ? one : many; }

/**
 * Owner-only tab content showing pending join requests + current members.
 */
export default function JoinRequestsPanel({ joinRequests, members, votes, roomOwnerId, onRespond }) {
  const pending = joinRequests.filter(r => r.status === "pending");

  return (
    <div style={{
      height: "100%",
      background: "linear-gradient(160deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)",
      overflowY: "auto", padding: "24px 28px",
    }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 8 }}>
        Join Requests
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: B.ink, marginBottom: 20 }}>
        Room Members
      </div>

      {/* Pending requests */}
      {pending.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {pending.map(req => (
            <div key={req.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.8)", border: `1px solid ${B.border}`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: B.gold, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: "#FAF6EE", flexShrink: 0,
              }}>
                {(req.display_name || "?")[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>
                  {req.display_name || "Unknown User"}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 2 }}>
                  Wants to join · {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onRespond(req.id, false)}
                  style={{
                    padding: "6px 12px", borderRadius: 7,
                    background: "rgba(192,98,74,0.08)", border: "1px solid rgba(192,98,74,0.2)",
                    color: "#C0624A", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >Decline</button>
                <button
                  onClick={() => onRespond(req.id, true)}
                  style={{
                    padding: "6px 12px", borderRadius: 7,
                    background: "rgba(92,138,107,0.12)", border: "1px solid rgba(92,138,107,0.3)",
                    color: "#5C8A6B", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >Approve</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "20px", borderRadius: 12, textAlign: "center",
          background: "rgba(166,124,61,0.05)", border: "1px dashed rgba(166,124,61,0.2)",
          marginBottom: 24,
        }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>
            No pending requests
          </div>
        </div>
      )}

      {/* Current members */}
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 10 }}>
        Current Members ({members.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map(m => {
          const ct = votes.filter(v => v.user_id === m.auth_user_id).length;
          return (
            <div key={m.id || m.auth_user_id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.65)", border: `1px solid ${B.border}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: m.avatar_color || B.gold,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#FAF6EE", flexShrink: 0,
              }}>
                {m.display_name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink }}>
                  {m.display_name}
                  {m.auth_user_id === roomOwnerId && (
                    <span style={{ marginLeft: 7, padding: "1px 6px", borderRadius: 4, background: B.goldBg, color: B.gold, fontSize: 9, fontWeight: 700 }}>Owner</span>
                  )}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 1 }}>
                  {ct} {pluralize(ct, "vote", "votes")} cast
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

JoinRequestsPanel.propTypes = {
  joinRequests: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    user_id: PropTypes.string,
    display_name: PropTypes.string,
    status: PropTypes.string,
    created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })).isRequired,
  members: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    auth_user_id: PropTypes.string,
    display_name: PropTypes.string,
    avatar_color: PropTypes.string,
  })).isRequired,
  votes: PropTypes.arrayOf(PropTypes.shape({
    user_id: PropTypes.string,
    property_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vote: PropTypes.number,
  })).isRequired,
  roomOwnerId: PropTypes.string,
  onRespond: PropTypes.func.isRequired,
};
