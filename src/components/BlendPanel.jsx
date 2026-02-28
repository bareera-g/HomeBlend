import { B, Icon, IC, blendColor } from "../Brand.jsx";
import { PROPERTIES } from "../data/properties.js";

/* BlendPanel works in two modes:
   - embedded={true}  → fills its container (used as a tab in RoomView)
   - embedded={false} → fixed overlay with backdrop (legacy / standalone use)
*/
export default function BlendPanel({ blendData, members, onClose, embedded = false }) {
  if (!blendData) return null;
  const { group_summary, compromise_notes, top_matches = [], property_scores = {} } = blendData;

  const topProperties = top_matches.map(id => PROPERTIES.find(p => p.id === id)).filter(Boolean);
  const scoredAll = PROPERTIES
    .filter(p => property_scores[p.id] != null)
    .sort((a, b) => (property_scores[b.id]?.score ?? 0) - (property_scores[a.id]?.score ?? 0));

  const groupScore = scoredAll.length > 0
    ? Math.round(scoredAll.reduce((s, p) => s + (property_scores[p.id]?.score ?? 50), 0) / scoredAll.length)
    : null;

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Panel header */}
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
              AI · Group Analysis
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: B.ink, lineHeight: 1.1 }}>
              Group Blend
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {groupScore != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 2 }}>Avg match</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: blendColor(groupScore).fg }}>{groupScore}%</div>
              </div>
            )}
            {!embedded && (
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(166,124,61,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={IC.x} size={13} color={B.gold} sw={1.8} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px 40px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Group summary */}
        {group_summary && (
          <div style={{ padding: "16px 18px", borderRadius: 14, background: `linear-gradient(135deg, rgba(166,124,61,0.1), rgba(166,124,61,0.04))`, border: `1px solid rgba(166,124,61,0.25)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={B.gold} stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.gold }}>Group Profile</span>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.inkSoft, lineHeight: 1.75, margin: 0 }}>
              {group_summary}
            </p>
          </div>
        )}

        {/* Member profiles */}
        {blendData.member_profiles?.length > 0 && (
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 12 }}>Individual Profiles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {blendData.member_profiles.map(mp => {
                const member = members.find(m => m.user_id === mp.user_id || m.auth_user_id === mp.user_id);
                if (!member) return null;
                return (
                  <div key={mp.user_id} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.72)", border: `1px solid ${B.border}`, backdropFilter: "blur(8px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: member.avatar_color || B.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(80,50,10,0.15)" }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#FAF6EE" }}>{member.display_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>{member.display_name}</div>
                        {mp.price_preference && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted }}>{mp.price_preference} budget</div>}
                      </div>
                    </div>
                    {mp.lifestyle_summary && (
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.inkSoft, lineHeight: 1.65, marginBottom: mp.key_values?.length > 0 ? 9 : 0 }}>{mp.lifestyle_summary}</p>
                    )}
                    {mp.key_values?.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {mp.key_values.map(v => (
                          <span key={v} style={{ padding: "2px 9px", borderRadius: 5, background: "rgba(166,124,61,0.08)", border: `1px solid rgba(166,124,61,0.2)`, fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.gold, fontWeight: 600 }}>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compromise notes */}
        {compromise_notes && (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(139,58,58,0.05)", border: "1px solid rgba(139,58,58,0.14)" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#8B3A3A", marginBottom: 7 }}>Compromises to Discuss</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.inkSoft, lineHeight: 1.7, margin: 0 }}>{compromise_notes}</p>
          </div>
        )}

        {/* Top matches */}
        {topProperties.length > 0 && (
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 12 }}>Top Matches</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topProperties.map((p, rank) => {
                const score = property_scores[p.id];
                const bc = score ? blendColor(score.score) : null;
                return (
                  <div key={p.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.72)", border: `1px solid ${B.border}`, backdropFilter: "blur(8px)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: rank === 0 ? B.gold : B.goldBg, border: `1px solid ${B.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 500, color: rank === 0 ? "#fff" : B.gold }}>#{rank + 1}</span>
                    </div>
                    <img src={p.images[0]} alt="" style={{ width: 64, height: 52, objectFit: "cover", borderRadius: 9, flexShrink: 0, border: `1px solid rgba(166,124,61,0.14)` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 500, color: B.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.gold, fontWeight: 600, marginTop: 1 }}>{p.price}</div>
                      {score?.reason && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.inkSoft, marginTop: 4, lineHeight: 1.55 }}>{score.reason}</div>}
                    </div>
                    {bc && score && (
                      <div style={{ flexShrink: 0, padding: "4px 9px", borderRadius: 8, background: bc.bg, alignSelf: "flex-start", border: `1px solid ${bc.fg}22` }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: bc.fg }}>{score.score}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full ranking */}
        {scoredAll.length > 0 && (
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: B.muted, marginBottom: 12 }}>All Properties Ranked</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {scoredAll.map((p, i) => {
                const score = property_scores[p.id];
                const bc = blendColor(score.score);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.55)", border: `1px solid ${B.border}` }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, width: 20, textAlign: "right", flexShrink: 0 }}>#{i + 1}</span>
                    <img src={p.images[0]} alt="" style={{ width: 30, height: 24, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ width: `${score.score}%`, height: "100%", background: bc.fg, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: bc.fg, width: 32, textAlign: "right", flexShrink: 0 }}>{score.score}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,12,5,0.35)", backdropFilter: "blur(2px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 440,
        background: `linear-gradient(160deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)`,
        borderLeft: `1px solid ${B.border}`,
        boxShadow: "-16px 0 64px rgba(40,24,8,0.18)",
        animation: "slideInR 0.25s cubic-bezier(.16,1,.3,1)",
      }}>
        {content}
      </div>
    </div>
  );
}
