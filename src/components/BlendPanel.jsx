import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { B, blendColor } from "../Brand.jsx";
import { computeBlend, FEATURE_LABELS } from "../lib/blendAlgorithm.js";
import { generateBlendAnalysis, isLLMReady } from "../lib/llm.js";

/* ═══════════════════════════════════════════════════════════════════════════
   BlendPanel — redesigned: radar chart, pairwise matrix, insights cards,
   group card, top picks
═══════════════════════════════════════════════════════════════════════════ */
const FONT = "'DM Sans', sans-serif";
const SERIF = "'Cormorant Garamond', serif";

export default function BlendPanel({ members = [], votes = [], properties = [], onClose, embedded = false }) {
  const [llmData, setLlmData] = useState(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState(null);
  const prevVotesRef = useRef(null);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const blend = useMemo(
    () => computeBlend(members, votes, properties),
    [members, votes, properties],
  );
  const { groupCompatibility, compatMatrix, memberInsights, conflicts, groupFavorites, rankedProperties } = blend;
  const gc = blendColor(groupCompatibility);
  const hasVotes = votes.length > 0;

  useEffect(() => {
    if (!selectedMemberId && memberInsights.length > 0) setSelectedMemberId(memberInsights[0].memberId);
  }, [memberInsights, selectedMemberId]);

  useEffect(() => {
    const key = JSON.stringify(votes.map(v => `${v.user_id}:${v.property_id}:${v.vote}`).sort((a, b) => a.localeCompare(b)));
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
      else setLlmError("Could not generate insights.");
    } catch (e) { setLlmError(e.message); }
    finally { setLlmLoading(false); }
  }, [members, votes, properties, rankedProperties, llmLoading]);

  const selectedMi = memberInsights.find(m => m.memberId === selectedMemberId) || memberInsights[0];

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: `linear-gradient(170deg, ${B.bg} 0%, #F3EBE0 100%)` }}>

      {/* Header */}
      <div style={{ padding: "20px 22px 16px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: B.ink, letterSpacing: 0.3 }}>Blend</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isLLMReady && hasVotes && (
              <button onClick={runLLM} disabled={llmLoading}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(166,124,61,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(166,124,61,0.1)"; }}
                style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${B.gold}44`, background: "rgba(166,124,61,0.1)", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: B.gold, cursor: llmLoading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, transition: "background 0.15s" }}>
                {llmLoading ? <><SpinIcon /> Analyzing…</> : <>{llmData ? "↻ Refresh" : "✦ AI Insights"}</>}
              </button>
            )}
            {!embedded && (
              <button onClick={onClose}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(166,124,61,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(166,124,61,0.1)"; }}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(166,124,61,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
        {llmError && <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 11, color: "#C0624A" }}>{llmError}</div>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

        {!hasVotes && (
          <Card>
            <div style={{ textAlign: "center", padding: "24px 16px" }}>
              <div style={{ fontFamily: SERIF, fontSize: 20, color: B.ink, marginBottom: 8 }}>No votes yet</div>
              <p style={{ fontFamily: FONT, fontSize: 13, color: B.muted, margin: 0 }}>
                Add properties and vote — the blend updates live.
              </p>
            </div>
          </Card>
        )}

        {/* Taste Profile + Radar */}
        {memberInsights.length > 0 && (
          <section>
            <SectionLabel>Taste profile</SectionLabel>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Card style={{ flex: "1 1 180px", minWidth: 180 }}>
                <select value={selectedMemberId || ""} onChange={e => setSelectedMemberId(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 14,
                    border: `1px solid ${B.border}`, background: "rgba(166,124,61,0.06)",
                    fontFamily: FONT, fontSize: 13, fontWeight: 600, color: B.ink,
                    cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none",
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A79277' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
                  }}>
                  {memberInsights.map(mi => <option key={mi.memberId} value={mi.memberId}>{mi.displayName}</option>)}
                </select>
                {selectedMi && <RadarChart tasteVec={selectedMi.tasteVec} accentColor={selectedMi.avatarColor || B.gold} />}
              </Card>

              {members.length >= 2 && (
                <Card style={{ flex: "1 1 200px", minWidth: 200 }}>
                  <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: B.ink, marginBottom: 12 }}>Pairwise compatibility</div>
                  <PairwiseMatrix memberInsights={memberInsights} compatMatrix={compatMatrix} />
                  <div style={{ marginTop: 14, fontFamily: FONT, fontSize: 14, color: B.ink }}>
                    Group compatibility: <span style={{ fontWeight: 700, color: gc.fg }}>{groupCompatibility}%</span>
                  </div>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Insights */}
        {hasVotes && (
          <section>
            <SectionLabel>Insights</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {memberInsights.map(mi => {
                const llmMember = llmData?.memberInsights?.[mi.memberId];
                const bullets = llmMember?.bullets || mi.bullets;
                return (
                  <Card key={mi.memberId}>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: B.ink, marginBottom: 10 }}>
                      {mi.displayName}
                    </div>
                    {bullets.length > 0 ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {bullets.map((b, i) => <BulletItem key={i} text={b} />)}
                      </ul>
                    ) : (
                      <div style={{ fontFamily: FONT, fontSize: 13, color: B.muted }}>
                        {mi.topFeatures.length > 0 ? `Cares about: ${mi.topFeatures.join(", ")}` : "Not enough votes yet."}
                      </div>
                    )}
                  </Card>
                );
              })}
              <Card>
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: B.ink, marginBottom: 10 }}>Group</div>
                {llmData?.compatibility?.narrative ? (
                  <BulletItem text={llmData.compatibility.narrative} />
                ) : (
                  <BulletItem text={
                    conflicts.length > 0 ? conflicts[0]
                    : groupCompatibility >= 80 ? "High group compatibility."
                    : groupCompatibility >= 55 ? "Good compatibility with a few areas to discuss."
                    : "Mixed preferences — look for middle-ground options."
                  } />
                )}
              </Card>
            </div>
          </section>
        )}

        {/* Top picks */}
        {groupFavorites.length > 0 && (
          <section>
            <SectionLabel>Top picks</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupFavorites.slice(0, 5).map(({ property, score, likes, dislikes }) => (
                <PickRow key={property.id} property={property} score={score} likes={likes} dislikes={dislikes} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,12,5,0.35)", backdropFilter: "blur(2px)" }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
      onKeyDown={e => e.key === "Escape" && onClose?.()}>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: 440,
        background: `linear-gradient(170deg, ${B.bg} 0%, #F3EBE0 100%)`,
        borderLeft: `1px solid ${B.border}`, boxShadow: "-16px 0 64px rgba(40,24,8,0.18)",
        animation: "slideInR 0.25s cubic-bezier(.16,1,.3,1)",
      }}>
        {content}
      </div>
    </div>
  );
}

BlendPanel.propTypes = {
  members: PropTypes.arrayOf(PropTypes.object),
  votes: PropTypes.arrayOf(PropTypes.shape({ user_id: PropTypes.string, property_id: PropTypes.string, vote: PropTypes.number })),
  properties: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func,
  embedded: PropTypes.bool,
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: B.ink, marginBottom: 10, letterSpacing: 0.2 }}>{children}</div>;
}
SectionLabel.propTypes = { children: PropTypes.node.isRequired };

function Card({ children, style = {} }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}`, backdropFilter: "blur(8px)", ...style }}>
      {children}
    </div>
  );
}
Card.propTypes = { children: PropTypes.node, style: PropTypes.object };

function BulletItem({ text }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: B.gold, fontSize: 16, lineHeight: "20px", flexShrink: 0 }}>•</span>
      <span style={{ fontFamily: FONT, fontSize: 13, color: B.inkSoft || B.ink, lineHeight: 1.6 }}>{text}</span>
    </li>
  );
}
BulletItem.propTypes = { text: PropTypes.string.isRequired };

/* Radar chart (SVG, 7-axis) */
function RadarChart({ tasteVec = {}, accentColor }) {
  const keys = Object.keys(FEATURE_LABELS);
  const n = keys.length;
  if (n === 0) return null;
  const cx = 100, cy = 100, R = 70;
  const angleStep = (2 * Math.PI) / n;

  function poly(radiusFn) {
    return keys.map((k, i) => {
      const a = -Math.PI / 2 + i * angleStep;
      const r = radiusFn(k, i);
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
  }

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const values = keys.map(k => Math.min(1, tasteVec[k] ?? 0));

  const shortLabel = (k) =>
    (FEATURE_LABELS[k] || k)
      .replace("In-unit laundry", "Laundry")
      .replace("Budget-friendly", "Budget")
      .replace("More bedrooms", "Bedrooms")
      .replace("Modern build", "Modern")
      .replace("Pet-friendly", "Pets");

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 200, margin: "0 auto" }}>
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: "auto" }}>
        {gridLevels.map(lv => (
          <polygon key={lv} points={poly(() => R * lv)} fill="none" stroke={B.border} strokeWidth="0.7" />
        ))}
        {keys.map((k, i) => {
          const a = -Math.PI / 2 + i * angleStep;
          return <line key={k} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke={B.border} strokeWidth="0.5" />;
        })}
        <polygon points={poly((_k, i) => R * values[i])} fill={accentColor || B.gold} fillOpacity={0.2} stroke={accentColor || B.gold} strokeWidth="2" />
        {keys.map((k, i) => {
          const a = -Math.PI / 2 + i * angleStep;
          const r = R * values[i];
          return <circle key={k} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="3" fill={accentColor || B.gold} />;
        })}
        {keys.map((k, i) => {
          const a = -Math.PI / 2 + i * angleStep;
          const lr = R + 18;
          return (
            <text key={k} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)} textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: FONT, fontSize: 9, fill: B.muted, fontWeight: 500 }}>
              {shortLabel(k)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
RadarChart.propTypes = { tasteVec: PropTypes.object, accentColor: PropTypes.string };

/* Pairwise compatibility matrix */
function PairwiseMatrix({ memberInsights, compatMatrix }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th />
            {memberInsights.map(m => (
              <th key={m.memberId} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: B.ink, padding: "6px 8px", textAlign: "center" }}>
                {m.displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {memberInsights.map(mi => (
            <tr key={mi.memberId}>
              <td style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: B.ink, padding: "6px 8px", whiteSpace: "nowrap" }}>
                {mi.displayName}
              </td>
              {memberInsights.map(mj => {
                if (mi.memberId === mj.memberId) {
                  return <td key={mj.memberId} style={{ padding: "6px 8px", textAlign: "center", fontFamily: FONT, fontSize: 12, color: B.muted }}>—</td>;
                }
                const pct = compatMatrix[mi.memberId]?.[mj.memberId] ?? 0;
                const c = blendColor(pct);
                return (
                  <td key={mj.memberId} style={{ padding: "6px 8px", textAlign: "center" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 8,
                      background: c.bg, color: c.fg, fontFamily: FONT, fontSize: 12, fontWeight: 700, minWidth: 44,
                    }}>
                      {pct}%
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
PairwiseMatrix.propTypes = { memberInsights: PropTypes.array, compatMatrix: PropTypes.object };

/* Top-pick property row */
function PickRow({ property, score, likes, dislikes }) {
  const sc = score > 0 ? "#5C8A6B" : score < 0 ? "#C0624A" : B.muted;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", borderRadius: 12,
      background: "rgba(255,255,255,0.75)", border: `1px solid ${B.border}`,
    }}>
      {property.images?.[0] && (
        <img src={property.images[0]} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
          onError={e => { e.target.style.display = "none"; }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: B.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{property.title}</div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: B.muted, marginTop: 2 }}>
          {property.location} · {property.price}{property.beds ? ` · ${property.beds} bed` : ""}{property.baths ? ` · ${property.baths} bath` : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {likes > 0 && <VotePill count={likes} up />}
        {dislikes > 0 && <VotePill count={dislikes} />}
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: sc, minWidth: 32, textAlign: "right" }}>
          score {score > 0 ? `${score}.0` : `${score}.0`}
        </span>
      </div>
    </div>
  );
}
PickRow.propTypes = { property: PropTypes.object, score: PropTypes.number, likes: PropTypes.number, dislikes: PropTypes.number };

function VotePill({ count, up }) {
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", borderRadius: 6,
      background: up ? "rgba(92,138,107,0.1)" : "rgba(192,98,74,0.1)",
      color: up ? "#5C8A6B" : "#C0624A", fontFamily: FONT, fontSize: 11, fontWeight: 700,
    }}>
      {up ? "♥" : "✕"}{count}
    </span>
  );
}
VotePill.propTypes = { count: PropTypes.number.isRequired, up: PropTypes.bool };

function SpinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  );
}
