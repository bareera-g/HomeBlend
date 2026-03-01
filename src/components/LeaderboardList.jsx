import PropTypes from "prop-types";
import { B } from "../Brand.jsx";
import RoomPropertyCard from "./RoomPropertyCard.jsx";

/* ── Rank style helpers ──────────────────────────────────── */

const RANK_COLORS = ["#A67C3D", "#8C9BAB", "#9B7553"];
const RANK_BGS    = ["rgba(166,124,61,0.12)", "rgba(140,155,171,0.1)", "rgba(155,117,83,0.1)"];

function rankColor(rank) { return RANK_COLORS[rank] ?? B.muted; }
function rankBg(rank)    { return RANK_BGS[rank]    ?? "transparent"; }

/* ── Component ───────────────────────────────────────────── */

/**
 * Sorted leaderboard of room properties with rank badges.
 * Properties are scored by net votes (likes − passes) then ranked.
 */
export default function LeaderboardList({
  properties, votesByProperty, myVotes, roomPropMeta,
  members, selected, userId, roomOwnerId,
  onToggleSelect, onVote, onRemove,
}) {
  const scored = properties
    .map(p => {
      const pv = votesByProperty[p.id] || [];
      const score = pv.reduce((s, v) => s + (v.vote === 1 ? 1 : -1), 0);
      const likes = pv.filter(v => v.vote === 1).length;
      return { p, score, likes };
    })
    .sort((a, b) => b.score - a.score || b.likes - a.likes || a.p.title.localeCompare(b.p.title));

  return scored.map(({ p, score }, rank) => {
    const meta  = roomPropMeta.find(r => r.property_id === p.id);
    const color = rankColor(rank);
    const bg    = rankBg(rank);

    return (
      <div key={p.id} style={{ position: "relative" }}>
        {/* Rank badge */}
        <div style={{
          position: "absolute", top: 9, left: 9, zIndex: 2,
          width: 22, height: 22, borderRadius: "50%",
          background: bg, border: `1.5px solid ${color}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color,
        }}>
          {rank + 1}
        </div>
        <RoomPropertyCard
          property={p}
          votes={votesByProperty[p.id] || []}
          myVote={myVotes[p.id] ?? null}
          addedBy={meta?.added_by}
          members={members}
          isSelected={selected?.id === p.id}
          onSelect={() => onToggleSelect(p)}
          onVote={vote => onVote(p.id, vote)}
          onRemove={() => onRemove(p.id)}
          canRemove={meta?.added_by === userId || roomOwnerId === userId}
          score={score}
          rank={rank}
        />
      </div>
    );
  });
}

LeaderboardList.propTypes = {
  properties:      PropTypes.array.isRequired,
  votesByProperty: PropTypes.object.isRequired,
  myVotes:         PropTypes.object.isRequired,
  roomPropMeta:    PropTypes.array.isRequired,
  members:         PropTypes.array.isRequired,
  selected:        PropTypes.object,
  userId:          PropTypes.string,
  roomOwnerId:     PropTypes.string,
  onToggleSelect:  PropTypes.func.isRequired,
  onVote:          PropTypes.func.isRequired,
  onRemove:        PropTypes.func.isRequired,
};
