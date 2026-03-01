import PropTypes from "prop-types";
import { B } from "../Brand.jsx";

/**
 * Horizontal vote-progress indicator — reusable in headers and panels.
 * compact = true  → fixed 44 px width, slightly larger text  (header style)
 * compact = false → flex-fill width                          (panel style)
 */
export default function VoteProgressBar({ voterCount, memberCount, compact = false }) {
  const pct = memberCount > 0 ? Math.round((voterCount / memberCount) * 100) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: compact ? 44 : undefined,
        flex: compact ? undefined : 1,
        height: compact ? 5 : 3,
        borderRadius: compact ? 3 : 2,
        background: "rgba(0,0,0,0.06)", overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: B.gold,
          borderRadius: compact ? 3 : 2,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: compact ? 10 : 9.5,
        color: B.muted, whiteSpace: "nowrap",
      }}>
        {voterCount}/{memberCount} voted
      </span>
    </div>
  );
}

VoteProgressBar.propTypes = {
  voterCount:  PropTypes.number.isRequired,
  memberCount: PropTypes.number.isRequired,
  compact:     PropTypes.bool,
};
