import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { B, LogoMark } from "../Brand.jsx";
import { useAuth } from "../lib/auth.jsx";

const inputStyle = {
  width: "100%", padding: "14px 18px", borderRadius: 12,
  border: `1.5px solid ${B.border}`, background: "rgba(255,255,255,0.8)",
  fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: B.ink,
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s",
};

export default function AuthPage() {
  const nav = useNavigate();
  const { user, loading, signInByName } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) nav("/dashboard", { replace: true });
  }, [user, loading, nav]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInByName(name.trim());
      nav("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(155deg, #F5EFE5 0%, #EDE5D6 55%, #E5DAC8 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: 400, width: "100%", animation: "fadeIn 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 40 }}>
          <LogoMark size={42} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: B.ink, letterSpacing: 0.5, lineHeight: 1 }}>HomeBlend</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: B.muted, marginTop: 3 }}>Find your blend together</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 8px 48px rgba(80,50,10,0.12)", overflow: "hidden" }}>
          <form onSubmit={handleSubmit} style={{ padding: "36px 28px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: B.muted }}>
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sanjoy"
                autoFocus
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = B.gold; }}
                onBlur={e => { e.target.style.borderColor = B.border; }}
              />
              <p style={{ margin: "8px 0 0", fontFamily: "'DM Sans', sans-serif", fontSize: 10.5, color: B.muted, lineHeight: 1.5 }}>
                If your name exists, you will sign in. If not, a new account is created.
              </p>
            </div>
            {error && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(192,98,74,0.08)", border: "1px solid rgba(192,98,74,0.2)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C0624A", lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim()}
              style={{
                marginTop: 6, padding: "14px 0", borderRadius: 12,
                background: busy || !name.trim() ? "rgba(50,40,28,0.4)" : B.ink,
                border: "none", color: "#FAF6EE",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600,
                cursor: busy || !name.trim() ? "default" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {busy ? "Please wait…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
