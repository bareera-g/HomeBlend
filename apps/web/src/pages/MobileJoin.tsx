import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function MobileJoin() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code?.trim() || !name.trim()) return;
    setLoading(true);
    setError(null);
    api
      .join(code.trim().toUpperCase(), name.trim())
      .then(({ userId }) => {
        sessionStorage.setItem("homeblend_user_id", userId);
        sessionStorage.setItem("homeblend_code", code.trim().toUpperCase());
        navigate(`/m/${code.trim().toUpperCase()}/swipe`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Join failed"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">Join HomeBlend</h1>
        <p className="text-slate-400 text-center text-sm">
          Session code: <span className="font-mono text-white">{code}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 text-white border border-white/10 placeholder-slate-500"
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white/15 text-white font-medium hover:bg-white/20 transition disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
