import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { B, Icon, IC, blendColor } from "../Brand.jsx";
import { computeBlend, FEATURE_KEYS, FEATURE_LABELS } from "../lib/blendAlgorithm.js";
import { generateBlendAnalysis, isLLMReady } from "../lib/llm.js";

/** Fake progress: steady, slow climb — tricks user into feeling it's loading faster than it is */
function blendFakeProgress(elapsedMs) {
  const t = elapsedMs / 1000;
  const p = 1 - Math.pow(0.7, t / 1.4);
  return Math.min(92, p * 100);
}

const LOAD_MESSAGES = [
  "Analyzing your preferences...",
  "Studying what you liked and passed on...",
  "Building personalized insights for your group...",
  "Finding properties that match everyone...",
  "Almost there...",
];

/** Apartments.com search URL for a property */
function apartmentsUrl(property) {
  const q = [property.title, property.location || "Irvine CA"].filter(Boolean).join(" ");
  return `https://www.apartments.com/search/?search=${encodeURIComponent(q)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BlendPanel — live group analysis with LLM insights
   Props:
     members      – blend_members rows (auth_user_id, display_name, avatar_color)
     votes        – normalised vote rows (user_id, property_id, vote = 1/-1)
     properties   – PROPERTIES in the room
     allProperties – full property catalog (for alternative suggestions)
     onClose      – overlay dismiss
     embedded     – true = tab view, false = overlay
═══════════════════════════════════════════════════════════════════════════ */
export default function BlendPanel({ members = [], votes = [], properties = [], allProperties = [], onClose, embedded = false, isVisible = true }) {
  const [llmData,     setLlmData]     = useState(null);
  const [llmLoading,  setLlmLoading]  = useState(false);
  const [llmError,    setLlmError]    = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [pairwiseReasonsExpanded, setPairwiseReasonsExpanded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [typingText, setTypingText] = useState("");
  const prevVotesRef  = useRef(null);
  const prevVisibleRef = useRef(false);
  const loadStartRef  = useRef(null);
  const loadRafRef    = useRef(null);

  const blend = useMemo(
    () => computeBlend(members, votes, properties),
    [members, votes, properties]
  );
  const { groupCompatibility, compatMatrix, memberInsights, conflicts, rankedProperties } = blend;

  const roomPropIds = useMemo(() => properties.map(p => p.id), [properties]);
  const all = allProperties?.length ? allProperties : properties;

  const alternatives = useMemo(() => {
    const picks = llmData?.alternativePicks || [];
    const idToProp = {};
    all.forEach(p => { idToProp[p.id] = p; idToProp[String(p.id)] = p; });
    return picks
      .map(({ propertyId, reasoning }) => ({
        property: idToProp[propertyId] ?? idToProp[Number(propertyId)],
        reasoning: reasoning || "",
      }))
      .filter(x => x.property);
  }, [llmData?.alternativePicks, all]);

  const pairwiseCompat = llmData?.pairwiseCompat || {};
  const effectiveSelectedId = selectedMemberId || (memberInsights[0]?.memberId ?? null);
  const selectedInsight = memberInsights.find(m => m.memberId === effectiveSelectedId);
  const aiGroupCompat = useMemo(() => {
    const scores = Object.values(pairwiseCompat).map(p => p?.score).filter(n => typeof n === "number");
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [pairwiseCompat]);
  const displayGroupCompat = aiGroupCompat ?? groupCompatibility;
  const gc = blendColor(displayGroupCompat);
  const hasVotes = votes.length > 0;

  const getPairKey = (a, b) => {
    if (!a || !b) return null;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };
  const getPairScore = (ma, mb) => {
    if (ma.auth_user_id === mb.auth_user_id) return null;
    const key = getPairKey(ma.auth_user_id, mb.auth_user_id);
    const p = pairwiseCompat[key];
    return p ? p.score : (compatMatrix?.[ma.auth_user_id]?.[mb.auth_user_id] ?? null);
  };
  const getPairReason = (ma, mb) => {
    const key = getPairKey(ma.auth_user_id, mb.auth_user_id);
    return pairwiseCompat[key]?.reason || "";
  };

  const runLLM = useCallback(async () => {
    if (!isLLMReady || llmLoading) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
      const result = await generateBlendAnalysis({
        members,
        votes,
        properties,
        rankedProperties,
        allProperties: all,
        roomPropIds,
      });
      if (result) setLlmData(result);
      else setLlmError("Could not generate insights — OpenAI returned an empty response");
    } catch (e) {
      setLlmError(e.message);
    } finally {
      setLlmLoading(false);
    }
  }, [members, votes, properties, rankedProperties, all, roomPropIds, llmLoading]);

  // Auto-run when Blend tab becomes visible (user clicks Blend)
  useEffect(() => {
    if (!isLLMReady || !hasVotes) return;
    if (isVisible && !prevVisibleRef.current) {
      prevVisibleRef.current = true;
      runLLM();
    }
    if (!isVisible) prevVisibleRef.current = false;
  }, [isVisible, hasVotes, runLLM]);

  // Re-run when votes change significantly (debounced)
  useEffect(() => {
    const key = JSON.stringify(votes.map(v => `${v.user_id}:${v.property_id}:${v.vote}`).sort());
    if (key === prevVotesRef.current || !hasVotes || !isLLMReady) return;
    prevVotesRef.current = key;
    const t = setTimeout(() => runLLM(), 2500);
    return () => clearTimeout(t);
  }, [votes, hasVotes]); // eslint-disable-line

  // Fake progress bar when loading — starts fast, slows near end
  useEffect(() => {
    if (!llmLoading) {
      setLoadProgress(100);
      const t = setTimeout(() => setLoadProgress(0), 400);
      return () => clearTimeout(t);
    }
    setLoadProgress(0);
    loadStartRef.current = Date.now();
    function tick() {
      if (!loadStartRef.current) return;
      const elapsed = Date.now() - loadStartRef.current;
      setLoadProgress(blendFakeProgress(elapsed));
      loadRafRef.current = requestAnimationFrame(tick);
    }
    loadRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loadRafRef.current);
  }, [llmLoading]);

  // Typing effect — messages type out one char at a time when loading
  useEffect(() => {
    if (!llmLoading) {
      setTypingText("");
      return;
    }
    setTypingText("");
    let msgIdx = 0;
    let charIdx = 0;
    let timeoutId;
    function tick() {
      const msg = LOAD_MESSAGES[msgIdx % LOAD_MESSAGES.length];
      if (charIdx <= msg.length) {
        setTypingText(msg.slice(0, charIdx));
        charIdx++;
        timeoutId = setTimeout(tick, 45 + Math.random() * 15);
      } else {
        msgIdx++;
        charIdx = 0;
        timeoutId = setTimeout(tick, 500); // brief pause before next message
      }
    }
    timeoutId = setTimeout(tick, 100);
    return () => clearTimeout(timeoutId);
  }, [llmLoading]);

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
                {displayGroupCompat}%
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
            <div style={{ width: `${displayGroupCompat}%`, height: "100%", borderRadius: 3, background: gc.fg, transition: "width 0.8s cubic-bezier(.16,1,.3,1)" }} />
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginTop: 5 }}>
            {groupCompatibility >= 80 ? "High alignment — you'll agree on most properties."
              : groupCompatibility >= 55 ? "Good compatibility with a few areas to discuss."
              : "Mixed preferences — look for middle-ground options."}
          </div>
        </div>
        {/* Refresh button — insights auto-run when Blend tab opens */}
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
              : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a10 10 0 0 1 10 10M12 22a10 10 0 0 1-10-10"/><path d="M22 12l-3-3-3 3"/><path d="M2 12l3 3 3-3"/></svg> Refresh AI Insights</>
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
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>

        {/* Loading overlay — typing effect + decelerating progress bar */}
        {llmLoading && hasVotes && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(180deg, rgba(252,248,242,0.98) 0%, rgba(248,242,232,0.97) 100%)",
            padding: 32,
            animation: "fadeInFast 0.2s ease",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(166,124,61,0.12) 0%, rgba(166,124,61,0.06) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 28, boxShadow: "0 4px 20px rgba(166,124,61,0.12)",
              animation: "pulse 2s ease-in-out infinite",
            }}>
              <SpinIcon />
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500, color: B.ink,
              marginBottom: 28, minHeight: 48,
              display: "flex", alignItems: "center", justifyContent: "center",
              textAlign: "center", maxWidth: 320,
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 2,
                padding: "12px 20px", borderRadius: 14,
                background: "rgba(255,255,255,0.9)", border: `1px solid ${B.border}`,
                boxShadow: "0 2px 12px rgba(44,26,14,0.04)",
              }}>
                <span style={{ lineHeight: 1.4 }}>{typingText}</span>
                <span style={{
                  display: "inline-block", width: 3, height: 18, marginLeft: 1, borderRadius: 1,
                  background: "linear-gradient(180deg, " + B.gold + " 0%, rgba(166,124,61,0.75) 100%)",
                  animation: "blink 0.9s step-end infinite", verticalAlign: "middle",
                  flexShrink: 0,
                }} />
              </div>
            </div>
            <div style={{ width: "100%", maxWidth: 300 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: B.muted, marginBottom: 8 }}>
                Building your blend
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "rgba(166,124,61,0.1)", overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)" }}>
                <div style={{
                  width: `${loadProgress}%`, height: "100%",
                  background: `linear-gradient(90deg, ${B.gold} 0%, rgba(166,124,61,0.85) 100%)`,
                  borderRadius: 6, transition: loadProgress >= 100 ? "width 0.3s ease" : "width 0.15s linear",
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasVotes && (
          <div style={{ padding: "28px 20px", borderRadius: 16, textAlign: "center", background: "rgba(166,124,61,0.05)", border: "1px dashed rgba(166,124,61,0.25)" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: B.ink, marginBottom: 8 }}>No votes yet</div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, margin: 0 }}>
              Add properties to the room and like or dislike them — the blend updates live.
            </p>
          </div>
        )}

        {hasVotes && (
          <>
            {/* ── Top row: Taste profile + Pairwise compatibility ─────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Taste profile */}
              {memberInsights.length > 0 && (
                <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.8)", border: `1px solid ${B.border}` }}>
                  <SectionLabel>Taste profile</SectionLabel>
                  <select
                    value={effectiveSelectedId ?? ""}
                    onChange={e => setSelectedMemberId(e.target.value || null)}
                    style={{
                      width: "100%", padding: "8px 12px", marginBottom: 12, borderRadius: 9,
                      border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.9)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.ink, cursor: "pointer",
                    }}
                  >
                    {memberInsights.map(m => (
                      <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                    ))}
                  </select>
                  {selectedInsight && (
                    <RadarChart tasteVec={selectedInsight.tasteVec} color={selectedInsight.avatarColor || B.gold} />
                  )}
                </div>
              )}
              {/* Pairwise compatibility (AI-assessed with justifications) */}
              {members.length >= 2 && (
                <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.8)", border: `1px solid ${B.border}` }}>
                  <SectionLabel>Pairwise compatibility</SectionLabel>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "4px 6px", textAlign: "left", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: B.muted }} />
                          {members.map(m => (
                            <th key={m.auth_user_id} style={{ padding: "4px 6px", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: B.ink }}>
                              {(m.display_name || "?").slice(0, 8)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((ma) => (
                          <tr key={ma.auth_user_id}>
                            <td style={{ padding: "4px 6px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, color: B.ink }}>
                              {ma.display_name || "?"}
                            </td>
                            {members.map((mb) => {
                              const pct = getPairScore(ma, mb);
                              const reason = getPairReason(ma, mb);
                              const c = pct != null ? blendColor(pct) : {};
                              return (
                                <td key={mb.auth_user_id} style={{ padding: "4px 6px", textAlign: "center" }}>
                                  {ma.auth_user_id === mb.auth_user_id ? (
                                    <span style={{ color: B.muted }}>—</span>
                                  ) : pct != null ? (
                                    <span
                                      title={reason}
                                      style={{ fontWeight: 700, color: c.fg, background: pct >= 80 ? "rgba(92,138,107,0.15)" : "transparent", padding: "2px 6px", borderRadius: 6, cursor: reason ? "help" : "default" }}
                                    >
                                      {pct}%
                                    </span>
                                  ) : (
                                    <span style={{ color: B.muted }}>—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: B.ink }}>
                    Group compatibility: {displayGroupCompat}%
                  </div>
                  {Object.keys(pairwiseCompat).length > 0 && (
                    <>
                      <button
                        onClick={() => setPairwiseReasonsExpanded(v => !v)}
                        style={{
                          marginTop: 8, padding: "4px 0", border: "none", background: "none",
                          fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 600, color: B.gold,
                          cursor: "pointer", textDecoration: "underline",
                        }}
                      >
                        {pairwiseReasonsExpanded ? "Hide" : "View"} AI justifications
                      </button>
                      {pairwiseReasonsExpanded && (
                        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "rgba(166,124,61,0.05)", border: `1px solid ${B.border}` }}>
                          {members.map((ma, i) =>
                            members.slice(i + 1).map(mb => {
                              const key = getPairKey(ma.auth_user_id, mb.auth_user_id);
                              const p = pairwiseCompat[key];
                              if (!p?.reason) return null;
                              return (
                                <div key={key} style={{ marginBottom: 8 }}>
                                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: B.ink, marginBottom: 2 }}>
                                    {ma.display_name} & {mb.display_name} ({p.score}%)
                                  </div>
                                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.inkSoft, lineHeight: 1.5 }}>
                                    {p.reason}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Individual insights (LLM-generated from room activity) ───────── */}
            {memberInsights.length > 0 && (
              <section>
                <SectionLabel>Insights</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {memberInsights.map(mi => {
                    const llmMember = llmData?.memberInsights?.[mi.memberId];
                    const bullets = llmMember?.bullets || mi.bullets;
                    if (bullets.length === 0) return null;
                    return (
                      <div key={mi.memberId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.7)", border: `1px solid ${B.border}` }}>
                        <SmallAvatar color={mi.avatarColor} label={mi.displayName} size={32} />
                        <div>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink, marginBottom: 6 }}>{mi.displayName}</div>
                          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                            {bullets.map((b, i) => (
                              <li key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                                <span style={{ color: B.gold, fontSize: 10, marginTop: 4, flexShrink: 0 }}>·</span>
                                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.55 }}>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Group compatibility insights (LLM-generated from room activity) ─ */}
            {(llmData?.compatibility || conflicts.length > 0) && (
              <section>
                <SectionLabel>Group compatibility</SectionLabel>
                <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.7)" }}>
                  {llmData?.compatibility?.narrative && (
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${B.border}` }}>
                      <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.ink, lineHeight: 1.65 }}>
                        {llmData.compatibility.narrative}
                      </p>
                    </div>
                  )}
                  {llmData?.compatibility?.works?.length > 0 && (
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
                  {llmData?.compatibility?.tensions?.length > 0 && (
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
                  {conflicts.length > 0 && !llmData?.compatibility && (
                    <div style={{ padding: "12px 16px" }}>
                      {conflicts.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 4 }}>
                          <span style={{ color: "#C0624A", fontSize: 11, marginTop: 2, flexShrink: 0 }}>!</span>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.inkSoft, lineHeight: 1.5 }}>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Alternative properties (AI-selected with reasoning) ─ */}
            {alternatives.length > 0 && (
              <section>
                <SectionLabel>Alternative properties</SectionLabel>
                <p style={{ margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted }}>
                  AI-curated properties that match your group preferences but aren&apos;t in the room yet.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {alternatives.map(({ property, reasoning }) => (
                    <div
                      key={property.id}
                      style={{
                        display: "flex", gap: 14, padding: 12, borderRadius: 12,
                        background: "rgba(255,255,255,0.8)", border: `1px solid ${B.border}`,
                      }}
                    >
                      <a
                        href={apartmentsUrl(property)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", gap: 10, flex: "0 0 auto", minWidth: 0,
                          textDecoration: "none", color: "inherit", transition: "opacity 0.2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = 0.85; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = 1; }}
                      >
                        {property.images?.[0] && (
                          <img src={property.images[0]} alt="" style={{ width: 70, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: B.ink, marginBottom: 2 }}>{property.title}</div>
                          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted }}>{property.location} · {property.price}</div>
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 600, color: B.gold, marginTop: 4, display: "inline-block" }}>View on Apartments.com →</span>
                        </div>
                      </a>
                      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4, borderLeft: `1px solid ${B.border}` }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>Why we recommend</div>
                        <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.55 }}>
                          {reasoning || "Matches your group's preferences based on likes and dislikes."}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
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
function RadarChart({ tasteVec, color }) {
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.85;
  const keys = FEATURE_KEYS;
  const n = keys.length;
  const pts = keys.map((k, i) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    const v = Math.max(0.05, (tasteVec?.[k] ?? 0));
    const x = cx + r * v * Math.cos(ang);
    const y = cy + r * v * Math.sin(ang);
    return { x, y, label: FEATURE_LABELS[k], angle: ang };
  });
  const poly = pts.map(p => `${p.x},${p.y}`).join(" ");
  const axisPts = keys.map((k, i) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), label: FEATURE_LABELS[k] };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size + 60} height={size + 50} style={{ overflow: "visible" }}>
        <g transform={`translate(30, 25)`}>
          {/* Grid circles */}
          {[0.25, 0.5, 0.75, 1].map((v, i) => (
            <circle key={i} cx={cx} cy={cy} r={r * v} fill="none" stroke="rgba(166,124,61,0.15)" strokeWidth="0.5" />
          ))}
          {/* Axis lines */}
          {axisPts.map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(166,124,61,0.2)" strokeWidth="0.5" />
          ))}
          {/* Data polygon */}
          <polygon points={poly} fill={`${color}44`} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Center dots at each vertex */}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} />
          ))}
        </g>
        {/* Axis labels - positioned outside */}
        {axisPts.map((p, i) => {
          const dx = p.x - cx, dy = p.y - cy;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const scale = (r + 18) / len;
          const lx = 30 + cx + dx * scale;
          const ly = 25 + cy + dy * scale;
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 7, fill: B.muted }}>
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

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
      {highlight && property.images?.[0] && <img src={property.images[0]} alt="" style={{ width: 52, height: 42, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: `1px solid rgba(166,124,61,0.14)` }} onError={e => { e.target.style.display = "none"; }} />}
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
