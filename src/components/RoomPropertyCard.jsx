import { useState } from "react";
import { B, blendColor } from "../Brand.jsx";

export default function RoomPropertyCard({
  property, votes, myVote, addedBy, members,
  isSelected, blendScore, blendReason,
  onSelect, onVote, onRemove, canRemove,
}) {
  const [imgIdx,   setImgIdx]   = useState(0);
  const [hovering, setHovering] = useState(null); // "up" | "down"

  const upVotes   = votes.filter(v => v.vote ===  1);
  const downVotes = votes.filter(v => v.vote === -1);
  const upCount   = upVotes.length;
  const downCount = downVotes.length;
  const totalVotes = upCount + downCount;
  const netScore  = upCount - downCount;
  const adder     = members.find(m => m.user_id === addedBy || m.auth_user_id === addedBy);
  const bc        = blendScore != null ? blendColor(blendScore) : null;

  function handleVote(v, e) {
    e.stopPropagation();
    onVote(myVote === v ? null : v);
  }

  const scoreColor = netScore > 0 ? "#4A7C59" : netScore < 0 ? "#8B3A3A" : B.muted;
  const scoreBg    = netScore > 0 ? "rgba(74,124,89,0.12)" : netScore < 0 ? "rgba(139,58,58,0.1)" : "rgba(140,112,86,0.08)";

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 14,
        border: `1.5px solid ${isSelected ? B.gold : B.border}`,
        background: isSelected ? "rgba(255,251,242,0.97)" : "rgba(255,255,255,0.82)",
        backdropFilter: "blur(10px)",
        boxShadow: isSelected
          ? `0 0 0 3px rgba(166,124,61,0.12), 0 6px 24px rgba(80,50,10,0.12)`
          : "0 2px 10px rgba(80,50,10,0.06)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.18s cubic-bezier(.16,1,.3,1)",
      }}
    >
      {/* ── Photo ── */}
      <div style={{ position: "relative", height: 150, background: "#E8DED2", overflow: "hidden" }}>
        {property.images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", transition: "opacity 0.3s", opacity: i === imgIdx ? 1 : 0,
            }}
            onError={e => { e.target.style.display = "none"; }}
          />
        ))}

        {/* Gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,5,2,0.55) 0%, transparent 50%)", pointerEvents: "none" }} />

        {/* Net score badge */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          padding: "3px 9px", borderRadius: 7,
          background: scoreBg, backdropFilter: "blur(8px)",
          border: `1px solid ${netScore > 0 ? "rgba(74,124,89,0.3)" : netScore < 0 ? "rgba(139,58,58,0.25)" : B.border}`,
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: scoreColor,
        }}>
          {netScore > 0 ? "+" : ""}{netScore}
        </div>

        {/* Added-by tag */}
        {adder && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(12,5,2,0.62)", backdropFilter: "blur(6px)",
            borderRadius: 7, padding: "3px 8px 3px 5px",
          }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: adder.avatar_color || B.gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, color: "#fff" }}>
              {adder.display_name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.9)" }}>Added by {adder.display_name}</span>
          </div>
        )}

        {/* Price overlay */}
        <div style={{ position: "absolute", bottom: 10, left: 11 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{property.price}</div>
        </div>

        {/* Photo dots */}
        {property.images.length > 1 && (
          <div style={{ position: "absolute", bottom: 13, right: 12, display: "flex", gap: 3 }}>
            {property.images.map((_, i) => (
              <div key={i}
                onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                style={{ width: i === imgIdx ? 14 : 4, height: 4, borderRadius: 2, background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer", transition: "width 0.2s" }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "12px 13px 0" }}>
        {/* Title + category */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 500, color: B.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {property.title}
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(166,124,61,0.08)", color: B.gold, flexShrink: 0 }}>
            {property.category}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {[[property.beds, "bd"], [property.baths, "ba"], [property.sqft?.toLocaleString(), "sf"]].map(([v, l]) => (
            <span key={l} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted }}>
              <strong style={{ color: B.ink, fontWeight: 600 }}>{v}</strong> {l}
            </span>
          ))}
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, marginLeft: "auto" }}>
            {property.location.split(",")[0]}
          </span>
        </div>

        {/* Blend score bar */}
        {bc != null && blendScore != null && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: B.muted }}>Blend match</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: bc.fg }}>{blendScore}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ width: `${blendScore}%`, height: "100%", background: bc.fg, borderRadius: 2, transition: "width 0.6s ease" }} />
            </div>
            {blendReason && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 4, lineHeight: 1.5 }}>{blendReason}</p>
            )}
          </div>
        )}

        {/* Vote section */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }} onClick={e => e.stopPropagation()}>

          {/* Upvote */}
          <button
            onMouseEnter={() => setHovering("up")}
            onMouseLeave={() => setHovering(null)}
            onClick={e => handleVote(1, e)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              background: myVote === 1
                ? "rgba(74,124,89,0.14)"
                : hovering === "up"
                ? "rgba(74,124,89,0.07)"
                : "rgba(0,0,0,0.03)",
              transition: "background 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill={myVote === 1 ? "#4A7C59" : "none"}
              stroke="#4A7C59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: myVote === 1 ? 700 : 500, color: myVote === 1 ? "#4A7C59" : B.muted }}>{upCount}</span>
          </button>

          {/* Member vote avatars */}
          {totalVotes > 0 && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {votes.slice(0, 4).map((v, i) => {
                const m = members.find(mb => mb.user_id === v.user_id || mb.auth_user_id === v.user_id);
                return (
                  <div key={i} title={`${m?.display_name || "?"}: ${v.vote === 1 ? "liked" : "passed"}`} style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: m?.avatar_color || B.muted,
                    border: `2px solid ${v.vote === 1 ? "#4A7C59" : "#8B3A3A"}`,
                    marginLeft: i > 0 ? -6 : 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 7, fontWeight: 700, color: "#fff",
                    zIndex: 4 - i, position: "relative",
                  }}>
                    {(m?.display_name || "?")[0].toUpperCase()}
                  </div>
                );
              })}
              {votes.length > 4 && (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: B.goldBg, border: `1px solid ${B.border}`, marginLeft: -6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 7, color: B.gold, fontWeight: 700 }}>
                  +{votes.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Downvote */}
          <button
            onMouseEnter={() => setHovering("down")}
            onMouseLeave={() => setHovering(null)}
            onClick={e => handleVote(-1, e)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              background: myVote === -1
                ? "rgba(139,58,58,0.12)"
                : hovering === "down"
                ? "rgba(139,58,58,0.06)"
                : "rgba(0,0,0,0.03)",
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: myVote === -1 ? 700 : 500, color: myVote === -1 ? "#8B3A3A" : B.muted }}>{downCount}</span>
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill={myVote === -1 ? "#8B3A3A" : "none"}
              stroke="#8B3A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
            </svg>
          </button>
        </div>

        {/* Remove link */}
        {canRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{ width: "100%", marginTop: 6, padding: "5px 0", border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, cursor: "pointer", opacity: 0.55, textDecoration: "underline" }}
          >
            Remove from room
          </button>
        )}
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}
