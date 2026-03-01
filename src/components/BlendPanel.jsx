import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { B, Icon, IC, blendColor } from "../Brand.jsx";
import { computeBlend, FEATURE_LABELS } from "../lib/blendAlgorithm.js";
import { generateBlendAnalysis, isLLMReady } from "../lib/llm.js";

/* ═══════════════════════════════════════════════════════════════════════════
   BlendPanel — live group analysis with LLM insights
   Props:
     members    – blend_members rows (auth_user_id, display_name, avatar_color)
     votes      – normalised vote rows (user_id, property_id, vote = 1/-1)
     properties – PROPERTIES in the room
     onClose    – overlay dismiss
     embedded   – true = tab view, false = overlay
═══════════════════════════════════════════════════════════════════════════ */
export default function BlendPanel({ members = [], votes = [], properties = [], onClose, embedded = false }) {
  const [llmData,     setLlmData]     = useState(null);
  const [llmLoading,  setLlmLoading]  = useState(false);
  const [llmError,    setLlmError]    = useState(null);
  const prevVotesRef  = useRef(null);

  const blend = useMemo(
    () => computeBlend(members, votes, properties),
    [members, votes, properties]
  );
  const { groupCompatibility, compatMatrix, memberInsights, conflicts, rankedProperties, groupFavorites } = blend;
  const gc      = blendColor(groupCompatibility);
  const hasVotes = votes.length > 0;

  // Auto-run LLM when votes change (debounced 3 s)
  useEffect(() => {
    const key = JSON.stringify(votes.map(v => `${v.user_id}:${v.property_id}:${v.vote}`).sort());
    if (key === prevVotesRef.current || !hasVotes || !isLLMReady) return;
    prevVotesRef.current = key;
    const t = setTimeout(() => runLLM(), 3000);
    return () => clearTimeout(t);
  }, [votes, hasVotes]); // eslint-disable-line

  const runLLM = useCallback(async () => {
    if (!isLLMReady || llmLoading) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
      const result = await generateBlendAnalysis({ members, votes, properties, rankedProperties });
      if (result) setLlmData(result);
      else setLlmError("Could not generate insights — OpenAI returned an empty response");
    } catch (e) {
      setLlmError(e.message);
    } finally {
      setLlmLoading(false);
    }
  }, [members, votes, properties, rankedProperties, llmLoading]);

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
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
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.muted, marginBottom: 2 }}>
                Group Match
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: gc.fg, lineHeight: 1 }}>
                {groupCompatibility}%
              </div>
            </div>
            {!embedded && (
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(166,124,61,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={IC.x} size={13} color={B.gold} sw={1.8} />
              </button>
            )}
          </div>
        </div>
        {/* Compat bar + description */}
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 4, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${groupCompatibility}%`, height: "100%", borderRadius: 3, background: gc.fg, transition: "width 0.8s cubic-bezier(.16,1,.3,1)" }} />
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 5 }}>
            {groupCompatibility >= 80 ? "High alignment — you'll agree on most properties."
              : groupCompatibility >= 55 ? "Good compatibility with a few areas to discuss."
              : "Mixed preferences — look for middle-ground options."}
          </div>
        </div>
        {/* LLM refresh button */}
        {isLLMReady && hasVotes && (
          <button onClick={runLLM} disabled={llmLoading} style={{
            marginTop: 10, padding: "5px 12px", borderRadius: 20,
            border: `1px solid ${B.gold}44`, background: llmLoading ? "rgba(166,124,61,0.06)" : "rgba(166,124,61,0.1)",
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, color: B.gold,
            cursor: llmLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.2s",
          }}>
            {llmLoading
              ? <><SpinIcon /> Analyzing…</>
              : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a10 10 0 0 1 10 10M12 22a10 10 0 0 1-10-10"/><path d="M22 12l-3-3-3 3"/><path d="M2 12l3 3 3-3"/></svg> {llmData ? "Refresh AI Insights" : "Generate AI Insights"}</>
            }
          </button>
        )}
        {!isLLMReady && (
          <div style={{ marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted }}>
            Add <code style={{ fontFamily: "monospace", fontSize: 9 }}>OPENAI_API_KEY</code> to .env.local for AI insights.
          </div>
        )}
        {llmError && <div style={{ marginTop: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: "#C0624A" }}>{llmError}</div>}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Empty state */}
        {!hasVotes && (
          <div style={{ padding: "28px 20px", borderRadius: 16, textAlign: "center", background: "rgba(166,124,61,0.05)", border: "1px dashed rgba(166,124,61,0.25)" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: B.ink, marginBottom: 8 }}>No votes yet</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, margin: 0 }}>
              Add properties to the room and like or dislike them — the blend updates live.
            </p>
          </div>
        )}

        {/* ── LLM Compatibility narrative ──────────────────────────────────── */}
        {llmData?.compatibility && (
          <section>
            <SectionLabel>Compatibility Overview</SectionLabel>
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.7)" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${B.border}` }}>
                <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.ink, lineHeight: 1.65 }}>
                  {llmData.compatibility.narrative}
                </p>
              </div>
              {llmData.compatibility.works?.length > 0 && (
                <div style={{ padding: "12px 16px", background: "rgba(92,138,107,0.04)", borderBottom: `1px solid ${B.border}` }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: "#5C8A6B", marginBottom: 7 }}>What works</div>
                  {llmData.compatibility.works.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#5C8A6B", marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.inkSoft, lineHeight: 1.5 }}>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {llmData.compatibility.tensions?.length > 0 && (
                <div style={{ padding: "12px 16px", background: "rgba(192,98,74,0.03)" }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: "#C0624A", marginBottom: 7 }}>Watch out for</div>
                  {llmData.compatibility.tensions.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#C0624A", marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.inkSoft, lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Member Compatibility bars ─────────────────────────────────────── */}
        {members.length >= 2 && (
          <section>
            <SectionLabel>Member Compatibility</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {memberInsights.map((mi, i) =>
                memberInsights.slice(i + 1).map(mj => {
                  const pct = compatMatrix[mi.memberId]?.[mj.memberId] ?? 0;
                  const c   = blendColor(pct);
                  return (
                    <div key={`${mi.memberId}-${mj.memberId}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.7)", border: `1px solid ${B.border}` }}>
                      <SmallAvatar color={mi.avatarColor} label={mi.displayName} />
                      <SmallAvatar color={mj.avatarColor} label={mj.displayName} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: B.ink, marginBottom: 4 }}>
                          {mi.displayName} · {mj.displayName}
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: c.fg, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.fg, fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, fontWeight: 700, border: `1px solid ${c.fg}22` }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ── Member Profiles (LLM + algorithmic) ──────────────────────────── */}
        {memberInsights.length > 0 && (
          <section>
            <SectionLabel>Member Profiles</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {memberInsights.map(mi => {
                const llmMember = llmData?.memberInsights?.[mi.memberId];
                const bullets = llmMember?.bullets || mi.bullets;
                const summary = llmMember?.summary;
                return (
                  <div key={mi.memberId} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.72)", border: `1px solid ${B.border}`, backdropFilter: "blur(8px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <SmallAvatar color={mi.avatarColor} label={mi.displayName} size={36} />
                      <div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink }}>{mi.displayName}</div>
                        {(summary || mi.topFeatures.length > 0) && (
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, marginTop: 1 }}>
                            {summary || `Cares about: ${mi.topFeatures.join(", ")}`}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Feature bars */}
                    {Object.entries(mi.tasteVec || {}).filter(([, v]) => v > 0.1).sort(([, a], [, b]) => b - a).slice(0, 4).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.inkSoft, width: 90, flexShrink: 0 }}>{FEATURE_LABELS[k]}</span>
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(v * 100)}%`, height: "100%", borderRadius: 2, background: mi.avatarColor || B.gold, transition: "width 0.7s ease" }} />
                        </div>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.gold, width: 28, textAlign: "right", fontWeight: 600 }}>{Math.round(v * 100)}%</span>
                      </div>
                    ))}
                    {/* Insight bullets */}
                    {bullets.length > 0 && (
                      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                        {bullets.map((b, i) => (
                          <li key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <span style={{ color: B.gold, fontSize: 10, marginTop: 3, flexShrink: 0 }}>·</span>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.65 }}>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Algorithmic conflicts ─────────────────────────────────────────── */}
        {conflicts.length > 0 && !llmData?.compatibility && (
          <section>
            <SectionLabel color="#8B3A3A">Discuss With Your Group</SectionLabel>
            <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(139,58,58,0.05)", border: "1px solid rgba(139,58,58,0.14)" }}>
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

        {/* ── Top Pick (LLM) ────────────────────────────────────────────────── */}
        {llmData?.topPick && (() => {
          const prop = properties.find(p => p.title?.toLowerCase().includes(llmData.topPick?.toLowerCase()));
          if (!prop) return null;
          return (
            <section>
              <SectionLabel>AI Top Pick</SectionLabel>
              <div style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${B.gold}55`, background: "rgba(255,255,255,0.8)" }}>
                <div style={{ position: "relative", height: 90 }}>
                  <img src={prop.images?.[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(20,12,5,0.55) 0%, transparent 60%)" }} />
                  <div style={{ position: "absolute", bottom: 10, left: 12 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, color: B.gold, letterSpacing: 1.8, textTransform: "uppercase" }}>AI Recommends</div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500, color: "#FAF6EE" }}>{prop.title}</div>
                  </div>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted }}>{prop.location}</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: B.gold }}>{prop.price}</span>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── Group Favorites ───────────────────────────────────────────────── */}
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

      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,12,5,0.35)", backdropFilter: "blur(2px)" }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 440,
        background: "linear-gradient(160deg,rgba(252,248,242,0.99) 0%,rgba(246,239,228,0.99) 100%)",
        borderLeft: `1px solid ${B.border}`, boxShadow: "-16px 0 64px rgba(40,24,8,0.18)",
        animation: "slideInR 0.25s cubic-bezier(.16,1,.3,1)",
      }}>
        {content}
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────
function SectionLabel({ children, color }) {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: color || B.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function SmallAvatar({ color, label, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color || B.gold,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif", fontSize: size * 0.38, fontWeight: 700, color: "#FAF6EE",
      boxShadow: "0 2px 6px rgba(80,50,10,0.14)",
    }}>
      {(label || "?")[0]?.toUpperCase()}
    </div>
  );
}

function PropertyRow({ property, score, likes, dislikes, rank, highlight }) {
  const sc = score > 0 ? "#5C8A6B" : score < 0 ? "#C0624A" : B.muted;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: highlight ? "12px 14px" : "8px 12px",
      borderRadius: highlight ? 12 : 9,
      background: highlight ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)",
      border: `1px solid ${highlight ? "rgba(166,124,61,0.2)" : B.border}`,
    }}>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted, width: 22, textAlign: "right", flexShrink: 0 }}>#{rank + 1}</span>
      {highlight && <img src={property.images?.[0]} alt="" style={{ width: 52, height: 42, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: `1px solid rgba(166,124,61,0.14)` }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: highlight ? "'Cormorant Garamond', serif" : "'DM Sans', sans-serif", fontSize: highlight ? 14 : 11, color: B.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{property.title}</div>
        {highlight && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.gold, fontWeight: 600, marginTop: 1 }}>{property.price}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        {likes > 0 && <VotePill count={likes} up />}
        {dislikes > 0 && <VotePill count={dislikes} />}
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: sc, minWidth: 24, textAlign: "right" }}>{score > 0 ? `+${score}` : score}</span>
      </div>
    </div>
  );
}

function VotePill({ count, up }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 5px", borderRadius: 5, background: up ? "rgba(92,138,107,0.1)" : "rgba(192,98,74,0.1)", color: up ? "#5C8A6B" : "#C0624A", fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 700 }}>
      {up ? "+" : "-"}{count}
    </span>
  );
}

function SpinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  );
}
