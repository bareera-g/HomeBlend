import { useMemo } from "react";
import { B, Icon, IC, blendColor } from "../Brand.jsx";
import { computeBlend, FEATURE_LABELS } from "../lib/blendAlgorithm.js";

/* ═══════════════════════════════════════════════════════════════════════════
   BlendPanel — full group analysis
   Props:
     members        – room_members rows (with auth_user_id, display_name, avatar_color)
     votes          – votes rows (with user_id, property_id, vote)
     properties     – PROPERTIES array filtered to those in the room
     onClose        – called when user dismisses (overlay mode)
     embedded       – true → fills container (tab), false → floating overlay
   ══════════════════════════════════════════════════════════════════════════ */
export default function BlendPanel({ members = [], votes = [], properties = [], onClose, embedded = false }) {
  const blend = useMemo(
    () => computeBlend(members, votes, properties),
    [members, votes, properties]
  );

  const {
    groupCompatibility,
    compatMatrix,
    memberInsights,
    conflicts,
    rankedProperties,
    groupFavorites,
  } = blend;

  const gc = blendColor(groupCompatibility);
  const hasVotes = votes.length > 0;

  // ── helpers ────────────────────────────────────────────────────────────
  function Avatar({ m, size = 32 }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: m.avatarColor || m.avatar_color || B.gold,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
        fontSize: size * 0.4, fontWeight: 700, color: "#FAF6EE",
        boxShadow: "0 2px 8px rgba(80,50,10,0.14)",
      }}>
        {(m.displayName || m.display_name || "?")[0]?.toUpperCase()}
      </div>
    );
  }

  function CompatBadge({ pct }) {
    const c = blendColor(pct);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "2px 8px", borderRadius: 6,
        background: c.bg, color: c.fg,
        fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
        border: `1px solid ${c.fg}22`,
      }}>{pct}%</span>
    );
  }

  // ── content ────────────────────────────────────────────────────────────
  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
              Group Analysis
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: B.ink, lineHeight: 1.1 }}>
              Room Blend
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Group compatibility score */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 2 }}>
                Group match
              </div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500,
                color: gc.fg, lineHeight: 1,
              }}>
                {groupCompatibility}%
              </div>
            </div>
            {!embedded && (
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: "50%", background: "rgba(166,124,61,0.1)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon d={IC.x} size={13} color={B.gold} sw={1.8} />
              </button>
            )}
          </div>
        </div>

        {/* Group compat bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{
              width: `${groupCompatibility}%`, height: "100%", borderRadius: 3,
              background: gc.fg, transition: "width 0.8s cubic-bezier(.16,1,.3,1)",
            }} />
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 5 }}>
            {groupCompatibility >= 80
              ? "High alignment — you'll agree on most properties."
              : groupCompatibility >= 55
              ? "Good compatibility with a few areas to discuss."
              : "Mixed preferences — look for middle-ground options."}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px 48px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Empty state */}
        {!hasVotes && (
          <div style={{
            padding: "28px 20px", borderRadius: 16, textAlign: "center",
            background: "rgba(166,124,61,0.05)", border: `1px dashed rgba(166,124,61,0.25)`,
          }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: B.ink, marginBottom: 8 }}>
              No votes yet
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, margin: 0 }}>
              Add properties to the room and upvote or downvote them. The blend updates in real time.
            </p>
          </div>
        )}

        {/* ── Compatibility matrix ─────────────────────────────────────── */}
        {members.length >= 2 && (
          <section>
            <SectionLabel>Member Compatibility</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memberInsights.map((mi, i) => (
                memberInsights.slice(i + 1).map((mj) => {
                  const pct = compatMatrix[mi.memberId]?.[mj.memberId] ?? 0;
                  return (
                    <div key={`${mi.memberId}-${mj.memberId}`} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 12,
                      background: "rgba(255,255,255,0.7)", border: `1px solid ${B.border}`,
                    }}>
                      <Avatar m={mi} size={28} />
                      <Avatar m={mj} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 600, color: B.ink }}>
                          {mi.displayName} · {mj.displayName}
                        </div>
                        <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%", borderRadius: 2,
                            background: blendColor(pct).fg, transition: "width 0.7s ease",
                          }} />
                        </div>
                      </div>
                      <CompatBadge pct={pct} />
                    </div>
                  );
                })
              ))}
            </div>
          </section>
        )}

        {/* ── Member taste profiles ─────────────────────────────────────── */}
        {memberInsights.length > 0 && (
          <section>
            <SectionLabel>Member Profiles</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {memberInsights.map(mi => (
                <div key={mi.memberId} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.72)", border: `1px solid ${B.border}`,
                  backdropFilter: "blur(8px)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Avatar m={mi} size={34} />
                    <div>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>
                        {mi.displayName}
                      </div>
                      {mi.topFeatures.length > 0 && (
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 1 }}>
                          Cares about: {mi.topFeatures.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feature bars */}
                  {mi.topFeatures.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                      {Object.entries(mi.tasteVec || {})
                        .filter(([, v]) => v > 0.1)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 4)
                        .map(([k, v]) => (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.inkSoft, width: 90, flexShrink: 0 }}>
                              {FEATURE_LABELS[k]}
                            </span>
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                              <div style={{
                                width: `${Math.round(v * 100)}%`, height: "100%", borderRadius: 2,
                                background: B.gold, transition: "width 0.7s ease",
                              }} />
                            </div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.gold, width: 28, textAlign: "right", fontWeight: 600 }}>
                              {Math.round(v * 100)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Insight bullets */}
                  {mi.bullets.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                      {mi.bullets.map((b, i) => (
                        <li key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <span style={{ color: B.gold, fontSize: 10, marginTop: 2, flexShrink: 0 }}>·</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Conflicts ─────────────────────────────────────────────────── */}
        {conflicts.length > 0 && (
          <section>
            <SectionLabel color="#8B3A3A">Discuss With Your Group</SectionLabel>
            <div style={{
              padding: "14px 18px", borderRadius: 12,
              background: "rgba(139,58,58,0.05)", border: "1px solid rgba(139,58,58,0.14)",
            }}>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {conflicts.map((c, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#C0624A", fontSize: 11, marginTop: 2, flexShrink: 0 }}>!</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.inkSoft, lineHeight: 1.65 }}>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ── Group favorites ───────────────────────────────────────────── */}
        {groupFavorites.length > 0 && (
          <section>
            <SectionLabel>Group Favorites</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupFavorites.slice(0, 3).map(({ property, score, likes, dislikes }, rank) => (
                <PropertyRow key={property.id} property={property} score={score} likes={likes} dislikes={dislikes} rank={rank} highlight />
              ))}
            </div>
          </section>
        )}

        {/* ── All properties ranked ─────────────────────────────────────── */}
        {rankedProperties.length > 0 && (
          <section>
            <SectionLabel>All Properties Ranked</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {rankedProperties.map(({ property, score, likes, dislikes }, i) => (
                <PropertyRow key={property.id} property={property} score={score} likes={likes} dislikes={dislikes} rank={i} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,12,5,0.35)", backdropFilter: "blur(2px)" }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children, color }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700,
      letterSpacing: 2, textTransform: "uppercase",
      color: color || B.muted, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function PropertyRow({ property, score, likes, dislikes, rank, highlight }) {
  const scoreColor = score > 0 ? "#5C8A6B" : score < 0 ? "#C0624A" : B.muted;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: highlight ? "12px 14px" : "8px 12px",
      borderRadius: highlight ? 12 : 9,
      background: highlight ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)",
      border: `1px solid ${highlight ? "rgba(166,124,61,0.2)" : B.border}`,
      backdropFilter: "blur(6px)",
    }}>
      <span style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted,
        width: 22, textAlign: "right", flexShrink: 0,
      }}>#{rank + 1}</span>
      {highlight && (
        <img src={property.images?.[0]} alt="" style={{
          width: 52, height: 42, objectFit: "cover", borderRadius: 8, flexShrink: 0,
          border: `1px solid rgba(166,124,61,0.14)`,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: highlight ? "'Cormorant Garamond', serif" : "'DM Sans', sans-serif",
          fontSize: highlight ? 14 : 11, fontWeight: highlight ? 500 : 400,
          color: B.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{property.title}</div>
        {highlight && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.gold, fontWeight: 600, marginTop: 1 }}>
            {property.price}
          </div>
        )}
      </div>
      {/* Vote counts */}
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        {likes > 0 && (
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 5,
            background: "rgba(92,138,107,0.1)", color: "#5C8A6B",
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            {likes}
          </span>
        )}
        {dislikes > 0 && (
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: 5,
            background: "rgba(192,98,74,0.1)", color: "#C0624A",
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"/>
            </svg>
            {dislikes}
          </span>
        )}
        {/* Net score */}
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
          color: scoreColor, width: 26, textAlign: "right",
        }}>
          {score > 0 ? `+${score}` : score}
        </span>
      </div>
    </div>
  );
}
