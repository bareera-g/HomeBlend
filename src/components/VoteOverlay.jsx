import { useState, useEffect, useCallback } from "react";
import { B, Icon, IC } from "../Brand.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   VoteOverlay — Tinder-style vote overlay for unvoted room properties
   Shows one property at a time. Click Like/Pass or use ←/→ keys.
   Swipe animation on vote. Minimize to floating tab.
═══════════════════════════════════════════════════════════════════════════ */
export default function VoteOverlay({ properties = [], myVotes = {}, onVote, onClose, open }) {
  const unvoted = properties.filter(p => myVotes[p.id] == null);
  const [index, setIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [swipe, setSwipe] = useState(null); // { direction: "left"|"right", vote: -1|1 }

  const current = unvoted[index];
  const remaining = unvoted.length - index;

  const doVote = useCallback((vote) => {
    if (!current) return;
    setSwipe({ direction: vote === 1 ? "right" : "left", vote });
  }, [current]);

  useEffect(() => {
    if (!swipe || !current) return;
    const id = current.id;
    const vote = swipe.vote;
    const isLast = index >= unvoted.length - 1;
    const t = setTimeout(() => {
      onVote(id, vote);
      setSwipe(null);
      if (isLast) {
        setIndex(0); // reset for "all caught up" state
      } else {
        setIndex(i => i + 1);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [swipe]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); doVote(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); doVote(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, doVote]);

  useEffect(() => { setIndex(0); }, [unvoted.length]);

  if (!open && unvoted.length === 0) return null;

  // Minimized tab
  if (minimized && open) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", bottom: 20, left: 20, zIndex: 180,
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 24,
          background: B.goldBg, border: `1.5px solid ${B.gold}55`,
          boxShadow: "0 4px 20px rgba(80,50,10,0.2)",
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink,
          cursor: "pointer", transition: "transform 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={B.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={IC.heart} />
        </svg>
        Vote {remaining > 0 ? `(${remaining} left)` : ""}
      </button>
    );
  }

  if (!open) return null;

  // Empty state — all voted
  if (unvoted.length === 0) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 180,
          background: "rgba(20,12,5,0.45)", backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: 340, padding: 32, borderRadius: 20,
            background: "rgba(252,248,242,0.98)", border: `1px solid ${B.border}`,
            textAlign: "center", boxShadow: "0 12px 48px rgba(40,24,8,0.2)",
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,124,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon d={IC.check} size={26} color="#4A7C59" sw={2.5} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: B.ink, marginBottom: 8 }}>You&apos;re all caught up!</div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
            You&apos;ve voted on all properties. Add more to keep voting.
          </p>
          <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, background: B.ink, border: "none", color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // Full overlay with current card
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 180,
        background: "rgba(20,12,5,0.5)", backdropFilter: "blur(4px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.9)" }}>
          {remaining} {remaining === 1 ? "property" : "properties"} to vote
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setMinimized(true)}
            style={{
              padding: "8px 14px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.1)", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Minimize
          </button>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d={IC.x} size={16} color="#fff" sw={2} />
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 380, flexShrink: 0, position: "relative" }}>
        <div
          style={{
            borderRadius: 20, overflow: "hidden", background: "#fff",
            boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
            transform: swipe ? `translateX(${swipe.direction === "right" ? 120 : -120}%) rotate(${swipe.direction === "right" ? 12 : -12}deg)` : "translateX(0) rotate(0)",
            opacity: swipe ? 0.4 : 1,
            transition: "transform 0.3s cubic-bezier(.25,.1,.25,1), opacity 0.25s",
          }}
        >
          <div style={{ position: "relative", height: 380, background: "#E8DED2" }}>
            {current?.images?.map((src, i) => (
              <img key={i} src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === 0 ? 1 : 0 }} onError={e => { e.target.style.display = "none"; }} />
            ))}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,5,2,0.7) 0%, transparent 45%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: "#fff", marginBottom: 4 }}>{current?.title}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.9)" }}>{current?.location}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: "#fff", marginTop: 6 }}>{current?.price}</div>
            </div>
          </div>
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${B.border}` }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted }}>
              {current?.beds} bd · {current?.baths} ba · {current?.sqft?.toLocaleString()} sq ft
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <button
          onClick={() => doVote(-1)}
          disabled={!!swipe}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid ${B.pass}`, background: B.passBg,
            cursor: swipe ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { if (!swipe) e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,58,58,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <Icon d={IC.x} size={28} color={B.pass} sw={2.5} />
        </button>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>← Pass · Like →</span>
        <button
          onClick={() => doVote(1)}
          disabled={!!swipe}
          style={{
            width: 64, height: 64, borderRadius: "50%",
            border: `3px solid #4A7C59`, background: "rgba(74,124,89,0.15)",
            cursor: swipe ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { if (!swipe) e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(74,124,89,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <Icon d={IC.heart} size={26} color="#4A7C59" sw={2} fill="#4A7C59" />
        </button>
      </div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
        Use ← and → arrow keys to vote
      </p>
    </div>
  );
}
