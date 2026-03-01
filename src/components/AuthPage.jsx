import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { B, LogoMark } from "../Brand.jsx";
import { signIn, signUp } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";

const labelStyle = {
  display: "block", marginBottom: 6,
  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
  letterSpacing: 0.8, textTransform: "uppercase", color: B.muted,
};
const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 9,
  border: `1px solid ${B.border}`, background: "rgba(255,255,255,0.6)",
  fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: B.ink,
  outline: "none", boxSizing: "border-box",
};

export default function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) nav("/dashboard", { replace: true });
  }, [user, loading, nav]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setError("Please enter your name."); setBusy(false); return; }
        await signUp(email.trim(), pass, name.trim());
      } else {
        await signIn(email.trim(), pass);
      }
      nav("/dashboard", { replace: true });
    } catch (err) { setError(err.message || "Something went wrong."); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: `linear-gradient(155deg, #F5EFE5 0%, #EDE5D6 55%, #E5DAC8 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div style={{ textAlign: "center", maxWidth: 460, width: "100%", animation: "fadeIn 0.5s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 36 }}>
          <LogoMark size={42} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: B.ink, letterSpacing: 0.5, lineHeight: 1 }}>HomeBlend</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: B.muted, marginTop: 3 }}>Find your blend together</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 8px 48px rgba(80,50,10,0.12)", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${B.border}` }}>
            {[["signin","Sign In"],["signup","Create Account"]].map(([m,l]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "16px 0", border: "none", background: mode === m ? "rgba(255,255,255,0.9)" : "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: mode === m ? 600 : 400, color: mode === m ? B.ink : B.muted, cursor: "pointer", borderBottom: mode === m ? `2px solid ${B.gold}` : "2px solid transparent", transition: "all 0.2s" }}>{l}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ padding: "28px 28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "signup" && <div><label style={labelStyle}>Your name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sanjoy" autoFocus style={inputStyle} /></div>}
            <div><label style={labelStyle}>Email address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus={mode==="signin"} style={inputStyle} /></div>
            <div><label style={labelStyle}>Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={mode==="signup" ? "At least 6 characters" : "••••••••"} style={inputStyle} /></div>
            {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(192,98,74,0.08)", border: "1px solid rgba(192,98,74,0.2)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C0624A", lineHeight: 1.5 }}>{error}</div>}
            <button type="submit" disabled={busy} style={{ marginTop: 4, padding: "14px 0", borderRadius: 10, background: busy ? "rgba(50,40,28,0.5)" : B.ink, border: "none", color: "#FAF6EE", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
            </button>
          </form>
          {mode === "signin" && (
            <div style={{ paddingBottom: 20, textAlign: "center" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: B.muted }}>
                New to HomeBlend?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: B.gold, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>Create an account</button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
