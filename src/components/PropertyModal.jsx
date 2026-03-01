import { useState } from "react";
import PropTypes from "prop-types";
import { B, Icon, IC } from "../Brand.jsx";

function AmenityIcon({ type }) {
  const s = { width: 16, height: 16, flexShrink: 0 };
  if (type === "pet") return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4.5" cy="9.5" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="19.5" cy="9.5" r="2"/>
      <path d="M12 17.5c-3.5 0-7-2-7-5s3-4 7-4 7 1 7 4-3.5 5-7 5z"/>
    </svg>
  );
  if (type === "parking") return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
    </svg>
  );
  if (type === "laundry") return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <circle cx="12" cy="13" r="4"/>
      <line x1="6" y1="7" x2="6.01" y2="7"/>
      <line x1="9" y1="7" x2="9.01" y2="7"/>
    </svg>
  );
  return null;
}

export default function PropertyModal({ property, myVote, blendScore, blendReason, onLike, onPass, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 380, background: `linear-gradient(170deg, rgba(252,248,242,0.99) 0%, rgba(246,239,228,0.99) 100%)`, borderLeft: `1px solid ${B.border}`, boxShadow: "-12px 0 48px rgba(40,24,8,0.15)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 30, animation: "slideInR 0.2s ease" }}>
      {/* Image */}
      <div style={{ position: "relative", height: 220, flexShrink: 0, background: "#E8E0D5", overflow: "hidden" }}>
        {property.images.map((src, i) => <img key={src} src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.3s", opacity: i === imgIdx ? 1 : 0 }} onError={e => { e.target.style.display = "none"; }} />)}
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 32, height: 32, borderRadius: "50%", background: "rgba(20,12,5,0.6)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={IC.x} size={14} color="#fff" sw={2} />
        </button>
        {property.images.length > 1 && (
          <div role="tablist" aria-label="Image slides" style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 5 }}>
            {property.images.map((src, i) => <button key={src} role="tab" aria-selected={i === imgIdx} aria-label={`Image ${i + 1}`} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? 16 : 5, height: 5, borderRadius: 3, background: i === imgIdx ? "#fff" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "width 0.2s", border: "none", padding: 0 }} />)}
          </div>
        )}
        {blendScore != null && (
          <div style={{ position: "absolute", top: 12, left: 12, padding: "4px 12px", borderRadius: 10, background: "rgba(74,124,89,0.9)", backdropFilter: "blur(8px)", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff" }}>{blendScore}% Blend</div>
        )}
      </div>

      {/* Header */}
      <div style={{ padding: "16px 18px 10px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: B.ink, marginBottom: 2 }}>{property.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.muted }}>{property.location}</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: B.gold }}>{property.price}</span>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 12, background: "rgba(166,124,61,0.06)", borderRadius: 8, padding: "8px 0" }}>
          {[["Bed", property.beds], ["Bath", property.baths], ["Sqft", property.sqft ? property.sqft.toLocaleString() : "—"], ["Built", property.yearBuilt || "—"]].map(([l, v], i, arr) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${B.border}` : "none" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: B.ink }}>{v}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: B.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
        {[["details","Details"],["ai","AI Overview"]].map(([t,l]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "11px 0", border: "none", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: activeTab === t ? 600 : 400, color: activeTab === t ? B.ink : B.muted, cursor: "pointer", borderBottom: activeTab === t ? `2px solid ${B.gold}` : "2px solid transparent" }}>{l}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px" }}>
        {activeTab === "details" ? (
          <>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
              {property.tags.map(t => <span key={t} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9.5, fontWeight: 500, padding: "3px 9px", borderRadius: 5, border: `1px solid ${B.border}`, background: "rgba(166,124,61,0.05)", color: B.muted }}>{t}</span>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                property.petFriendly && ["pet",     "Pet Friendly"],
                property.parking     && ["parking",  property.parking],
                property.laundry     && ["laundry",  property.laundry],
              ].filter(Boolean).map(([key, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.inkSoft }}>
                  <AmenityIcon type={key} />
                  {label}
                </div>
              ))}
            </div>
            {blendReason && <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: B.goldBg, border: `1px solid ${B.border}`, fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: B.inkSoft, lineHeight: 1.6 }}>{blendReason}</div>}
          </>
        ) : (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 300, fontStyle: "italic", color: B.ink, lineHeight: 1.7 }}>{property.aiOverview}</p>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${B.border}`, display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={onPass} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${myVote === -1 ? B.pass : B.border}`, background: myVote === -1 ? B.passBg : "transparent", color: myVote === -1 ? B.pass : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon d={IC.x} size={12} color={myVote === -1 ? B.pass : B.muted} sw={2} />
          Pass
        </button>
        <button onClick={onLike} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${myVote === 1 ? "#5C8A6B" : B.border}`, background: myVote === 1 ? "rgba(92,138,107,0.1)" : "transparent", color: myVote === 1 ? "#5C8A6B" : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon d={IC.heart} size={12} color={myVote === 1 ? "#5C8A6B" : B.muted} sw={1.8} />
          Like
        </button>
      </div>
    </div>
  );
}

AmenityIcon.propTypes = { type: PropTypes.string.isRequired };

PropertyModal.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    price: PropTypes.string,
    location: PropTypes.string,
    beds: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    baths: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sqft: PropTypes.number,
    yearBuilt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    images: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
    petFriendly: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    parking: PropTypes.string,
    laundry: PropTypes.string,
    aiOverview: PropTypes.string,
  }).isRequired,
  myVote: PropTypes.number,
  blendScore: PropTypes.number,
  blendReason: PropTypes.string,
  onLike: PropTypes.func.isRequired,
  onPass: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
