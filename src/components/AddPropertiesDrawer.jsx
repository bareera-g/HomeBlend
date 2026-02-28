import { useState } from "react";
import { B, Icon, IC } from "../Brand.jsx";
import { PROPERTIES } from "../data/properties.js";

export default function AddPropertiesDrawer({ roomPropertyIds, savedIds, onAdd, onClose }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visible = PROPERTIES.filter(p => {
    if (filter === "saved" && !savedIds.includes(p.id)) return false;
    if (search) { const q = search.toLowerCase(); return p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q); }
    return true;
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,14,6,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 400, height: "100%", background: "#F9F4ED", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(40,28,10,0.2)", animation: "slideInR 0.25s ease" }}>
        <div style={{ padding: "20px 20px 14px", borderBottom: `1px solid ${B.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: B.ink }}>Add Properties</div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Icon d={IC.x} size={20} color={B.muted} sw={2} /></button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: "100%", padding: "9px 14px", borderRadius: 9, border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: B.ink, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 5 }}>
            {[["all","All"],["saved","Saved"]].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: filter === v ? B.gold : "rgba(166,124,61,0.1)", color: filter === v ? "#FAF6EE" : B.muted, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
          {visible.map(p => {
            const inRoom = roomPropertyIds.includes(p.id);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: inRoom ? "rgba(166,124,61,0.07)" : "rgba(255,255,255,0.75)", borderRadius: 11, padding: "11px 13px", border: `1px solid ${inRoom ? B.gold : B.border}` }}>
                <div style={{ width: 60, height: 48, borderRadius: 7, flexShrink: 0, background: `url(${p.images[0]}) center/cover`, border: `1px solid ${B.border}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: B.ink, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: B.muted }}>{p.price} · {p.beds}bd</div>
                </div>
                <button onClick={() => onAdd(p.id)} disabled={inRoom} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${inRoom ? B.gold : B.border}`, background: inRoom ? B.goldBg : "transparent", cursor: inRoom ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {inRoom ? <Icon d="M20 6L9 17l-5-5" size={13} color={B.gold} sw={2.5} /> : <Icon d={IC.plus} size={13} color={B.muted} sw={2} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
