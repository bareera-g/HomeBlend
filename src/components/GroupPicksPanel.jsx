import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { B } from "../Brand.jsx";
import { extractFeatures, FEATURE_KEYS, FEATURE_LABELS, computeTasteVector } from "../lib/blendAlgorithm.js";
import { generatePicksAnalysis, isLLMReady } from "../lib/llm.js";

/* ═══════════════════════════════════════════════════════════════════════════
   GroupPicksPanel
   Shows every room property scored against each member's taste profile,
   with named justifications and friction points.
   LLM enhances the copy when VITE_ANTHROPIC_API_KEY is set.
═══════════════════════════════════════════════════════════════════════════ */
export default function GroupPicksPanel({ members = [], votes = [], properties = [] }) {
  const [llmPicks,    setLlmPicks]    = useState(null);
  const [llmLoading,  setLlmLoading]  = useState(false);
  const [llmError,    setLlmError]    = useState(null);
  const votesKeyRef = useRef(null);

  // ── Algorithmic scoring ─────────────────────────────────────────────────
  const scoredProperties = useMemo(() => {
    if (properties.length === 0) return [];

    const tasteVectors = {};
    members.forEach(m => {
      tasteVectors[m.auth_user_id] = computeTasteVector(m.auth_user_id, votes, properties);
    });

    return properties.map(property => {
      const features   = extractFeatures(property);
      const memberData = members.map(m => {
        const tv   = tasteVectors[m.auth_user_id] || {};
        const works    = [];
        const friction = [];
        for (const k of FEATURE_KEYS) {
          const cares = (tv[k] || 0) > 0.38;
          const has   = features[k] > 0.5;
          if (cares && has)  works.push(FEATURE_LABELS[k]);
          if (cares && !has) friction.push(FEATURE_LABELS[k]);
        }
        // Compute a match score: weighted dot product
        let dot = 0, norm = 0;
        for (const k of FEATURE_KEYS) {
          dot  += (tv[k] || 0) * features[k];
          norm += (tv[k] || 0);
        }
        const matchScore = norm > 0 ? Math.round((dot / norm) * 100) : 50;
        return { member: m, works, friction, matchScore };
      });

      const avgScore = memberData.length > 0
        ? Math.round(memberData.reduce((s, d) => s + d.matchScore, 0) / memberData.length)
        : 50;

      // Net vote score for this property
      const propVotes = votes.filter(v => v.property_id === property.id);
      const voteScore = propVotes.reduce((s, v) => s + (v.vote === 1 ? 1 : -1), 0);
      const likes     = propVotes.filter(v => v.vote === 1).length;
      const dislikes  = propVotes.filter(v => v.vote === -1).length;

      // Shared "works" across all members
      const allWorks    = memberData.flatMap(d => d.works);
      const sharedWorks = FEATURE_KEYS.filter(k =>
        features[k] > 0.5 && memberData.every(d => d.works.includes(FEATURE_LABELS[k]))
      ).map(k => FEATURE_LABELS[k]);

      return { property, memberData, avgScore, voteScore, likes, dislikes, sharedWorks };
    }).sort((a, b) => {
      // Primary: avg taste score; secondary: vote score
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
      return b.voteScore - a.voteScore;
    });
  }, [members, votes, properties]);

  // ── Auto-trigger LLM when votes stabilise ──────────────────────────────
  useEffect(() => {
    if (!isLLMReady || votes.length === 0 || members.length === 0) return;
    const key = JSON.stringify(votes.map(v => `${v.user_id}:${v.property_id}:${v.vote}`).sort());
    if (key === votesKeyRef.current) return;
    votesKeyRef.current = key;
    const t = setTimeout(() => runLLM(), 4000);
    return () => clearTimeout(t);
  }, [votes, members]); // eslint-disable-line

  const runLLM = useCallback(async () => {
    if (!isLLMReady || llmLoading || properties.length === 0) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
      const result = await generatePicksAnalysis({ members, votes, properties, scoredProperties });
      if (result) setLlmPicks(result);
      else setLlmError("Could not generate picks — check VITE_ANTHROPIC_API_KEY in .env.local");
    } catch (e) {
      setLlmError(e.message);
    } finally {
      setLlmLoading(false);
    }
  }, [members, votes, properties, scoredProperties, llmLoading]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (properties.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(166,124,61,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="1.4">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: B.ink, marginBottom: 8 }}>No properties to rank</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, lineHeight: 1.7, maxWidth: 240 }}>
          Add properties to the room and cast votes — Group Picks will rank and explain each one for your roommates.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(160deg,rgba(252,248,242,1) 0%,rgba(246,239,228,1) 100%)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0, background: "rgba(251,247,241,0.96)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
              AI · Group Analysis
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: B.ink, lineHeight: 1.1 }}>
              Group Picks
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, marginTop: 4 }}>
              Every property ranked by how well it fits your group — with named reasons.
            </div>
          </div>
          {isLLMReady && votes.length > 0 && (
            <button onClick={runLLM} disabled={llmLoading} style={{
              marginTop: 4, padding: "6px 13px", borderRadius: 20,
              border: `1px solid ${B.gold}44`, background: llmLoading ? "rgba(166,124,61,0.06)" : "rgba(166,124,61,0.1)",
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: B.gold,
              cursor: llmLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
            }}>
              {llmLoading
                ? <><SpinDot />&nbsp;Analyzing…</>
                : <><StarIcon />&nbsp;{llmPicks ? "Refresh" : "AI Explain"}</>}
            </button>
          )}
        </div>
        {llmError && <div style={{ marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: "#C0624A" }}>{llmError}</div>}
      </div>

      {/* ── Scrollable picks list ───────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
        {scoredProperties.map(({ property, memberData, avgScore, voteScore, likes, dislikes, sharedWorks }, rank) => {
          const llmProp = llmPicks?.[property.id] || llmPicks?.[property.title];
          const scoreColor = avgScore >= 70 ? "#5C8A6B" : avgScore >= 45 ? B.gold : "#C0624A";
          const scoreBg    = avgScore >= 70 ? "rgba(92,138,107,0.1)" : avgScore >= 45 ? "rgba(166,124,61,0.1)" : "rgba(192,98,74,0.08)";
          const isTop = rank === 0;

          return (
            <div key={property.id} style={{
              borderRadius: 18,
              overflow: "hidden",
              border: isTop ? `2px solid ${B.gold}55` : `1px solid ${B.border}`,
              background: "rgba(255,255,255,0.82)",
              boxShadow: isTop ? "0 6px 32px rgba(166,124,61,0.12)" : "0 2px 10px rgba(40,24,8,0.05)",
              backdropFilter: "blur(8px)",
            }}>

              {/* ── Property photo + overlay ──────────────────────────── */}
              <div style={{ position: "relative", height: 130 }}>
                <img
                  src={property.images?.[0]}
                  alt={property.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* Dark gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(16,10,4,0.72) 0%, rgba(16,10,4,0.1) 55%, transparent 100%)" }} />

                {/* Rank badge */}
                <div style={{
                  position: "absolute", top: 12, left: 12,
                  width: 30, height: 30, borderRadius: "50%",
                  background: isTop ? B.gold : "rgba(255,255,255,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800,
                  color: isTop ? "#FAF6EE" : B.ink,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                }}>
                  {rank === 0 ? "★" : `#${rank + 1}`}
                </div>

                {/* Group score pill */}
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  padding: "4px 10px", borderRadius: 20,
                  background: scoreBg, border: `1.5px solid ${scoreColor}44`,
                  backdropFilter: "blur(6px)",
                }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 800, color: scoreColor }}>{avgScore}%</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: scoreColor, marginLeft: 3, opacity: 0.8 }}>match</span>
                </div>

                {/* Title + price at bottom of image */}
                <div style={{ position: "absolute", bottom: 10, left: 14, right: 14 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: "#FAF6EE", lineHeight: 1.2 }}>
                    {property.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: B.gold }}>{property.price}</span>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.65)" }}>
                      {property.beds}bd · {property.baths}ba · {property.location?.split(",")[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Body ─────────────────────────────────────────────── */}
              <div style={{ padding: "14px 16px 16px" }}>

                {/* Vote tally row */}
                {(likes > 0 || dislikes > 0) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.03)" }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted }}>Votes</span>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                      {(likes + dislikes) > 0 && (
                        <div style={{ width: `${(likes / (likes + dislikes)) * 100}%`, height: "100%", background: "#5C8A6B", borderRadius: 2, transition: "width 0.6s ease" }} />
                      )}
                    </div>
                    {likes > 0 && <VoteBadge count={likes} up />}
                    {dislikes > 0 && <VoteBadge count={dislikes} />}
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: voteScore > 0 ? "#5C8A6B" : voteScore < 0 ? "#C0624A" : B.muted }}>
                      {voteScore > 0 ? `+${voteScore}` : voteScore}
                    </span>
                  </div>
                )}

                {/* LLM narrative (if available) */}
                {llmProp?.narrative && (
                  <div style={{ marginBottom: 12, padding: "10px 13px", borderRadius: 10, background: "rgba(166,124,61,0.05)", border: `1px solid rgba(166,124,61,0.15)` }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: B.gold, marginBottom: 5 }}>
                      AI Overview
                    </div>
                    <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.ink, lineHeight: 1.7 }}>
                      {llmProp.narrative}
                    </p>
                  </div>
                )}

                {/* Shared wins */}
                {sharedWorks.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <SectionMini color="#5C8A6B">Everyone values this</SectionMini>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {sharedWorks.map(f => <FeatureTag key={f} label={f} color="#5C8A6B" />)}
                    </div>
                  </div>
                )}

                {/* Per-member breakdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {memberData.map(({ member, works, friction, matchScore }) => {
                    const llmMember = llmProp?.members?.[member.auth_user_id] || llmProp?.members?.[member.display_name];
                    const mc = matchScore >= 70 ? "#5C8A6B" : matchScore >= 45 ? B.gold : "#C0624A";
                    return (
                      <div key={member.auth_user_id} style={{
                        borderRadius: 12, overflow: "hidden",
                        border: `1px solid ${B.border}`,
                        background: "rgba(252,248,242,0.7)",
                      }}>
                        {/* Member row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderBottom: (works.length > 0 || friction.length > 0 || llmMember) ? `1px solid ${B.border}` : "none" }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: member.avatar_color || B.gold,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#FAF6EE", flexShrink: 0,
                          }}>
                            {(member.display_name || "?")[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink }}>
                              {member.display_name}
                            </div>
                          </div>
                          {/* Mini match bar + score */}
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                            <div style={{ width: 56, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                              <div style={{ width: `${matchScore}%`, height: "100%", borderRadius: 2, background: mc, transition: "width 0.6s ease" }} />
                            </div>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, fontWeight: 700, color: mc, minWidth: 28, textAlign: "right" }}>
                              {matchScore}%
                            </span>
                          </div>
                        </div>

                        {/* LLM or algorithmic reasons */}
                        {(llmMember || works.length > 0 || friction.length > 0) && (
                          <div style={{ padding: "9px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                            {llmMember?.why && (
                              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5C8A6B", marginTop: 5, flexShrink: 0 }} />
                                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>{llmMember.why}</span>
                              </div>
                            )}
                            {llmMember?.concern && (
                              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C0624A", marginTop: 5, flexShrink: 0 }} />
                                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>{llmMember.concern}</span>
                              </div>
                            )}
                            {!llmMember && (
                              <>
                                {works.length > 0 && (
                                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5C8A6B", marginTop: 5, flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>
                                      Works because: {works.join(", ")}
                                    </span>
                                  </div>
                                )}
                                {friction.length > 0 && (
                                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C0624A", marginTop: 5, flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>
                                      Missing: {friction.join(", ")}
                                    </span>
                                  </div>
                                )}
                                {works.length === 0 && friction.length === 0 && (
                                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted, fontStyle: "italic" }}>
                                    Vote on this property to see personalised insights.
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────
function SectionMini({ children, color }) {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: color || B.muted, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function FeatureTag({ label, color }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 20, fontFamily: "'DM Sans', sans-serif",
      fontSize: 9.5, fontWeight: 600, color: color || B.ink,
      background: `${color || B.ink}12`, border: `1px solid ${color || B.ink}28`,
    }}>{label}</span>
  );
}

function VoteBadge({ count, up }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 2, padding: "1px 6px", borderRadius: 5, background: up ? "rgba(92,138,107,0.1)" : "rgba(192,98,74,0.1)", color: up ? "#5C8A6B" : "#C0624A", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700 }}>
      {up ? "+" : "-"}{count}
    </span>
  );
}

function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

function SpinDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  );
}
