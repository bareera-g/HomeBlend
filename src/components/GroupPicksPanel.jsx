import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { B } from "../Brand.jsx";
import { generateGroupPicksWithOverview, isLLMReady } from "../lib/llm.js";

/** Apartments.com search URL for a property (Irvine area) */
function apartmentsUrl(property) {
  const q = [property.title, property.location || "Irvine CA"].filter(Boolean).join(" ");
  return `https://www.apartments.com/search/?search=${encodeURIComponent(q)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GroupPicksPanel — AI-curated list of 10 picks from a pool of 65 locations
   Shows room properties scored against each member's taste profile.
   AI overview: what you have in common, what to look for.
   LLM enhances the copy when OPENAI_API_KEY is set.
═══════════════════════════════════════════════════════════════════════════ */
export default function GroupPicksPanel({ members = [], votes = [], properties: roomProperties = [], allProperties = [] }) {
  const [llmData,      setLlmData]      = useState(null);
  const [llmLoading,   setLlmLoading]   = useState(false);
  const [llmError,     setLlmError]    = useState(null);
  const votesKeyRef = useRef(null);

  const catalog = (allProperties?.length > 0 ? allProperties : roomProperties) || [];
  const hasVotes = votes.length > 0 && members.length > 0;

  const scoredProperties = useMemo(() => {
    if (roomProperties.length === 0) return [];
    return roomProperties.map(property => {
      const propVotes = votes.filter(v => v.property_id === property.id);
      const likes = propVotes.filter(v => v.vote === 1).length;
      const dislikes = propVotes.filter(v => v.vote === -1).length;
      const voteScore = propVotes.reduce((s, v) => s + (v.vote === 1 ? 1 : -1), 0);
      return { property, likes, dislikes, voteScore, avgScore: likes > 0 ? Math.min(90, 50 + likes * 15) : 40, sharedWorks: [] };
    }).sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
  }, [roomProperties, votes]);

  // ── Auto-trigger LLM when votes stabilise ──────────────────────────────
  useEffect(() => {
    if (!isLLMReady || !hasVotes || catalog.length === 0) return;
    const key = JSON.stringify(votes.map(v => `${v.user_id}:${v.property_id}:${v.vote}`).sort());
    if (key === votesKeyRef.current) return;
    votesKeyRef.current = key;
    const t = setTimeout(() => runLLM(), 4000);
    return () => clearTimeout(t);
  }, [votes, members, hasVotes]); // eslint-disable-line

  const runLLM = useCallback(async () => {
    if (!isLLMReady || llmLoading || catalog.length === 0) return;
    setLlmLoading(true);
    setLlmError(null);
    try {
      const result = await generateGroupPicksWithOverview({
        members,
        votes,
        roomProperties,
        allProperties: catalog,
        scoredProperties,
      });
      if (result) setLlmData(result);
      else setLlmError("Could not generate picks — OpenAI returned an empty response");
    } catch (e) {
      setLlmError(e.message);
    } finally {
      setLlmLoading(false);
    }
  }, [members, votes, roomProperties, catalog, scoredProperties, llmLoading]);

  const picksWithProps = useMemo(() => {
    if (!llmData?.picks?.length) return [];
    const idToProp = {};
    catalog.forEach(p => { idToProp[p.id] = p; idToProp[String(p.id)] = p; });
    return llmData.picks
      .map(({ propertyId, aiSuggestion, inBlend }) => ({
        property: idToProp[propertyId] ?? idToProp[Number(propertyId)],
        aiSuggestion: aiSuggestion || "",
        inBlend: !!inBlend,
      }))
      .filter(p => p.property);
  }, [llmData, catalog]);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (catalog.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(166,124,61,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="1.4">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: B.ink, marginBottom: 8 }}>No properties to rank</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, lineHeight: 1.7, maxWidth: 240 }}>
          Add properties to the room and cast votes — AI will curate personalized picks and explain why each fits your group.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(165deg, #FDFAF5 0%, #F5EDE3 50%, #F0E9E0 100%)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0, background: "rgba(255,255,255,0.6)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
              AI · Curated for You
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: B.ink, lineHeight: 1.1 }}>
              Group Picks
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, marginTop: 4 }}>
              Personalized picks based on your group's votes
            </div>
          </div>
          {isLLMReady && hasVotes && (
            <button onClick={runLLM} disabled={llmLoading} style={{
              padding: "8px 16px", borderRadius: 20,
              border: `1.5px solid ${B.gold}66`, background: llmLoading ? "rgba(166,124,61,0.06)" : "rgba(166,124,61,0.12)",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: B.gold,
              cursor: llmLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              boxShadow: llmLoading ? "none" : "0 2px 8px rgba(166,124,61,0.15)",
            }}>
              {llmLoading ? <><SpinDot />&nbsp;Analyzing…</> : <><SparkIcon />&nbsp;{llmData ? "Refresh" : "Generate Picks"}</>}
            </button>
          )}
        </div>
        {llmError && <div style={{ marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "#C0624A" }}>{llmError}</div>}
      </div>

      {/* ── AI Overview: compact, collapsible insight ──────────────────────── */}
      {llmData?.overview && (
        <OverviewInsight overview={llmData.overview} />
      )}

      {/* ── 10 Picks: property-dominant cards with subtle AI insight ───────── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
        padding: "18px 20px 40px",
        display: "flex", flexDirection: "column", gap: 14,
        WebkitOverflowScrolling: "touch",
      }}>
        {picksWithProps.length > 0 ? (
          picksWithProps.map(({ property, aiSuggestion, inBlend }, idx) => (
            <PropertyPickCard key={property.id} property={property} aiSuggestion={aiSuggestion} inBlend={inBlend} idx={idx} />
          ))
        ) : (
          <div style={{
            padding: "48px 32px", textAlign: "center",
            borderRadius: 16, background: "rgba(166,124,61,0.04)", border: `1.5px dashed ${B.gold}44`,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(166,124,61,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <SparkIcon />
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: B.ink, marginBottom: 8 }}>
              {llmLoading ? "Analyzing your preferences…" : "Generate your picks"}
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, margin: 0, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
              {hasVotes
                ? "Click the button above to get AI-curated picks based on what your group liked and disliked."
                : "Add properties to the room and vote — then AI will pick 10 from our 65 locations that fit your group best."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact, collapsible overview — default: 1-line teaser, expand for full insight */
function OverviewInsight({ overview }) {
  const [expanded, setExpanded] = useState(false);
  const common = overview.commonGround || "";
  const looking = overview.lookingFor || "";
  const truncate = (s, len = 90) => (s.length <= len ? s : s.slice(0, len).trim() + "…");
  const teaser = [truncate(common), truncate(looking, 70)].filter(Boolean).join(" · ");

  return (
    <div style={{ margin: "12px 20px 0" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
          background: "rgba(166,124,61,0.06)", borderLeft: `3px solid ${B.gold}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: B.gold, marginBottom: 4 }}>
              Your group's blend
            </div>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.ink, lineHeight: 1.5 }}>
              {teaser}
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.7)", border: `1px solid ${B.border}` }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: B.gold, marginBottom: 4 }}>What you have in common</div>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.ink, lineHeight: 1.6 }}>{common}</p>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: B.gold, marginBottom: 4 }}>What to look for</div>
            <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: B.ink, lineHeight: 1.6 }}>{looking}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Property-dominant card with subtle one-line AI hint */
function PropertyPickCard({ property, aiSuggestion, inBlend, idx }) {
  const [showFull, setShowFull] = useState(false);
  const teaser = aiSuggestion?.slice(0, 100) + (aiSuggestion?.length > 100 ? "…" : "") || "";

  return (
    <div style={{
      flexShrink: 0, borderRadius: 14, overflow: "hidden", border: `1px solid ${B.border}`,
      background: "#fff", boxShadow: "0 2px 10px rgba(40,24,8,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Property: hero focus */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", height: 110, flexShrink: 0, background: "#e8e2d8" }}>
            {property.images?.[0] && (
              <img
                src={property.images[0]}
                alt={property.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { e.target.style.display = "none"; }}
              />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(16,10,4,0.6) 0%, transparent 45%)" }} />
            <div style={{
              position: "absolute", top: 8, left: 10, width: 24, height: 24, borderRadius: "50%",
              background: idx === 0 ? B.gold : "rgba(255,255,255,0.95)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 800, color: idx === 0 ? "#FAF6EE" : B.ink,
            }}>
              {idx + 1}
            </div>
            {inBlend && (
              <div style={{
                position: "absolute", top: 8, right: 10, padding: "2px 6px", borderRadius: 4,
                background: "rgba(74,124,89,0.9)", fontFamily: "'DM Sans', sans-serif", fontSize: 7, fontWeight: 700, color: "#fff",
              }}>
                In blend
              </div>
            )}
            <div style={{ position: "absolute", bottom: 8, left: 10, right: 10 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{property.title}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: B.gold, marginTop: 2 }}>{property.price}</div>
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, color: B.muted, marginBottom: 4 }}>{property.location}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.ink, marginBottom: 6 }}>{property.beds} bd · {property.baths} ba · {property.sqft?.toLocaleString()} sqft</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {(property.tags || []).slice(0, 3).map(t => (
                <span key={t} style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(166,124,61,0.1)", fontFamily: "'DM Sans', sans-serif", fontSize: 8.5, fontWeight: 600, color: B.gold }}>{t}</span>
              ))}
            </div>
            <a href={apartmentsUrl(property)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 700, color: B.gold, textDecoration: "none" }}>
              View on Apartments.com
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      </div>
      {/* AI insight: one-line teaser, expand for full */}
      {aiSuggestion && (
        <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${B.border}`, background: "rgba(166,124,61,0.03)" }}>
          <button onClick={() => setShowFull(!showFull)} style={{ width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700, color: B.gold, marginRight: 6 }}>Why we picked this</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.ink, fontStyle: "italic", lineHeight: 1.4 }}>
              {showFull ? aiSuggestion : teaser}
            </span>
            {aiSuggestion.length > 100 && (
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, color: B.gold, marginLeft: 4 }}>{showFull ? " Show less" : " Show more"}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2" strokeLinecap="round">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"/>
      <path d="M8 14l1 3 3-1-1-3-3 1z"/>
      <path d="M16 18l1.5 1.5 1.5-1.5-1.5-1.5-1.5 1.5z"/>
    </svg>
  );
}

function SpinDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  );
}
