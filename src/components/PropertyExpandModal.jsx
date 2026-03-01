import { useState, useEffect, useCallback, useMemo, memo } from "react";
import PropTypes from "prop-types";
import { B, Icon, IC } from "../Brand.jsx";

/* ═══════════════════════════════════════════════════════════════════════════
   PropertyExpandModal — full-screen scale-up detail view
   Perf: memoised derivations, GPU-promoted layers, rAF auto-scroll
   ═══════════════════════════════════════════════════════════════════════════ */

const AmenityChip = memo(function AmenityChip({ icon, label }) {
  return (
    <span style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 12px", borderRadius: 8,
      background: "rgba(166,124,61,0.06)",
      border: `1px solid rgba(166,124,61,0.16)`,
      fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted, fontWeight: 500,
      whiteSpace: "nowrap",
    }}>
      <AmenityIcon type={icon} size={14} /> {label}
    </span>
  );
});

const AmenityIcon = memo(function AmenityIcon({ type, size = 14 }) {
  const w = size, h = size;
  if (type === "pet") return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4.5" cy="9.5" r="2"/><circle cx="9" cy="5" r="2"/>
      <circle cx="15" cy="5" r="2"/><circle cx="19.5" cy="9.5" r="2"/>
      <path d="M12 17.5c-3.5 0-7-2-7-5s3-4 7-4 7 1 7 4-3.5 5-7 5z"/>
    </svg>
  );
  if (type === "parking") return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
    </svg>
  );
  if (type === "laundry") return (
    <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <circle cx="12" cy="13" r="4"/>
      <line x1="6" y1="7" x2="6.01" y2="7"/>
      <line x1="9" y1="7" x2="9.01" y2="7"/>
    </svg>
  );
  return null;
});

AmenityChip.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
};

AmenityIcon.propTypes = {
  type: PropTypes.string.isRequired,
  size: PropTypes.number,
};

export default function PropertyExpandModal({ property, saved, onSave, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [closing, setClosing] = useState(false);
  const totalImgs = property.images?.length || 0;

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  // Escape + arrow keys in a single listener
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft")  setImgIdx(i => (i - 1 + totalImgs) % totalImgs);
      else if (e.key === "ArrowRight") setImgIdx(i => (i + 1) % totalImgs);
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [close, totalImgs]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ── Memoised derivations ─────────────────────────────────────────── */
  const amenities = useMemo(() => [
    property.parking     && { icon: "parking", label: property.parking },
    property.laundry     && { icon: "laundry", label: property.laundry },
    property.petFriendly && { icon: "pet",     label: "Pet Friendly" },
  ].filter(Boolean), [property.parking, property.laundry, property.petFriendly]);

  // Only render the current image + neighbors for perf (lazy gallery)
  const visibleIndices = useMemo(() => {
    if (!property.images) return [];
    return totalImgs <= 3
      ? property.images.map((_, i) => i)
      : [...new Set([imgIdx, (imgIdx + 1) % totalImgs, (imgIdx - 1 + totalImgs) % totalImgs])];
  }, [imgIdx, totalImgs, property.images]);

  return (
    <dialog
      open
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      onKeyDown={e => { if (e.key === 'Escape') close(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: closing ? "rgba(20,12,5,0)" : "rgba(20,12,5,0.55)",
        backdropFilter: closing ? "none" : "blur(4px)",
        WebkitBackdropFilter: closing ? "none" : "blur(4px)",
        transition: "background 0.22s ease",
        animation: closing ? undefined : "fadeInFast 0.15s ease",
        border: "none", padding: 0, margin: 0, width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh",
      }}
    >
      {/* Modal card — GPU-promoted layer */}
      <div style={{
        width: "min(92vw, 960px)",
        maxHeight: "90vh",
        borderRadius: 20,
        overflow: "hidden",
        background: `linear-gradient(170deg, #FDFAF6 0%, #F6EFE4 100%)`,
        boxShadow: "0 32px 80px rgba(20,12,5,0.35), 0 0 0 1px rgba(166,124,61,0.18)",
        display: "flex",
        flexDirection: "column",
        contain: "layout style paint",
        willChange: "transform, opacity",
        transform: closing ? "scale(0.92)" : "scale(1)",
        opacity: closing ? 0 : 1,
        transition: "transform 0.22s cubic-bezier(.16,1,.3,1), opacity 0.18s ease",
        animation: closing ? undefined : "modalScaleUp 0.28s cubic-bezier(.16,1,.3,1)",
      }}>

        {/* ── Hero image gallery ── */}
        <div style={{
          height: "min(50vh, 400px)", flexShrink: 0,
          position: "relative", overflow: "hidden",
          background: "#E8DED2",
        }}>
          {/* Only render visible images (current + neighbors) */}
          {visibleIndices.map(i => (
            <img
              key={i} src={property.images[i]} alt=""
              loading={i === imgIdx ? "eager" : "lazy"}
              decoding="async"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover",
                willChange: "opacity",
                transition: "opacity 0.35s ease",
                opacity: i === imgIdx ? 1 : 0,
              }}
            />
          ))}

          {/* Gradient scrims */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(12,5,2,0.5) 0%, transparent 50%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,5,2,0.35) 0%, transparent 36%)", pointerEvents: "none" }} />

          {/* Close button */}
          <button
            onClick={close}
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 5,
              width: 38, height: 38, borderRadius: "50%",
              background: "rgba(20,12,5,0.55)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.15)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(20,12,5,0.75)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(20,12,5,0.55)"}
          >
            <Icon d={IC.x} size={16} color="#fff" sw={2.2} />
          </button>

          {/* Category badge */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            padding: "5px 13px", borderRadius: 8,
            background: "rgba(12,5,2,0.55)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.92)",
          }}>{property.category}</div>

          {/* Navigation arrows */}
          {totalImgs > 1 && (
            <>
              <button
                onClick={() => setImgIdx(i => (i - 1 + totalImgs) % totalImgs)}
                style={{
                  position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,1)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C1A0E" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button
                onClick={() => setImgIdx(i => (i + 1) % totalImgs)}
                style={{
                  position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                  width: 40, height: 40, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,1)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.85)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C1A0E" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </>
          )}

          {/* Dot indicators */}
          {totalImgs > 1 && (
            <div role="tablist" style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, alignItems: "center" }}>
              {property.images.map((src, i) => (
                <button
                  key={`dot-${src}`}
                  role="tab"
                  aria-label={`Image ${i + 1}`}
                  aria-selected={i === imgIdx}
                  onClick={() => setImgIdx(i)}
                  style={{
                    width: i === imgIdx ? 22 : 7, height: 7, borderRadius: 4,
                    background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.5)",
                    cursor: "pointer", transition: "width 0.25s ease, background 0.2s",
                    boxShadow: i === imgIdx ? "0 0 8px rgba(255,255,255,0.5)" : "none",
                    border: "none", padding: 0,
                  }}
                />
              ))}
            </div>
          )}

          {/* Price overlay — bottom left */}
          <div style={{ position: "absolute", bottom: 18, left: 20 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500,
              color: "#fff", lineHeight: 1, textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}>{property.price}</div>
          </div>

          {/* Save heart — bottom right */}
          <button
            onClick={e => { e.stopPropagation(); onSave?.(e); }}
            title={saved ? "Unsave" : "Save"}
            style={{
              position: "absolute", bottom: 16, right: 16,
              width: 42, height: 42, borderRadius: "50%", border: "none",
              background: saved ? B.gold : "rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 14px rgba(0,0,0,0.25)",
              transition: "background 0.2s, transform 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.12)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <svg width="17" height="17" viewBox="0 0 24 24"
              fill={saved ? "#fff" : "none"} stroke={saved ? "#fff" : B.ink}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable content below hero ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 0 10px" }}>

          {/* Title + location header */}
          <div style={{ padding: "20px 28px 16px", borderBottom: `1px solid ${B.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500,
                  color: B.ink, lineHeight: 1.2, margin: 0,
                }}>{property.title}</h2>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.muted,
                  marginTop: 4, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Icon d={IC.pin} size={13} color={B.muted} sw={1.5} />
                  {property.location}
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{
              display: "flex", gap: 0, marginTop: 18,
              background: "rgba(166,124,61,0.06)", borderRadius: 12,
              border: `1px solid rgba(166,124,61,0.12)`,
              overflow: "hidden",
            }}>
              {[
                [property.beds,                              "Bedrooms"],
                [property.baths,                             "Bathrooms"],
                [property.sqft ? property.sqft.toLocaleString() : "—",  "Sq Ft"],
                [property.yearBuilt || "—",                  "Year Built"],
              ].map(([v, l], i, arr) => (
                <div key={l} style={{
                  flex: 1, textAlign: "center", padding: "12px 0",
                  borderRight: i < arr.length - 1 ? `1px solid rgba(166,124,61,0.12)` : "none",
                }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: B.ink, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: B.muted, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags + Amenities */}
          <div style={{ padding: "16px 28px", borderBottom: `1px solid ${B.border}` }}>
            {/* Tags */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: amenities.length > 0 ? 14 : 0 }}>
              {property.tags.map(tag => (
                <span key={tag} style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
                  padding: "4px 12px", borderRadius: 6,
                  border: `1px solid ${B.border}`, color: B.muted,
                  background: "rgba(166,124,61,0.04)",
                  whiteSpace: "nowrap",
                }}>{tag}</span>
              ))}
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {amenities.map(a => (
                  <AmenityChip key={a.label} icon={a.icon} label={a.label} />
                ))}
              </div>
            )}
          </div>

          {/* AI Overview */}
          <div style={{ padding: "20px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={B.gold} stroke="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700,
                letterSpacing: 1.5, textTransform: "uppercase", color: B.gold,
              }}>AI Overview</span>
            </div>
            <div style={{
              padding: "16px 20px", borderRadius: 14,
              background: "rgba(255,255,255,0.75)",
              border: `1px solid rgba(166,124,61,0.14)`,
            }}>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.85,
                color: B.inkSoft, margin: 0,
              }}>{property.aiOverview}</p>
            </div>
          </div>

          {/* Photo strip (thumbs) */}
          {totalImgs > 1 && (
            <div style={{ padding: "4px 28px 16px" }}>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {property.images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    style={{
                      height: 72, minWidth: i === 0 ? 130 : 100,
                      borderRadius: 10, flexShrink: 0, cursor: "pointer",
                      background: `url(${src}) center/cover`,
                      border: i === imgIdx ? `2px solid ${B.gold}` : `1px solid rgba(166,124,61,0.18)`,
                      boxShadow: i === imgIdx ? `0 0 0 2px rgba(166,124,61,0.2)` : "0 2px 8px rgba(0,0,0,0.08)",
                      opacity: i === imgIdx ? 1 : 0.7,
                      transition: "opacity 0.2s, border 0.2s, box-shadow 0.2s",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* View Listing link */}
          {property.listingUrl && (
            <div style={{ padding: "4px 28px 20px" }}>
              <a href={property.listingUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: "100%", textAlign: "center",
                  padding: "11px 0", borderRadius: 10,
                  border: `1px solid ${B.gold}`,
                  background: "rgba(166,124,61,0.08)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 600,
                  color: B.gold, textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(166,124,61,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(166,124,61,0.08)"}
              >
                View Listing
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

PropertyExpandModal.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    price: PropTypes.string,
    location: PropTypes.string,
    category: PropTypes.string,
    beds: PropTypes.number,
    baths: PropTypes.number,
    sqft: PropTypes.number,
    yearBuilt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    images: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
    parking: PropTypes.string,
    laundry: PropTypes.string,
    petFriendly: PropTypes.bool,
    aiOverview: PropTypes.string,
    listingUrl: PropTypes.string,
  }).isRequired,
  saved: PropTypes.bool,
  onSave: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};