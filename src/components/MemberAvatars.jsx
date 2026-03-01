import PropTypes from "prop-types";
import { B } from "../Brand.jsx";

/**
 * Stacked row of member avatar circles — reusable across rooms / panels.
 */
export default function MemberAvatars({ members, max = 5 }) {
  const visible  = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {visible.map((m, i) => (
        <div
          key={m.id || m.auth_user_id}
          title={m.display_name}
          style={{
            width: 26, height: 26, borderRadius: "50%",
            background: m.avatar_color || B.gold,
            border: "2px solid rgba(255,252,247,0.95)",
            marginLeft: i > 0 ? -6 : 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: "#fff",
            zIndex: max - i, position: "relative",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          }}
        >
          {m.display_name?.[0]?.toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: B.goldBg, border: "2px solid rgba(255,252,247,0.95)",
          marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.gold, fontWeight: 700 }}>
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}

MemberAvatars.propTypes = {
  members: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    auth_user_id: PropTypes.string,
    display_name: PropTypes.string,
    avatar_color: PropTypes.string,
  })).isRequired,
  max: PropTypes.number,
};
